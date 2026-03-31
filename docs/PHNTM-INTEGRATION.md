# TikTok Native Portal - PHNTM Integration

## Quick Commands

| Command | Was passiert |
|---------|--------------|
| "Push approved slideshows" | PHNTM pusht alle approved Slideshows aus dem TikTok Generator zum Portal |
| "Push approved 5" | PHNTM pusht die letzten 5 approved Slideshows |
| "Push zum GitHub" | Git commit + push (manuell) |
| "Zeig Portal Status" | Zeigt Anzahl Slideshows + letzte Updates |
| "Räum alte auf" | Löscht Slideshows älter als X (keep 20 newest) |

---

## Automatischer Workflow

Wenn Mani sagt: **"Push approved slideshows"** (oder **"Push approved 1"** etc.)

### Was PHNTM macht:

1. **Sucht approved Slideshows** im TikTok Generator Output
2. **Extrahiert Texte** aus meta.json
3. **Kopiert Bilder** ins Portal
4. **Aktualisiert slideshows.json**
5. **Pushed zu GitHub**
6. **Vercel deployed automatisch**

---

## Beispiel: "Push approved 1"

```bash
cd /home/node/.openclaw/workspace/coding/tiktok-native-portal
node scripts/push-approved.js approved 1
```

Output:
```
📋 Fetching approved slideshows from TikTok Generator...
   Found 45 approved slideshows

📦 Processing 1 slideshows...

[1/1] Processing v3_20260326_024506_05...
   ✅ Extracted hook: "When the professor says the exam covers everything..."
   ✅ Extracted 4 slides
   ✅ Copied raw image: slide-0.png
   ✅ Copied composite image: slide-0.png
   ✅ Copied raw image: slide-1.png
   ✅ Copied composite image: slide-1.png
   ✅ Copied raw image: slide-2.png
   ✅ Copied composite image: slide-2.png
   ✅ Copied raw image: slide-3.png
   ✅ Copied composite image: slide-3.png
   💾 Updated slideshows.json

📊 Results:
   ✅ Pushed: 1
   ❌ Failed: 0

🚀 Pushing to GitHub...
   ✅ Pushed to GitHub
```

---

## Bekannte Limitierung

⚠️ **Raw Images enthalten Text**

Die TikTok Generator Slides haben bereits Text "burned in" (keine separaten Raw Backgrounds verfügbar).

**Workaround:**
- Raw Images im Portal = Composite Images (mit Text)
- UI zeigt Warnung an: "Raw images contain text - crop or use carefully"
- Mani kann:
  1. Raw Images downloaden
  2. In TikTok hochladen
  3. Texte aus Portal kopieren
  4. TikTok Text-Generator nutzen um Text zu überlagern

**Lösung für später:**
- TikTok Generator erweitern, um separate raw backgrounds zu speichern
- Oder: Raw backgrounds aus Pinterest separat laden

---

## Integration mit TikTok Generator

Der TikTok Generator speichert Slideshows in:
```
coding/TikTokGenerator/
├── V1/output/{id}/
├── V2/output/{id}/
├── V3/output/{id}/
    ├── meta.json          <- Text content
    ├── slide_1.jpg         <- Composite (with text)
    ├── slide_2.jpg
    ├── slide_3.jpg
    └── slide_4.jpg
```

Das `push-approved.js` Script:
- Scannt alle Version directories (V1, V2, V3)
- Liest `meta.json` für Text content
- Extrahiert Hook + Slides
- Mappt TikTok Generator slide types zu Portal format
- Kopiert images + updated JSON
- Pushed zu GitHub

---

Created: 2026-03-30
