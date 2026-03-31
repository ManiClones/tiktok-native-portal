#!/usr/bin/env node
/**
 * Push Approved Slideshows to GitHub
 * 
 * Usage: 
 *   node scripts/push-approved.js approved [N]  - Push N approved slideshows
 *   node scripts/push-approved.js push          - Push to GitHub
 *   node scripts/push-approved.js clear [N]     - Keep only N newest
 *   node scripts/push-approved.js status         - Show portal status
 * 
 * This script:
 * 1. Takes approved slideshows from TikTok Generator
 * 2. Copies COMPOSITES (with text) for preview
 * 3. Copies RAW BACKGROUNDS (without text) for download
 * 4. Updates slideshows.json
 * 5. Commits and pushes to GitHub
 */

import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'public', 'api', 'slideshows.json');
const PUBLIC_SLIDESHOWS = path.join(ROOT_DIR, 'public', 'slideshows');
const PUBLIC_RAW = path.join(ROOT_DIR, 'public', 'raw-images');
// Support both Linux (server) and macOS (local) paths
const TIKTOK_GENERATOR = process.env.TIKTOK_GENERATOR_ROOT
  || (fs.existsSync('/home/node/.openclaw/workspace/coding/TikTokGenerator')
    ? '/home/node/.openclaw/workspace/coding/TikTokGenerator'
    : path.resolve(ROOT_DIR, '..', 'TikTokGenerator'));
const SQLITE_DB = path.join(TIKTOK_GENERATOR, 'data', 'slideshows.db');

// Ensure directories exist
[PUBLIC_SLIDESHOWS, PUBLIC_RAW].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Get all slideshow folders from TikTok Generator
 */
function getSlideshowFolders() {
  const folders = [];
  
  ['V1', 'V2', 'V3'].forEach(version => {
    const outputDir = path.join(TIKTOK_GENERATOR, version, 'output');
    if (!fs.existsSync(outputDir)) return;
    
    fs.readdirSync(outputDir, { withFileTypes: true }).forEach(item => {
      if (!item.isDirectory()) return;
      
      const folderPath = path.join(outputDir, item.name);
      const metaPath = path.join(folderPath, 'meta.json');
      
      if (fs.existsSync(metaPath)) {
        folders.push({
          id: item.name,
          version,
          path: folderPath,
          metaPath
        });
      }
    });
  });

  return folders.sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * Check if slideshow already exists in portal
 */
function isSlideshowInPortal(slideshowId) {
  if (!fs.existsSync(DATA_FILE)) return false;
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return data.slideshows.some(s => s.id === slideshowId);
}

/**
 * Check if meta.json uses the structured format (slides as objects)
 * vs the old Postiz format (slides as filename strings)
 */
function isStructuredFormat(meta) {
  if (!meta.slides || !Array.isArray(meta.slides) || meta.slides.length === 0) {
    return false;
  }
  return typeof meta.slides[0] === 'object';
}

function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buf).digest('hex');
}

function getSlideFiles(folderPath) {
  return fs.readdirSync(folderPath)
    .filter(f => f.match(/^slide_\d+\.jpg$/))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/slide_(\d+)\.jpg/)[1], 10);
      const bNum = parseInt(b.match(/slide_(\d+)\.jpg/)[1], 10);
      return aNum - bNum;
    });
}

function getRawFiles(folderPath) {
  const rawFolder = path.join(folderPath, 'raw');
  if (!fs.existsSync(rawFolder)) return [];
  return fs.readdirSync(rawFolder)
    .filter(f => f.match(/^raw_\d+\.jpg$/))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/raw_(\d+)\.jpg/)[1], 10);
      const bNum = parseInt(b.match(/raw_(\d+)\.jpg/)[1], 10);
      return aNum - bNum;
    })
    .map(f => path.join(rawFolder, f));
}

function rawFilesLookBroken(version, meta, folderPath, slideCount, options = {}) {
  const rawFiles = getRawFiles(folderPath);
  if (rawFiles.length !== slideCount) return true;

  // V3 intentionally reuses the same background for non-CTA slides
  if (version === 'V3') return false;

  const hashes = rawFiles.map(hashFile);
  const uniqueHashes = new Set(hashes);

  // Old V1 Postiz-style meta often lost per-slide source info and all raws collapsed to one image
  if ((!isStructuredFormat(meta) || options.recoveredFromDb) && uniqueHashes.size === 1 && slideCount > 1) {
    return true;
  }

  return false;
}

function parseRecoveredHookText(text, index) {
  const normalized = String(text || '').trim();
  if (!normalized) return { headline: '', subline: '' };

  const lines = normalized.split('\n');
  if (index === 0 && lines.length === 1) {
    return { headline: normalized, subline: '' };
  }

  return {
    headline: lines[0] || '',
    subline: lines.slice(1).join('\n').trim()
  };
}

function recoverSlidesFromDb(slideshowId) {
  if (!fs.existsSync(SQLITE_DB)) return null;

  const py = [
    'import json, sqlite3, sys',
    'db_path, slideshow_id = sys.argv[1], sys.argv[2]',
    'conn = sqlite3.connect(db_path)',
    'cur = conn.cursor()',
    'rows = cur.execute("SELECT text, order_index FROM hooks WHERE slideshow_id=? ORDER BY order_index ASC", (slideshow_id,)).fetchall()',
    'print(json.dumps([{"text": r[0], "order_index": r[1]} for r in rows], ensure_ascii=False))'
  ].join('\n');

  try {
    const out = execFileSync('python3', ['-c', py, SQLITE_DB, slideshowId], {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();

    const parsed = JSON.parse(out || '[]');
    return parsed;
  } catch {
    return null;
  }
}

function getMetaCandidates(folderPath) {
  return [
    path.join(folderPath, 'portal_meta.json'),
    path.join(folderPath, 'render_meta.json'),
    path.join(folderPath, 'meta.render.json'),
    path.join(folderPath, 'meta.json')
  ].filter(fs.existsSync);
}

function loadBestMeta(folder) {
  const candidates = getMetaCandidates(folder.path);

  for (const candidate of candidates) {
    try {
      const meta = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (isStructuredFormat(meta)) {
        return { meta, source: candidate, recoveredFromDb: false };
      }
    } catch {}
  }

  const metaPath = path.join(folder.path, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const recovered = recoverSlidesFromDb(folder.id);

  if (recovered && recovered.length > 0) {
    meta.slides = recovered.map((row, index) => {
      const parsed = parseRecoveredHookText(row.text, index);
      const isCta = /shortct|app/i.test(parsed.headline) && index > 0;
      return isCta
        ? { type: 'cta', label: parsed.headline, text: parsed.subline }
        : index === 0
          ? { type: 'hook', headline: parsed.headline }
          : { type: 'tip', label: parsed.headline, text: parsed.subline };
    });
    return { meta, source: `${metaPath} + db`, recoveredFromDb: true };
  }

  return { meta, source: metaPath, recoveredFromDb: false };
}

/**
 * Extract hook text from meta
 */
function extractHookText(meta) {
  // Structured format: slides are objects with type/headline
  if (isStructuredFormat(meta)) {
    const hookSlide = meta.slides.find(s => s.type === 'hook');
    if (hookSlide) {
      return hookSlide.headline || hookSlide.text || 'Untitled';
    }
    // If no hook type found, use first slide's text
    const first = meta.slides[0];
    return first.headline || first.text || first.header || 'Untitled';
  }

  // Old Postiz format: use caption field
  if (meta.caption) return meta.caption;
  if (meta.title) return meta.title;

  return 'Untitled';
}

/**
 * Extract text for a specific slide
 */
function extractSlideText(meta, slideIndex) {
  // Old Postiz format: slides are filename strings, no text available
  if (!isStructuredFormat(meta)) {
    // Try to get hook text from caption for first slide
    if (slideIndex === 0 && meta.caption) {
      return { headline: meta.caption, subline: '' };
    }
    return { headline: '', subline: '' };
  }

  if (!meta.slides[slideIndex]) {
    return { headline: '', subline: '' };
  }

  const slide = meta.slides[slideIndex];

  switch (slide.type) {
    case 'hook':
      return {
        headline: slide.headline || '',
        subline: ''
      };
    case 'transition':
      return {
        headline: slide.text || '',
        subline: ''
      };
    case 'methods':
      return {
        headline: (slide.methods || []).join('\n'),
        subline: ''
      };
    case 'cta':
      return {
        headline: slide.header || slide.label || '',
        subline: [slide.app_name, slide.description, slide.text].filter(Boolean).join(' — ')
      };
    case 'tip':
      return {
        headline: slide.label || '',
        subline: slide.text || ''
      };
    case 'steps':
      // V2 steps slide: concatenate all step headers and texts
      if (Array.isArray(slide.steps)) {
        const stepsText = slide.steps.map(s =>
          `${s.header || ''}\n${s.text || ''}`
        ).join('\n\n');
        return {
          headline: 'Study Steps',
          subline: stepsText
        };
      }
      return { headline: 'Steps', subline: '' };
    default:
      return {
        headline: slide.headline || slide.text || slide.header || '',
        subline: slide.description || ''
      };
  }
}

/**
 * Add a slideshow to the portal
 */
function addSlideshow(folder) {
  const { id, path: folderPath, metaPath } = folder;
  
  // Check if already in portal
  if (isSlideshowInPortal(id)) {
    console.log(`   ⏭️  Already in portal: ${id}`);
    return null;
  }
  
  // Load meta
  let meta;
  let metaInfo;
  try {
    metaInfo = loadBestMeta(folder);
    meta = metaInfo.meta;
  } catch (err) {
    console.log(`   ❌ Invalid meta.json: ${id}`);
    return null;
  }
  
  // Get slide count
  const slideFiles = getSlideFiles(folderPath);
  
  if (slideFiles.length === 0) {
    console.log(`   ❌ No slides found: ${id}`);
    return null;
  }
  
  const slideCount = slideFiles.length;
  console.log(`   📦 ${id} (${slideCount} slides)`);
  if (metaInfo?.source) {
    console.log(`      🧠 Meta source: ${path.basename(metaInfo.source)}`);
  }
  
  // Check for raw backgrounds
  const rawFolder = path.join(folderPath, 'raw');
  const hasRawBackgrounds = fs.existsSync(rawFolder);
  const shouldFallbackToComposite = rawFilesLookBroken(folder.version, meta, folderPath, slideCount, {
    recoveredFromDb: metaInfo?.recoveredFromDb
  });
  const useRealRaw = hasRawBackgrounds && !shouldFallbackToComposite;
  if (shouldFallbackToComposite) {
    console.log(`      ⚠️ Raw images look broken for portal use - falling back to composite images`);
  }
  
  // Extract hook text
  const hookText = extractHookText(meta);
  
  // Process each slide
  const slideRecords = [];
  
  slideFiles.forEach((slideFile, i) => {
    const slideNum = i + 1;
    
    // Copy composite (with text) for preview
    const compositeSrc = path.join(folderPath, slideFile);
    const compositeDest = path.join(PUBLIC_SLIDESHOWS, `${id}-slide-${i}.jpg`);
    fs.copyFileSync(compositeSrc, compositeDest);
    
    // Copy raw background if available
    let hasRaw = false;
    if (useRealRaw) {
      const rawSrc = path.join(rawFolder, `raw_${slideNum}.jpg`);
      const rawDest = path.join(PUBLIC_RAW, `${id}-slide-${i}.jpg`);
      
      if (fs.existsSync(rawSrc)) {
        fs.copyFileSync(rawSrc, rawDest);
        hasRaw = true;
      }
    }
    
    // If no raw, use composite as fallback
    if (!hasRaw) {
      const rawDest = path.join(PUBLIC_RAW, `${id}-slide-${i}.jpg`);
      fs.copyFileSync(compositeSrc, rawDest);
    }
    
    // Extract text
    const { headline, subline } = extractSlideText(meta, i);
    
    slideRecords.push({
      index: i,
      headline,
      subline,
      composite_image: `/slideshows/${id}-slide-${i}.jpg`,
      raw_image: `/raw-images/${id}-slide-${i}.jpg`,
      hasRaw
    });
    
    console.log(`      ✅ Slide ${slideNum}: ${hasRaw ? 'Raw ✓' : 'Composite only'}`);
  });
  
  // Create slideshow record
  const slideshowRecord = {
    id,
    created_at: new Date().toISOString(),
    hook: hookText,
    downloaded: false,
    slides: slideRecords,
    full_preview: `/slideshows/${id}-slide-0.jpg`,
    has_raw_backgrounds: slideRecords.some(slide => slide.hasRaw)
  };
  
  // Load existing data
  let data = { slideshows: [] };
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  
  // Add to beginning
  data.slideshows.unshift(slideshowRecord);
  
  // Save
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  console.log(`   ✅ Added: ${id}\n`);
  
  return slideshowRecord;
}

/**
 * Push multiple slideshows
 */
export function pushApprovedSlideshows(count = null) {
  console.log('\n🚀 Pushing approved slideshows to portal...\n');
  
  const folders = getSlideshowFolders();
  console.log(`📁 Found ${folders.length} slideshows\n`);
  
  const toProcess = count ? folders.slice(0, count) : folders;
  
  let added = 0;
  let skipped = 0;
  
  toProcess.forEach(folder => {
    const result = addSlideshow(folder);
    if (result) {
      added++;
    } else {
      skipped++;
    }
  });
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Added: ${added}`);
  console.log(`   ⏭️  Skipped: ${skipped}\n`);
  
  if (added > 0) {
    pushToGitHub(`Add ${added} slideshows to portal`);
  }
  
  return { added, skipped };
}

export function pushSlideshowById(slideshowId) {
  console.log(`\n🚀 Pushing slideshow by id: ${slideshowId}\n`);

  const folder = getSlideshowFolders().find(f => f.id === slideshowId);
  if (!folder) {
    console.log(`❌ Not found: ${slideshowId}`);
    return { added: 0, skipped: 0, found: false };
  }

  const result = addSlideshow(folder);
  if (result) {
    pushToGitHub(`Add slideshow ${slideshowId} to portal`);
    return { added: 1, skipped: 0, found: true };
  }

  return { added: 0, skipped: 1, found: true };
}

/**
 * Push to GitHub
 */
export function pushToGitHub(message = 'Update portal') {
  console.log('\n📤 Pushing to GitHub...\n');
  
  try {
    execSync('git add .', { cwd: ROOT_DIR, stdio: 'inherit' });
    
    try {
      execSync('git diff --cached --quiet', { cwd: ROOT_DIR, stdio: 'pipe' });
      console.log('   ℹ️  No changes to commit');
      return true;
    } catch {
      // There are changes
    }
    
    execSync(`git commit -m "${message}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT_DIR, stdio: 'inherit' });
    
    console.log('\n✅ Pushed to GitHub!\n');
    return true;
  } catch (err) {
    console.error('❌ Push failed:', err.message);
    return false;
  }
}

/**
 * Clear old slideshows
 */
export function clearOldSlideshows(keepCount = 20) {
  if (!fs.existsSync(DATA_FILE)) return;
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (data.slideshows.length <= keepCount) return;
  
  console.log(`\n🧹 Cleaning up (keeping ${keepCount} newest)...\n`);
  
  const sorted = [...data.slideshows].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  
  const toRemove = sorted.slice(keepCount);
  
  toRemove.forEach(slideshow => {
    slideshow.slides.forEach(slide => {
      const compPath = path.join(ROOT_DIR, 'public', slide.composite_image);
      const rawPath = path.join(ROOT_DIR, 'public', slide.raw_image);
      
      if (fs.existsSync(compPath)) fs.unlinkSync(compPath);
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    });
  });
  
  data.slideshows = sorted.slice(0, keepCount);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  console.log(`✅ Removed ${toRemove.length} old slideshows\n`);
}

/**
 * Show status
 */
export function showStatus() {
  console.log('\n📊 TikTok Native Portal Status\n');
  
  if (!fs.existsSync(DATA_FILE)) {
    console.log('   No slideshows');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`   Total: ${data.slideshows.length} slideshows\n`);
  
  data.slideshows.slice(0, 5).forEach((s, i) => {
    const date = new Date(s.created_at).toLocaleDateString();
    const rawCount = s.slides.filter(sl => sl.hasRaw).length;
    console.log(`   ${i + 1}. ${s.id}`);
    console.log(`      ${s.slides.length} slides | ${rawCount} raw | ${date}`);
    console.log(`      "${s.hook.substring(0, 50)}..."`);
  });
  
  if (data.slideshows.length > 5) {
    console.log(`\n   ... and ${data.slideshows.length - 5} more`);
  }
}

// CLI
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  
  switch (args[0]) {
    case 'push':
      pushToGitHub();
      break;
    case 'clear':
      clearOldSlideshows(parseInt(args[1]) || 20);
      break;
    case 'approved':
      pushApprovedSlideshows(args[1] ? parseInt(args[1]) : null);
      break;
    case 'one':
      pushSlideshowById(args[1]);
      break;
    case 'status':
      showStatus();
      break;
    default:
      console.log(`
Usage:
  node scripts/push-approved.js approved [N]  - Push N slideshows (default: all)
  node scripts/push-approved.js one <id>      - Push a specific slideshow id
  node scripts/push-approved.js push          - Push to GitHub only
  node scripts/push-approved.js clear [N]     - Keep N newest (default: 20)
  node scripts/push-approved.js status         - Show status
      `);
  }
}

export default {
  pushApprovedSlideshows,
  pushSlideshowById,
  pushToGitHub,
  clearOldSlideshows,
  showStatus
};
