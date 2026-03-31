# TikTok Native Portal

Semi-manual TikTok slideshow upload portal for better algorithm reach.

## Why Semi-Manual?

- **Native Uploads = Better Reach** - TikTok algorithm favors native uploads
- **TikTok Text Generator** - Use TikTok's native text formatting
- **Fresh Account Protection** - Keep authentic posting behavior
- **Flexibility** - Make last-minute adjustments in TikTok app

## Features

- 📱 **Mobile-First UI** - Optimized for TikTok phones
- 📥 **One-Tap Downloads** - Raw images + full previews
- 📋 **Copy Buttons** - Easy text copying per slide
- 🏷️ **Download Tracking** - localStorage remembers what you've downloaded
- ⚡ **Vercel Deployment** - Instant deploys on git push
- 🚀 **Bulk Push** - Push multiple approved slideshows at once

## Quick Start

```bash
# Install dependencies (optional, for scripts)
npm install

# Serve locally
npx serve public

# Push to GitHub
npm run deploy
```

## Structure

```
public/
├── index.html          # Main UI
├── styles.css          # Mobile styles
├── app.js              # Frontend logic
├── slideshows/         # Composite images
└── raw-images/         # Raw backgrounds

data/
└── slideshows.json     # Slideshow data

scripts/
└── push-approved.js    # PHNTM push script
```

## Limitations

⚠️ **Raw Images contain text** - TikTok Generator doesn't store separate raw backgrounds. All images have text burned in.

**Workaround:**
- Use "Download All" button to get all images
- In TikTok: Upload first slide,- Use TikTok's native text tool to overlay new text
- Copy text from Portal's text section

## Docs

- [WORKFLOW.md](docs/WORKFLOW.md) - Full workflow explanation
- [TUTORIAL.md](docs/TUTORIAL.md) - Setup & usage guide
- [PHNTM-INTEGRATION.md](docs/PHNTM-INTEGRATION.md) - Commands for PHNTM

---

Created by PHNTM | 2026-03-30
