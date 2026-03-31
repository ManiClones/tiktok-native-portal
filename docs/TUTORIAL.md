# TikTok Native Portal - Tutorial für Mani

## 🚀 Quick Start

### 1. GitHub Repo erstellen

```bash
# In tiktok-native-portal Ordner
cd /home/node/.openclaw/workspace/coding/tiktok-native-portal

# Git initialisieren
git init
git add .
git commit -m "Initial commit - TikTok Native Portal"

# GitHub Repo erstellen und pushen
gh repo create tiktok-native-portal --public --source=. --push
```

### 2. Vercel Deployment

1. Gehe zu [vercel.com](https://vercel.com)
2. "Import Project" → "Import Git Repository"
3. Wähle dein GitHub Repo `tiktok-native-portal`
4. Settings:
   - **Framework Preset:** Other
   - **Build Command:** (leer lassen)
   - **Output Directory:** `public`
5. "Deploy" klicken
6. Warte bis deployed
7. URL kopieren (z.B. `https://tiktok-native-portal.vercel.app`)

### 3. Domain (Optional)

In Vercel Dashboard:
1. Settings → Domains
2. Custom Domain hinzufügen (z.B. `slides.mani.com`)
3. DNS bei Provider eintragen

---

## 📱 Workflow: Slideshows deployen

### PHNTM sagen:

> "Schick die letzten approved Slideshows zum Portal"

PHNTM macht dann:
1. Images in `public/` Ordner kopieren
2. `data/slideshows.json` updaten
3. Git commit + push
4. Vercel deployed automatisch

### Auf dem Handy:

1. **Portal öffnen** (Vercel URL)
2. **Slideshow auswählen**
3. **"Raw Images"** klicken → Bilder herunterladen
4. **"▼ Texte anzeigen"** klicken → Expand
5. **TikTok App öffnen** → Slideshow erstellen
6. **Bilder hochladen** (aus Camera Roll / Downloads)
7. **Texte kopieren** aus Portal:
   - Headline Copy-Button
   - Subline Copy-Button
8. **In TikTok einfügen** mit TikTok Text-Generator
9. **Posten!**

---

## 🔧 PHNTM Commands

### Neue Slideshow hinzufügen

Wenn du aus dem TikTok Generator approved content hast:

```
PHNTM: Füge diese Slideshow zum Portal hinzu:
- Hook: "Dein Hook"
- Slides: [headline, subline, image paths...]
```

### Push to GitHub

```
PHNTM: Push die Änderungen zu GitHub
```

### Alte Slideshows löschen

```
PHNTM: Räum alte Slideshows auf, behalte nur die letzten 20
```

---

## 📂 File Locations

| Was | Wo |
|-----|-----|
| Mobile UI | `public/index.html` |
| Styles | `public/styles.css` |
| Frontend Logic | `public/app.js` |
| Slideshow Data | `data/slideshows.json` |
| Composite Images | `public/slideshows/*.png` |
| Raw Images | `public/raw-images/*.png` |

---

## ⚡ Tips

1. **Bookmarke** die Vercel URL auf dem TikTok Handy
2. **Raw Images** = Was du in TikTok hochlädst
3. **Full Preview** = Nur zur visuellen Referenz
4. **Copy Buttons** funktionieren auch ohne Internet
5. **LocalStorage** merkt sich was du gedownloadet hast

---

## 🐛 Troubleshooting

### "Keine Slideshows vorhanden"
→ PHNTM hat noch nichts gepusht. Sag: "Push approved slideshows"

### "Bilder laden nicht"
→ Check ob Images in `public/` Ordner existieren

### "Git push failed"
→ 
```bash
git status
git add .
git commit -m "Fix"
git push
```

---

Created: 2026-03-30
