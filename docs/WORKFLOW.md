# TikTok Native Portal - Workflow

## Konzept

**Problem:** TikTok API Uploads landen in Drafts = schlechter Algorithmus-Score
**Lösung:** Semi-manueller Workflow - Bilder + Texte generieren, aber nativ in TikTok App posten

---

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. TIKTOK SLIDESHOW GENERATOR (PHNTM)                      │
│     - Generiert Slides mit Pinterest Backgrounds            │
│     - Texte: Hook + Headlines + Sublines                    │
│     - Output: Raw Images + Composite Images                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. APPROVAL (MANI)                                         │
│     - Mani reviewed generated slideshows                    │
│     - Sagt PHNTM: "Schick die letzten approved zum Portal"  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. PUSH TO GITHUB (PHNTM)                                  │
│     - Copies images to public/                              │
│     - Updates data/slideshows.json                          │
│     - Git commit + push                                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. VERCEL DEPLOYMENT (Auto)                                │
│     - Vercel detected push                                  │
│     - Deploys new version automatically                     │
│     - URL: https://tiktok-portal.vercel.app                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. NATIVE UPLOAD (MANI auf TikTok Handy)                   │
│     - Öffnet Portal im Handy-Browser                        │
│     - Downloaded Raw Images (für TikTok Upload)             │
│     - Kopiert Texte per Copy-Button                         │
│     - Uploaded nativ in TikTok App                          │
│     - Nutzt TikTos Text-Generator für besseren Reach        │
└─────────────────────────────────────────────────────────────┘
```

---

## Dateistruktur
```
tiktok-native-portal/
├── public/
│   ├── index.html          # Main UI
│   ├── styles.css          # Mobile-first styles
│   ├── app.js              # Frontend logic
│   ├── api/
│   │   └── slideshows.json # Slideshow data (git-tracked)
│   ├── slideshows/         # Composite images (with text)
│   │   └── {id}-slide-0.png
│   │   └── {id}-full.png
│   └── raw-images/         # ⚠️ Same as slideshows (composites have text burned in)
│       └── {id}-slide-0.png
├── scripts/
│   └── push-approved.js    # Push script + helpers
├── docs/
│   ├── WORKFLOW.md
│   ├── TUTORIAL.md
│   └── PHNTM-INTEGRATION.md
├── package.json
└── vercel.json
```

> **Note:** Raw images currently contain the composite images (with text burned in). TikTok Generator doesn't store separate raw backgrounds. This is a known limitation - the UI shows a warning to users.

---

## Mobile UI Features

1. **Slideshow Cards** - Timestamp + Badge (New/Downloaded)
2. **Download Buttons:**
   - Full Preview - Composite mit Text (für Referenz)
   - Raw Images - Nur Backgrounds (für TikTok Upload)
3. **Expandable Text Section:**
   - Pro Slide: Headline + Subline
   - Copy-Button für jedes Text-Feld
4. **LocalStorage:**
   - Merkt sich welche Slideshows already downloaded

---

## PHNTM Integration

Wenn Mani approved slideshows pushen will:

```javascript
import { addSlideshow, pushToGitHub } from './scripts/push-approved.js';

// Slideshow hinzufügen
addSlideshow({
  id: 'slideshow-2026-03-30-001',
  hook: 'Your hook text here',
  slides: [
    {
      headline: 'Headline 1',
      subline: 'Subline 1',
      raw_image_path: '/path/to/raw-1.png',
      composite_image_path: '/path/to/composite-1.png'
    },
    // ... more slides
  ],
  fullPreviewPath: '/path/to/full-preview.png'
});

// Push to GitHub
pushToGitHub('Add approved slideshows');
```

---

## Warum Semi-Manual?

1. **Besserer Algorithmus-Score** - Native Uploads werden bevorzugt
2. **TikTok Text-Generator** - Native Texte = bessere Formatierung
3. **Authentizität** - Frischer Account wirkt organisch
4. **Flexibilität** - Letzte Anpassungen direkt in TikTok möglich

---

## Vercel Setup

1. Repo auf GitHub erstellen
2. Vercel: Import Project → GitHub Repo wählen
3. Build Settings:
   - Framework: Other
   - Build Command: (leer)
   - Output Directory: `public`
4. Deploy!
5. Custom Domain optional

---

Created: 2026-03-30
