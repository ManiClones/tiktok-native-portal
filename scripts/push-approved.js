#!/usr/bin/env node
/**
 * Push Approved Slideshows to GitHub
 * 
 * Usage: 
 *   node scripts/push-approved.js approved [N]  - Push N approved slideshows (default: all)
 *   node scripts/push-approved.js push          - Push to GitHub
 *   node scripts/push-approved.js clear [N]     - Keep only N newest (default: 20)
 *   node scripts/push-approved.js status         - Show portal status
 * 
 * This script:
 * 1. Takes new approved slideshows from TikTok Generator
 * 2. Copies composite images (with text) and raw backgrounds (without text) 
 * 3. Updates slideshows.json
 * 4. Commits and pushes to GitHub
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'public', 'api', 'slideshows.json');
const PUBLIC_SLIDESHOWS = path.join(ROOT_DIR, 'public', 'slideshows');
const PUBLIC_RAW = path.join(ROOT_DIR, 'public', 'raw-images');
const TIKTOK_GENERATOR_OUTPUT = '/home/node/.openclaw/workspace/coding/TikTokGenerator';

// Ensure directories exist
[PUBLIC_SLIDESHOWS, PUBLIC_RAW].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

/**
 * Get all approved slideshows from TikTok Generator
 * @returns {Array} Array of approved slideshow objects
 */
export function getApprovedSlideshows() {
  const slideshows = [];
  
  // Walk through all version directories
  ['V1', 'V2', 'V3'].forEach(version => {
    const outputDir = path.join(TIKTOK_GENERATOR_OUTPUT, version, 'output');
    
    if (!fs.existsSync(outputDir)) return;
    
    const dirs = fs.readdirSync(outputDir, { withFileTypes: true });
    
    dirs.forEach(dir => {
      if (!dir.isDirectory()) return;
      
      const slideshowPath = path.join(outputDir, dir.name);
      const metaPath = path.join(slideshowPath, 'meta.json');
      
      if (!fs.existsSync(metaPath)) return;
      
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        
        // Check if approved
        if (meta.approved === true || (meta.approval && meta.approval.approvedAt)) {
          slideshows.push({
            id: dir.name,
            version,
            path: slideshowPath,
            meta,
            approvedAt: meta.approval?.approvedAt || meta.approvedAt
          });
        }
      } catch (err) {
        console.warn(`⚠️ Could not parse ${metaPath}: ${err.message}`);
      }
    });
  });
  
  // Sort by approval date (newest first)
  slideshows.sort((a, b) => 
    new Date(b.approvedAt) - new Date(a.approvedAt)
  );
  
  return slideshows;
}

/**
 * Check if slideshow already exists in portal
 * @param {string} slideshowId 
 * @returns {boolean}
 */
export function isSlideshowInPortal(slideshowId) {
  if (!fs.existsSync(DATA_FILE)) return false;
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return data.slideshows.some(s => s.id === slideshowId);
}

/**
 * Extract slides data from TikTok Generator meta
 * @param {Object} meta - The meta.json content
 * @param {string} slideshowPath - Path to slideshow directory
 * @returns {Array} Array of slide objects
 */
function extractSlides(meta, slideshowPath) {
  const slides = [];
  
  if (!meta.slides || !Array.isArray(meta.slides)) {
    return slides;
  }
  
  // Check if raw backgrounds exist
  const rawBackgroundPath = path.join(slideshowPath, 'raw_background.jpg');
  const hasRawBackground = fs.existsSync(rawBackgroundPath);
  
  meta.slides.forEach((slide, i) => {
    const slideNum = i + 1;
    const compositePath = path.join(slideshowPath, `slide_${slideNum}.jpg`);
    const rawSlidePath = path.join(slideshowPath, `raw_slide_${slideNum}.jpg`);
    
    if (!fs.existsSync(compositePath)) {
      console.warn(`⚠️ Composite image not found: ${compositePath}`);
      return;
    }
    
    // Determine raw image path
    let rawImagePath;
    if (fs.existsSync(rawSlidePath)) {
      // Individual raw slide exists
      rawImagePath = rawSlidePath;
    } else if (hasRawBackground) {
      // Use shared raw background (for V3 all slides use same background)
      rawImagePath = rawBackgroundPath;
    } else {
      // No raw available, use composite as fallback
      rawImagePath = compositePath;
    }
    
    // Extract text based on slide type
    let headline = '';
    let subline = '';
    
    switch (slide.type) {
      case 'hook':
        headline = slide.headline || '';
        subline = '';
        break;
        
      case 'transition':
        headline = slide.text || '';
        subline = '';
        break;
        
      case 'methods':
        headline = slide.methods?.join(' • ') || '';
        subline = '';
        break;
        
      case 'cta':
        headline = slide.header || '';
        subline = `${slide.app_name || ''} - ${slide.description || ''}`;
        break;
        
      case 'tip':
        headline = `${slide.label || ''}: ${slide.text || ''}`;
        subline = '';
        break;
        
      case 'steps':
        slide.steps?.forEach((step, j) => {
          slides.push({
            index: slides.length,
            headline: step.header || '',
            subline: step.text || '',
            raw_image_path: rawImagePath,
            composite_image_path: compositePath,
            hasRaw: rawImagePath !== compositePath
          });
        });
        return; // Skip the default push below
        
      default:
        headline = slide.headline || slide.text || '';
        subline = slide.type || '';
    }
    
    slides.push({
      index: slides.length,
      headline,
      subline,
      raw_image_path: rawImagePath,
      composite_image_path: compositePath,
      hasRaw: rawImagePath !== compositePath
    });
  });
  
  return slides;
}

/**
 * Add a new slideshow to the portal
 * @param {Object} slideshowData - The slideshow data
 * @returns {Object} The created slideshow record
 */
export function addSlideshow(slideshowData) {
  const {
    id,
    hook,
    slides,
    fullPreviewPath,
    isRawOnly
  } = slideshowData;

  if (!id || !hook || !slides || slides.length === 0) {
    throw new Error('Invalid slideshow data: missing id, hook, or slides');
  }

  // Check if already exists
  if (isSlideshowInPortal(id)) {
    console.log(`⏭ Skipping ${id} - already in portal`);
    return null;
  }

  // Load existing data
  let data = { slideshows: [] };
  if (fs.existsSync(DATA_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      console.warn('⚠️ Could not parse existing slideshows.json, creating new');
      data = { slideshows: [] };
    }
  }

  console.log(`\n📦 Processing slideshow: ${id}`);
  console.log(`   Hook: ${hook}`);
  console.log(`   Slides: ${slides.length}`);

  // Copy images to public folders
  const slideRecords = slides.map((slide, i) => {
    const rawDest = path.join(PUBLIC_RAW, `${id}-slide-${i}.jpg`);
    const compDest = path.join(PUBLIC_SLIDESHOWS, `${id}-slide-${i}.jpg`);

    // Copy composite image
    if (fs.existsSync(slide.composite_image_path)) {
      fs.copyFileSync(slide.composite_image_path, compDest);
      console.log(`   ✅ Copied composite: slide-${i}.jpg`);
    } else {
      console.warn(`   ⚠️ Composite not found: ${slide.composite_image_path}`);
    }

    // Copy raw image
    if (fs.existsSync(slide.raw_image_path)) {
      fs.copyFileSync(slide.raw_image_path, rawDest);
      console.log(`   ✅ Copied raw: slide-${i}.jpg`);
    } else {
      console.warn(`   ⚠️ Raw not found: ${slide.raw_image_path}`);
    }

    return {
      index: i,
      headline: slide.headline,
      subline: slide.subline,
      raw_image: `/raw-images/${id}-slide-${i}.jpg`,
      composite_image: `/slideshows/${id}-slide-${i}.jpg`,
      hasRaw: slide.hasRaw || false
    };
  });

  // Copy full preview if exists
  const fullPreviewDest = path.join(PUBLIC_SLIDESHOWS, `${id}-full.png`);
  if (fullPreviewPath && fs.existsSync(fullPreviewPath)) {
    fs.copyFileSync(fullPreviewPath, fullPreviewDest);
    console.log(`   ✅ Copied full preview`);
  } else {
    // Create full preview from first slide
    if (slides.length > 0 && fs.existsSync(slides[0].composite_image_path)) {
      fs.copyFileSync(slides[0].composite_image_path, fullPreviewDest);
      console.log(`   ✅ Created full preview from first slide`);
    }
  }

  // Create slideshow record
  const newSlideshow = {
    id,
    created_at: new Date().toISOString(),
    hook,
    downloaded: false,
    slides: slideRecords,
    full_preview: `/slideshows/${id}-full.png`
  };

  // Add to data
  data.slideshows.unshift(newSlideshow); // Add to beginning

  // Save
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`   💾 Updated slideshows.json`);

  console.log(`\n✅ Added slideshow: ${id}\n`);
  return newSlideshow;
}

/**
 * Push to GitHub
 * @param {string} commitMessage - The commit message
 * @returns {boolean} Success status
 */
export function pushToGitHub(commitMessage = 'Update slideshows') {
  console.log('\n🚀 Pushing to GitHub...\n');
  
  try {
    // Add all changes
    execSync('git add .', { cwd: ROOT_DIR, stdio: 'inherit' });
    
    // Check if there are changes to commit
    try {
      execSync('git diff --cached --quiet', { cwd: ROOT_DIR, stdio: 'pipe' });
      console.log('   ℹ️ No changes to commit');
      return true;
    } catch {
      // There are changes, proceed with commit
    }
    
    // Commit
    execSync(`git commit -m "${commitMessage}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('   ✅ Committed changes');
    
    // Push
    execSync('git push', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('   ✅ Pushed to GitHub');
    
    console.log('\n✅ Successfully pushed to GitHub!\n');
    return true;
  } catch (error) {
    console.error('❌ Git push failed:', error.message);
    return false;
  }
}

/**
 * Push multiple approved slideshows from TikTok Generator
 * @param {number} count - Number of slideshows to push (default: all approved)
 * @returns {Object} Result with count and slideshow IDs
 */
export function pushApprovedSlideshows(count = null) {
  console.log('\n📋 Fetching approved slideshows from TikTok Generator...\n');
  
  const approved = getApprovedSlideshows();
  
  if (approved.length === 0) {
    console.log('   ℹ️ No approved slideshows found');
    return { count: 0, pushed: [] };
  }
  
  // Limit count if specified
  const toProcess = count ? approved.slice(0, count) : approved;
  
  console.log(`   Found ${approved.length} approved slideshows`);
  console.log(`   Processing ${toProcess.length} slideshows\n`);
  
  const pushed = [];
  let failed = 0;
  
  toProcess.forEach((slideshow, i) => {
    console.log(`\n[${i + 1}/${toProcess.length}] Processing ${slideshow.id}...`);
    
    try {
      // Extract hook text
      const hookText = extractHookText(slideshow.meta);
      
      // Extract slides
      const slides = extractSlides(slideshow.meta, slideshow.path);
      
      if (slides.length === 0) {
        console.log('   ⚠️ No slides found, skipping');
        failed++;
        return;
      }
      
      addSlideshow({
        id: slideshow.id,
        hook: hookText,
        slides,
        fullPreviewPath: path.join(slideshow.path, 'slide_1.jpg'),
        isRawOnly: false
      });
      
      pushed.push(slideshow.id);
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed++;
    }
  });
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Pushed: ${pushed.length}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  // Push to GitHub if we pushed anything
  if (pushed.length > 0) {
    pushToGitHub(`Add ${pushed.length} approved slideshows`);
  }
  
  return { count: pushed.length, pushed, pushed, pushed, failed };
}

/**
 * Extract hook text from meta
 * @param {Object} meta - The meta.json content
 * @returns {string} The hook text
 */
function extractHookText(meta) {
  // Try to find hook text from slides
  if (meta.slides && Array.isArray(meta.slides)) {
    const hookSlide = meta.slides.find(s => s.type === 'hook');
    if (hookSlide) {
      return hookSlide.headline || hookSlide.text || 'Untitled';
    }
  }
  
  return 'Untitled';
}

/**
 * Clear old slideshows (optional cleanup)
 * @param {number} keepCount - Number of slideshows to keep (default: 20)
 */
export function clearOldSlideshows(keepCount = 20) {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('ℹ️ No slideshows to clean up');
    return;
  }
  
  let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  if (data.slideshows.length <= keepCount) {
    console.log(`ℹ️ Only ${data.slideshows.length} slideshows, nothing to clean`);
    return;
  }
  
  console.log(`\n🧹 Cleaning up old slideshows (keeping ${keepCount} newest)...\n`);
  
  // Sort by date, keep newest
  const sorted = [...data.slideshows].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  
  const toRemove = sorted.slice(keepCount);
  
  // Remove files
  toRemove.forEach(slideshow => {
    console.log(`   Removing ${slideshow.id}...`);
    
    slideshow.slides.forEach(slide => {
    const rawPath = path.join(ROOT_DIR, 'public', slide.raw_image);
    const compPath = path.join(ROOT_DIR, 'public', slide.composite_image);
    
    if (fs.existsSync(rawPath)) {
      fs.unlinkSync(rawPath);
    }
    if (fs.existsSync(compPath)) {
      fs.unlinkSync(compPath);
    }
  });
  
  const fullPath = path.join(ROOT_DIR, 'public', slideshow.full_preview);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
  });
  
  // Update data
  data.slideshows = sorted.slice(0, keepCount);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Cleaned up ${toRemove.length} old slideshows\n`);
}

/**
 * Show status of portal
 */
export function showStatus() {
  console.log('\n📊 TikTok Native Portal Status\n');
  console.log('='.repeat(40));
  
  if (!fs.existsSync(DATA_FILE)) {
    console.log('   No slideshows in portal');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`   Total slideshows: ${data.slideshows.length}`);
  console.log('');
  
  data.slideshows.slice(0, 5).forEach((s, i) => {
    const date = new Date(s.created_at).toLocaleDateString();
    console.log(`   ${i + 1}. ${s.id}`);
    console.log(`      Hook: ${s.hook.substring(0, 50)}...`);
    console.log(`      Slides: ${s.slides.length} | Created: ${date}`);
  });
  
  if (data.slideshows.length > 5) {
    console.log(`   ... and ${data.slideshows.length - 5} more`);
  }
}

// CLI usage
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'push') {
    pushToGitHub();
  } else if (args[0] === 'clear') {
    clearOldSlideshows(parseInt(args[1]) || 20);
  } else if (args[0] === 'approved') {
    const count = args[1] ? parseInt(args[1]) : null;
    pushApprovedSlideshows(count);
  } else if (args[0] === 'status') {
    showStatus();
  } else {
    console.log(`
Usage:
  node scripts/push-approved.js push              - Push to GitHub
  node scripts/push-approved.js clear N         - Keep only N newest slideshows
  node scripts/push-approved.js approved [N] - Push N approved slideshows from TikTok Generator
  node scripts/push-approved.js status           - Show portal status
    `);
  }
}

export default { 
  addSlideshow, 
  pushToGitHub, 
  clearOldSlideshows, 
  getApprovedSlideshows, 
  pushApprovedSlideshows,
  showStatus,
  isSlideshowInPortal 
};
