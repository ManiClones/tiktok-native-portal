// TikTok Native Portal - App.js
// Semi-manual upload workflow - Mobile optimized

const API = {
  slideshowsUrl: '/api/slideshows.json'
};

let slideshows = [];
let downloadedStates = {};
let deletedIds = {};
let currentSlideIndexes = {}; // Track current slide for each slideshow

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
    
    const saved = localStorage.getItem('tiktok-portal-downloaded');
    downloadedStates = saved ? JSON.parse(saved) : {};
    
    const deleted = localStorage.getItem('tiktok-portal-deleted');
    deletedIds = deleted ? JSON.parse(deleted) : {};
  } catch (error) {
    console.error('Failed to load slideshows:', error);
    showError('Fehler beim Laden der Slideshows');
  }
}

function renderSlideshows() {
  const container = document.getElementById('slideshows-container');
  
  // Filter out deleted slideshows
  const visibleSlideshows = slideshows.filter(s => !deletedIds[s.id]);
  
  if (visibleSlideshows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>Keine Slideshows vorhanden</p>
        ${Object.keys(deletedIds).length > 0 ? '<button class="btn btn-restore" data-action="restore-all">🗑️ Gelöschte wiederherstellen</button>' : ''}
      </div>
    `;
    return;
  }

  const sorted = [...visibleSlideshows].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  container.innerHTML = sorted.map(slideshow => {
    const isDownloaded = downloadedStates[slideshow.id];
    const timestamp = formatTimestamp(slideshow.created_at);
    const badgeText = isDownloaded ? '✓ Downloaded' : 'New';
    const slideCount = slideshow.slides ? slideshow.slides.length : 0;
    const hasRealRaw = slideshow.slides && slideshow.slides.some(s => s.hasRaw);
    
    return `
    <div class="slideshow-card" data-id="${slideshow.id}">
      <div class="card-header">
        <span class="timestamp">${timestamp}</span>
        <div class="header-actions">
          <span class="badge ${isDownloaded ? 'downloaded' : ''}">${badgeText}</span>
          <button class="btn-delete" data-action="delete" data-id="${slideshow.id}" title="Löschen">🗑️</button>
        </div>
      </div>
      
      <div class="card-body">
        <div class="hook-preview">"${escapeHtml(slideshow.hook)}"</div>
        
        <!-- INTERACTIVE PREVIEW SWIPER -->
        <div class="preview-swiper" data-slideshow="${slideshow.id}">
          <div class="swiper-container" data-slideshow="${slideshow.id}">
            ${slideshow.slides ? slideshow.slides.map((slide, i) => `
              <div class="swiper-slide" data-index="${i}">
                <img src="${slide.composite_image}" alt="Slide ${i+1}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🖼️</text></svg>'">
              </div>
            `).join('') : ''}
          </div>
          <div class="swiper-nav">
            <button class="swiper-btn swiper-prev" data-action="swiper-prev" data-id="${slideshow.id}">‹</button>
            <span class="swiper-counter">
              <span class="current-slide">1</span> / ${slideCount}
            </span>
            <button class="swiper-btn swiper-next" data-action="swiper-next" data-id="${slideshow.id}">›</button>
          </div>
          <div class="swiper-dots">
            ${slideshow.slides ? slideshow.slides.map((_, i) => `
              <span class="swiper-dot ${i === 0 ? 'active' : ''}" data-index="${i}" data-slideshow="${slideshow.id}"></span>
            `).join('') : ''}
          </div>
        </div>
        
        <div class="info-bar">
          <span class="slide-count">📸 ${slideCount} Slides</span>
          ${hasRealRaw ? '<span class="raw-badge">✓ Raw</span>' : ''}
        </div>

        <div class="download-buttons">
          <button class="btn btn-download-all" data-action="download-all" data-id="${slideshow.id}">
            📥 Download All Raw
          </button>
        </div>
      </div>

      <div class="expand-toggle">
        <button class="btn-expand" data-action="toggle-expand" data-id="${slideshow.id}">
          <span class="expand-text">▼ Raw Slides & Texte</span>
        </button>
      </div>

      <div class="slides-container hidden" data-slides="${slideshow.id}">
        ${slideshow.slides ? slideshow.slides.map((slide, i) => renderSlide(slide, i, slideshow.id, hasRealRaw)).join('') : ''}
      </div>
    </div>
    `;
  }).join('');
  
  // Initialize swiper states
  slideshows.forEach(s => {
    currentSlideIndexes[s.id] = 0;
  });
}

function renderSlide(slide, index, slideshowId, hasRealRaw) {
  const downloadLabel = hasRealRaw ? '📥 Raw' : '📥 Image';
  
  return `
    <div class="slide-item" data-index="${index}">
      <div class="slide-header">
        <span class="slide-num">Slide ${index + 1}</span>
      </div>
      
      <div class="slide-preview-container">
        <img class="slide-preview-img" 
             src="${slide.raw_image}" 
             alt="Slide ${index + 1}"
             onerror="this.style.display='none'">
      </div>
      
      <div class="slide-content">
        <div class="text-row">
          <label>Headline:</label>
          <div class="text-value headline-text">${escapeHtml(slide.headline)}</div>
          <button class="btn-copy" data-action="copy-headline" data-text="${escapeAttr(slide.headline)}">📋</button>
        </div>
        ${slide.subline ? `
        <div class="text-row">
          <label>Subline:</label>
          <div class="text-value subline-text">${escapeHtml(slide.subline)}</div>
          <button class="btn-copy" data-action="copy-subline" data-text="${escapeAttr(slide.subline)}">📋</button>
        </div>
        ` : ''}
      </div>
      
      <div class="slide-download">
        <button class="btn btn-download-slide" data-action="download-raw-slide" data-id="${slideshowId}" data-slide="${index}" data-url="${slide.raw_image}">
          ${downloadLabel}
        </button>
      </div>
    </div>
  `;
}

function setupEventListeners() {
  document.getElementById('slideshows-container').addEventListener('click', handleAction);
  
  // Touch swipe for swipers
  setupSwipeGestures();
}

function setupSwipeGestures() {
  document.querySelectorAll('.swiper-container').forEach(container => {
    let touchStartX = 0;
    let touchEndX = 0;
    
    container.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    container.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe(container, touchStartX, touchEndX);
    }, { passive: true });
  });
}

function handleSwipe(container, startX, endX) {
  const threshold = 50;
  const diff = startX - endX;
  
  if (Math.abs(diff) < threshold) return;
  
  const slideshowId = container.dataset.slideshow;
  
  if (diff > 0) {
    // Swipe left - next
    swiperGoTo(slideshowId, 'next');
  } else {
    // Swipe right - prev
    swiperGoTo(slideshowId, 'prev');
  }
}

function handleAction(e) {
  const btn = e.target.closest('button');
  const dot = e.target.closest('.swiper-dot');
  
  if (dot) {
    const slideshowId = dot.dataset.slideshow;
    const index = parseInt(dot.dataset.index);
    swiperGoToSlide(slideshowId, index);
    return;
  }
  
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const slideIndex = btn.dataset.slide;
  const url = btn.dataset.url;

  switch (action) {
    case 'download-all':
      downloadAllRaw(id);
      break;
    case 'download-raw-slide':
      downloadRawSlide(id, slideIndex, url);
      break;
    case 'toggle-expand':
      toggleExpand(id, btn);
      break;
    case 'copy-headline':
    case 'copy-subline':
      copyToClipboard(btn.dataset.text, btn);
      break;
    case 'swiper-prev':
      swiperGoTo(id, 'prev');
      break;
    case 'swiper-next':
      swiperGoTo(id, 'next');
      break;
    case 'delete':
      deleteSlideshow(id);
      break;
    case 'restore-all':
      restoreAllDeleted();
      break;
  }
}

function swiperGoTo(slideshowId, direction) {
  const slideshow = slideshows.find(s => s.id === slideshowId);
  if (!slideshow || !slideshow.slides) return;
  
  let currentIndex = currentSlideIndexes[slideshowId] || 0;
  const total = slideshow.slides.length;
  
  if (direction === 'next') {
    currentIndex = (currentIndex + 1) % total;
  } else {
    currentIndex = (currentIndex - 1 + total) % total;
  }
  
  swiperGoToSlide(slideshowId, currentIndex);
}

function swiperGoToSlide(slideshowId, index) {
  const slideshow = slideshows.find(s => s.id === slideshowId);
  if (!slideshow || !slideshow.slides) return;
  
  currentSlideIndexes[slideshowId] = index;
  
  // Update slides position
  const container = document.querySelector(`.swiper-container[data-slideshow="${slideshowId}"]`);
  if (container) {
    container.style.transform = `translateX(-${index * 100}%)`;
  }
  
  // Update counter
  const counter = document.querySelector(`.preview-swiper[data-slideshow="${slideshowId}"] .current-slide`);
  if (counter) {
    counter.textContent = index + 1;
  }
  
  // Update dots
  document.querySelectorAll(`.swiper-dot[data-slideshow="${slideshowId}"]`).forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

function downloadAllRaw(slideshowId) {
  const slideshow = slideshows.find(s => s.id === slideshowId);
  if (!slideshow || !slideshow.slides) return;

  // Download each raw image with stagger
  slideshow.slides.forEach((slide, i) => {
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = slide.raw_image;
      link.download = `${slideshowId}-slide-${i + 1}.jpg`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, i * 200);
  });

  markAsDownloaded(slideshowId);
  showToast(`${slideshow.slides.length} Raw Images heruntergeladen!`);
}

function downloadRawSlide(slideshowId, slideIndex, url) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slideshowId}-slide-${parseInt(slideIndex) + 1}.jpg`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Slide ${parseInt(slideIndex) + 1} heruntergeladen!`);
}

function toggleExpand(slideshowId, btn) {
  const container = document.querySelector(`.slides-container[data-slides="${slideshowId}"]`);
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  container.classList.toggle('hidden');
  
  const textSpan = btn.querySelector('.expand-text');
  textSpan.textContent = isHidden ? '▲ Raw Slides & Texte' : '▼ Raw Slides & Texte';
}

function copyToClipboard(text, btn) {
  if (!text) {
    showToast('Kein Text zum Kopieren');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
    showToast('Kopiert!');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
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
  
  const badge = document.querySelector(`[data-id="${slideshowId}"] .badge`);
  if (badge) {
    badge.textContent = '✓ Downloaded';
    badge.classList.add('downloaded');
  }
}

function deleteSlideshow(slideshowId) {
  if (!confirm('Slideshow löschen?')) return;
  
  deletedIds[slideshowId] = true;
  localStorage.setItem('tiktok-portal-deleted', JSON.stringify(deletedIds));
  
  // Animate out
  const card = document.querySelector(`.slideshow-card[data-id="${slideshowId}"]`);
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-100%)';
    
    setTimeout(() => {
      renderSlideshows();
      showToast('Gelöscht!');
    }, 300);
  }
}

function restoreAllDeleted() {
  deletedIds = {};
  localStorage.removeItem('tiktok-portal-deleted');
  renderSlideshows();
  showToast('Alle wiederhergestellt!');
}

function showToast(message) {
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
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  if (!text) return '';
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
