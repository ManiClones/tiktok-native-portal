# TikTok Native Portal - PHNTM Integration

## Wie PHNTM Slideshows hinzufügt

Wenn Mani sagt: "Schick die approved Slideshows zum Portal"

### Schritt 1: Slideshow Daten sammeln

```javascript
const newSlideshow = {
  id: `slideshow-${Date.now()}`,
  hook: "Der Hook Text",
  slides: [
    {
      headline: "Slide 1 Headline",
      subline: "Slide 1 Subline", 
      raw_image_path: "/path/to/raw-slide-0.png",
      composite_image_path: "/path/to/composite-slide-0.png"
    },
    // ... more slides
  ],
  fullPreviewPath: "/path/to/full-preview.png"
};
```

### Schritt 2: Slideshow hinzufügen

```bash
cd /home/node/.openclaw/workspace/coding/tiktok-native-portal

node -e "
import { addSlideshow } from './scripts/push-approved.js';
addSlideshow({
  id: 'slideshow-001',
  hook: 'Test Hook',
  slides: [
    {
      headline: 'Headline 1',
      subline: 'Subline 1',
      raw_image_path: '/path/to/raw.png',
      composite_image_path: '/path/to/comp.png'
    }
  ],
  fullPreviewPath: '/path/to/full.png'
});
"
```

### Schritt 3: Push to GitHub

```bash
cd /home/node/.openclaw/workspace/coding/tiktok-native-portal
git add .
git commit -m "Add approved slideshows"
git push
```

### Schritt 4: Mani informieren

> ✅ Slideshows deployed! Öffne https://dein-portal.vercel.app auf dem TikTok Handy

---

## Integration mit TikTok Generator

Wenn TikTok Generator neue Slideshows erstellt:

1. Generator speichert in `coding/TikTok/output/`
2. PHNTM liest die approved Slideshows
3. Kopiert images + texts ins Portal
4. Push zu GitHub
5. Vercel deployed automatisch

---

## Commands für Mani

| Command | Was passiert |
|---------|--------------|
| "Schick approved zum Portal" | PHNTM pusht alle approved Slideshows |
| "Push zum GitHub" | Git commit + push |
| "Zeig Portal Status" | Zeigt Anzahl Slideshows + letzte Updates |
| "Räum alte auf" | Löscht Slideshows älter als X |

---

Created: 2026-03-30
