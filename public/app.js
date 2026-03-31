// TikTok Native Portal - App.js
// Semi-manual upload workflow

const API = {
  // In production, this serves from Vercel
  // Data is fetched directly from static JSON
  slideshowsUrl: '/api/slideshows.json'
};

// State
let slideshows = [];
let downloadedStates = {};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSlideshows();
  renderSlideshows();
  setupEventListeners();
}

async function loadSlideshows() {
  try {
    const response = await fetch(API.slideshowsUrl + '?t=' + Date.now());
    const data = await response.json();
    slideshows = data.slideshows || [];
    
    // Load downloaded states from localStorage
    const saved = localStorage.getItem('tiktok-portal-downloaded');
    downloadedStates = saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load slideshows:', error);
    showError('Fehler beim Laden der Slideshows');
  }
}

function renderSlideshows() {
  const container = document.getElementById('slideshows-container');
  
  if (slideshows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>Keine Slideshows vorhanden</p>
      </div>
    `;
    return;
  }

  // Sort by date (newest first)
  const sorted = [...slideshows].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  container.innerHTML = sorted.map(slideshow => renderSlideshowCard(slideshow)).join('');
}

function renderSlideshowCard(slideshow) {
  const isDownloaded = downloadedStates[slideshow.id];
  const timestamp = formatTimestamp(slideshow.created_at);
  const badgeText = isDownloaded ? '✓ Downloaded' : 'New';
  
  return `
    <div class="slideshow-card" data-id="${slideshow.id}">
      <div class="card-header">
        <span class="timestamp">${timestamp}</span>
        <span class="badge ${isDownloaded ? 'downloaded' : ''}">${badgeText}</span>
      </div>
      
      <div class="card-body">
        <div class="hook-preview">"${escapeHtml(slideshow.hook)}"</div>
        
        <div class="preview-container">
          <img class="full-preview" 
               src="${slideshow.full_preview}" 
               alt="Slideshow Preview"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🖼️</text></svg>'">
        </div>
        
        <div class="download-buttons">
          <button class="btn btn-download-full" data-action="download-full" data-id="${slideshow.id}">
            📥 Full Preview
          </button>
          <button class="btn btn-download-raw" data-action="download-raw" data-id="${slideshow.id}">
            🖼️ Raw Images
          </button>
        </div>
      </div>

      <div class="expand-toggle">
        <button class="btn-expand" data-action="toggle-expand" data-id="${slideshow.id}">
          <span class="expand-text">▼ Texte anzeigen</span>
        </button>
      </div>

      <div class="slides-container hidden" data-slides="${slideshow.id}">
        ${slideshow.slides.map((slide, i) => renderSlide(slide, i)).join('')}
      </div>
    </div>
  `;
}

function renderSlide(slide, index) {
  return `
    <div class="slide-item" data-index="${index}">
      <div class="slide-header">Slide <span class="slide-num">${index + 1}</span></div>
      <div class="slide-content">
        <div class="text-row">
          <label>Headline:</label>
          <div class="text-value headline-text">${escapeHtml(slide.headline)}</div>
          <button class="btn-copy" data-action="copy-headline" data-text="${escapeAttr(slide.headline)}">📋</button>
        </div>
        <div class="text-row">
          <label>Subline:</label>
          <div class="text-value subline-text">${escapeHtml(slide.subline)}</div>
          <button class="btn-copy" data-action="copy-subline" data-text="${escapeAttr(slide.subline)}">📋</button>
        </div>
      </div>
    </div>
  `;
}

function setupEventListeners() {
  document.getElementById('slideshows-container').addEventListener('click', handleAction);
}

function handleAction(e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  switch (action) {
    case 'download-full':
      downloadFullPreview(id);
      break;
    case 'download-raw':
      downloadRawImages(id);
      break;
    case 'toggle-expand':
      toggleExpand(id, btn);
      break;
    case 'copy-headline':
    case 'copy-subline':
      copyToClipboard(btn.dataset.text, btn);
      break;
  }
}

function downloadFullPreview(slideshowId) {
  const slideshow = slideshows.find(s => s.id === slideshowId);
  if (!slideshow) return;

  // Create download link
  const link = document.createElement('a');
  link.href = slideshow.full_preview;
  link.download = `${slideshowId}-full-preview.png`;
  link.click();

  markAsDownloaded(slideshowId);
  showToast('Preview heruntergeladen!');
}

function downloadRawImages(slideshowId) {
  const slideshow = slideshows.find(s => s.id === slideshowId);
  if (!slideshow) return;

  // Download each raw image
  slideshow.slides.forEach((slide, i) => {
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = slide.raw_image;
      link.download = `${slideshowId}-slide-${i + 1}-raw.png`;
      link.click();
    }, i * 300); // Stagger downloads
  });

  markAsDownloaded(slideshowId);
  showToast(`${slideshow.slides.length} Raw Images heruntergeladen!`);
}

function toggleExpand(slideshowId, btn) {
  const container = document.querySelector(`[data-slides="${slideshowId}"]`);
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  container.classList.toggle('hidden');
  
  const textSpan = btn.querySelector('.expand-text');
  textSpan.textContent = isHidden ? '▲ Texte ausblenden' : '▼ Texte anzeigen';
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    // Visual feedback
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
    showToast('Kopiert!');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Kopiert!');
  });
}

function markAsDownloaded(slideshowId) {
  downloadedStates[slideshowId] = true;
  localStorage.setItem('tiktok-portal-downloaded', JSON.stringify(downloadedStates));
  
  // Update UI
  const badge = document.querySelector(`[data-id="${slideshowId}"] .badge`);
  if (badge) {
    badge.textContent = '✓ Downloaded';
    badge.classList.add('downloaded');
  }
}

function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

function showError(message) {
  const container = document.getElementById('slideshows-container');
  container.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// Helpers
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
