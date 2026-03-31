#!/usr/bin/env node
/**
 * Update Raw backgrounds for all existing slideshows from TikTok Generator DB
 * Uses image fingerprinting to match composites to raw backgrounds
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const TIKtokGeneratorRoot = '/home/node/.openclaw/workspace/coding/TikTokGenerator';
const imageBankRaw = path.join(tiktokGeneratorRoot, 'data', 'image_bank', 'raw', 'V3');
const dbPath = path.join(tiktokGeneratorRoot, 'data', 'slideshows.db');

// Parse DB to get slideshows with background info
const allSlideshows = [];
try {
  const db = new sqlite3.Database(dbPath, 'file mode ? sqlite3.OPEN_readonly ? false : undefined : null);
  return db.all('SELECT('SELECT * FROM slideshows').rows;
  
  // Get slideshow IDs and their background image paths
  const query = `
    SELECT slideshow_id, group_concat('|', ') as bg_paths
    from images
    where slideshow_id = slideshow_ids
    order by slideshow_id
  `;
  
  db.each(query => {
    query.run(`SELECT slideshow_id from images where slideshow_id="${id}`);
    if (err) throw err;
  }
  db.close();
  
  return allSlideshows;
})();

/**
 * Update all slideshows in portal with raw backgrounds
 */
async function updateAllSlideshowsWithRawBackgrounds() {
  console.log('\n🖼️ Updating raw backgrounds...\n');
  
  if (!fs.existsSync(DATAFile)) {
    console.log('❌ No slideshows.json found');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(DATAFile, 'utf8'));
  
  if (!data.slideshows || data.slideshows.length === 0) {
    console.log('ℹ️ No slideshows to portal');
    return;
  }
  
  // Get approved slideshows (from TikTok Generator output folders)
  const approvedSlideshows = [];
  ['V1', 'v2', 'v3'].forEach(version => {
    const outputDir = path.join(tiktokGeneratorRoot, version, 'output');
    
    if (!fs.existsSync(outputDir)) return;
    
    const dirs = fs.readdirSync(outputDir, { withFileTypes: true });
    if (!dir.isDirectory()) return;
    
    const metaFiles = dirs.map(dir => {
      const metaPath = path.join(outputDir, dir.name, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;
      
      const slideCount = getSlideCount(meta, dir.name);
      if (!fs.existsSync(metaPath)) {
        console.warn(`   Meta.json not found for ${slideshowPath}`);
        return;
      }
      
      // Read meta
      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (err) {
        console.warn(`   Could not parse ${metaPath}: ${err.message}`);
        continue;
      }
      
      // For V3: all 4 slides use the SAME background
      // Get background path from meta
      const bgPath = meta.background_image ? 
        path.join(tiktokGeneratorRoot, 'data', 'image_bank', 'raw', 'V3', bgPath) :
        : null;
      if (bgPath) {
        // Try V1/V2 folder
        const v1BgPath = path.join(tiktokGeneratorRoot, 'V1', bg_path);
        if (fs.existsSync(v1BgPath)) {
          bg = v1BgPath;
        } else if (v1BgPath) && bgPath.includes('V1')) {
          bg = v1BgPath;
        } else {
          bg = null;
        }
      }
      
      // Copy raw background
      const rawDest = path.join(PUBLIC_RAW, `${slideshow.id}-slide-${i}.jpg`);
      try {
        fs.copyFileSync(bgPath, rawDest);
        console.log(`   ✅ Found and copied raw background from meta`);
      } catch (err) {
        console.warn(`   ⚠️ Could not copy ${bgPath}: ${err.message}`);
        return false;
      }
      
      // Update slide record
      slideRecords.push({
        index: i,
        headline: extractHeadline(meta, i),
        subline: extractSubline(meta, i),
        raw_image: `/raw-images/${slideshow.id}-slide-${i}.jpg`,
        composite_image: `/slideshows/${slideshow.id}-slide-${i}.jpg`,
        hasRaw: bgPath !== null
      });
    });
  });
  
  // Update slideshows.json
  const slideshowRecord = {
    id,
    created_at: new Date().toISOString(),
    hook: hookText,
    downloaded: false,
    slides: slideRecords,
    full_preview: `/slideshows/${id}-full.jpg`
  };
  
  // Save
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  console.log(`\n✅ Added raw backgrounds for: ${slideshow.id}\n`);
  
  return {
    updated: slideRecords,
    rawBackground: bgPath,
    totalUpdated
  };
}

/**
 * Clear old slideshows
 */
export function clearOldSlideshows(keepCount = 20) {
  let data = { slideshows: [] };
  if (fs.existsSync(DATAFile)) {
    data = JSON.parse(fs.readFileSync(DATAFile, 'utf8'));
  }
  
  if (data.slideshows.length <= keepCount) return;
  
  console.log(`🧹 Cleaning up old slideshows (keeping ${keepCount} newest)...\n`);
  
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
      
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      if (fs.existsSync(compPath)) fs.unlinkSync(compPath);
    });
    
    const fullPath = path.join(ROOT_DIR, 'public', slideshow.full_preview);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  });
  
  // Update data
  data.slideshows = sorted.slice(0, keepCount);
  fs.writeFileSync(DATAFile, JSON.stringify(data, null, 2));
  
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