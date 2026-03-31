#!/usr/bin/env node
/**
 * Push Approved Slideshows to GitHub
 * 
 * Usage: npm run push
 * 
 * This script:
 * 1. Takes new approved slideshows from PHNTM
 * 2. Copies images to public folders
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

// Ensure directories exist
[PUBLIC_SLIDESHOWS, PUBLIC_RAW].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Add a new slideshow to the portal
 * Call this from PHNTM when Mani approves
 */
export function addSlideshow(slideshowData) {
  const {
    id,
    hook,
    slides, // [{ headline, subline, raw_image_path, composite_image_path }]
    fullPreviewPath
  } = slideshowData;

  // Load existing data
  let data = { slideshows: [] };
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  // Copy images to public folders
  const slideRecords = slides.map((slide, i) => {
    const rawDest = path.join(PUBLIC_RAW, `${id}-slide-${i}.png`);
    const compDest = path.join(PUBLIC_SLIDESHOWS, `${id}-slide-${i}.png`);

    // Copy raw background
    if (fs.existsSync(slide.raw_image_path)) {
      fs.copyFileSync(slide.raw_image_path, rawDest);
    }

    // Copy composite (with text)
    if (fs.existsSync(slide.composite_image_path)) {
      fs.copyFileSync(slide.composite_image_path, compDest);
    }

    return {
      index: i,
      headline: slide.headline,
      subline: slide.subline,
      raw_image: `/raw-images/${id}-slide-${i}.png`,
      composite_image: `/slideshows/${id}-slide-${i}.png`
    };
  });

  // Copy full preview
  const fullPreviewDest = path.join(PUBLIC_SLIDESHOWS, `${id}-full.png`);
  if (fullPreviewPath && fs.existsSync(fullPreviewPath)) {
    fs.copyFileSync(fullPreviewPath, fullPreviewDest);
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
  data.slideshows.push(newSlideshow);

  // Save
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`✅ Added slideshow: ${id}`);
  return newSlideshow;
}

/**
 * Push to GitHub
 */
export function pushToGitHub(commitMessage = 'Update slideshows') {
  try {
    execSync('git add .', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync(`git commit -m "${commitMessage}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ Pushed to GitHub');
    return true;
  } catch (error) {
    console.error('❌ Git push failed:', error.message);
    return false;
  }
}

/**
 * Clear old slideshows (optional cleanup)
 */
export function clearOldSlideshows(keepCount = 20) {
  let data = { slideshows: [] };
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  if (data.slideshows.length <= keepCount) return;

  // Sort by date, keep newest
  const sorted = data.slideshows.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  const toRemove = sorted.slice(keepCount);
  
  // Remove files
  toRemove.forEach(slideshow => {
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
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`🧹 Cleaned up ${toRemove.length} old slideshows`);
}

// CLI usage
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'push') {
    pushToGitHub();
  } else if (args[0] === 'clear') {
    clearOldSlideshows(parseInt(args[1]) || 20);
  } else {
    console.log(`
Usage:
  node scripts/push-approved.js push     - Push to GitHub
  node scripts/push-approved.js clear N  - Keep only N newest slideshows
    `);
  }
}

export default { addSlideshow, pushToGitHub, clearOldSlideshows };
