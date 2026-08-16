/* ── UI Components & Detail Overlays ── */
import { State, saveState } from './state.js';
import { esc, safeUrl, showToast } from './utils.js';
import { getRestaurants, getFiltered, getSaved, updateBrowseBadge } from './data.js';
import { buildTags } from './cards.js';

export function showSaveIndicator() {
  const ind = document.getElementById('note-save-indicator');
  if (ind) {
    ind.style.opacity = '1';
    ind.textContent = 'Saving...';
    setTimeout(() => {
      ind.textContent = 'Saved to device ✓';
      setTimeout(() => {
        ind.style.opacity = '0';
      }, 1200);
    }, 300);
  }
}

export function setRating(id, rating) {
  if (!State.notes[id]) State.notes[id] = { rating: 0, note: '' };
  State.notes[id].rating = rating;
  saveState();
  
  const starsContainer = document.querySelector('#detail-sheet-content .rating-stars') || document.querySelector('.rating-stars');
  if (starsContainer) {
    const stars = starsContainer.querySelectorAll('span');
    stars.forEach((star, index) => {
      star.style.color = (index < rating) ? '#FFB800' : '';
    });
  }
  showSaveIndicator();
}

export function setNote(id, note) {
  if (!State.notes[id]) State.notes[id] = { rating: 0, note: '' };
  State.notes[id].note = note;
  saveState();
  showSaveIndicator();
}

let noteSaveTimeout = null;
export function handleNoteInput(id, text) {
  const ind = document.getElementById('note-save-indicator');
  if (ind) {
    ind.style.opacity = '1';
    ind.textContent = 'Saving...';
  }
  clearTimeout(noteSaveTimeout);
  noteSaveTimeout = setTimeout(() => {
    if (!State.notes[id]) State.notes[id] = { rating: 0, note: '' };
    State.notes[id].note = text;
    saveState();
    if (ind) {
      ind.textContent = 'Saved to device ✓';
      setTimeout(() => {
        if (ind.textContent === 'Saved to device ✓') {
          ind.style.opacity = '0';
        }
      }, 1200);
    }
  }, 500);
}

export function getActiveFriends() {
  const activeWeekRestaurants = getRestaurants();
  const currentWeekRestaurantIds = new Set(activeWeekRestaurants.map(r => r.id));
  return State.friends.map((f, index) => {
    const weekIds = (f.ids || []).filter(id => currentWeekRestaurantIds.has(id));
    return { ...f, weekIds, originalIndex: index };
  }).filter(f => f.weekIds.length > 0);
}

export function getCurrentContextList() {
  if (State.activeTab === 'saved') return getSaved();
  if (State.activeTab === 'share') {
    const myIds = [...State.saved];
    const activeFriends = getActiveFriends();
    const allSets = [myIds, ...activeFriends.map(f => f.weekIds)];
    const overlap = getRestaurants().filter(r => allSets.every(set => set.includes(r.id)));
    if (overlap.length > 0) return overlap;
    return [];
  }
  if (State.activeTab === 'swipe') return State.swipeQueue || [];
  return getFiltered();
}

export function toggleSave(id) {
  if (State.saved.has(id)) {
    State.saved.delete(id);
    State.customSavedOrder = State.customSavedOrder.filter(x => x !== id);
  } else {
    State.saved.add(id);
    if (!State.customSavedOrder.includes(id)) {
      State.customSavedOrder.push(id);
    }
  }
  saveState();

  if (State.crawlMode) {
    if (State.saved.has(id)) {
      if (State.crawlSelected.size < 8) {
        State.crawlSelected.add(id);
      } else {
        showToast('Maximum 8 spots allowed per crawl');
        return;
      }
    }
    if (window.App && window.App.updateCrawlFab) window.App.updateCrawlFab();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
    return;
  }

  const btn = document.getElementById('sheet-save-btn');
  if (btn) {
    const isSaved = State.saved.has(id);
    btn.classList.toggle('saved', isSaved);
    btn.textContent = isSaved ? 'Saved ✓' : 'Save Spot';
  }

  if (window.App && window.App.renderBrowse) window.App.renderBrowse();
  if (window.App && window.App.renderSaved) window.App.renderSaved();
}

export function openDetail(id, fromPopState = false) {
  const r = getRestaurants().find(x => x.id === id);
  if (!r) {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('dish')) {
        url.searchParams.delete('dish');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    } catch (e) {}
    return;
  }

  const wasAlreadyOpen = document.getElementById('detail-overlay').classList.contains('open');
  const isNew = r.isNew && !State.viewedNew.has(r.id);

  if (document.activeElement && document.activeElement !== document.body) {
    State.lastActiveElement = document.activeElement;
  }

  const list = getCurrentContextList();
  const idx = list.findIndex(x => x.id === id);
  const prevId = idx > 0 ? list[idx - 1].id : null;
  const nextId = idx !== -1 && idx < list.length - 1 ? list[idx + 1].id : null;

  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const hideNav = State.activeTab === 'map' || State.activeTab === 'swipe';
  if (prevBtn) {
    prevBtn.onclick = prevId ? (e) => { e.stopPropagation(); App.openDetail(prevId); } : null;
    prevBtn.disabled = !prevId;
    prevBtn.style.display = hideNav ? 'none' : '';
  }
  if (nextBtn) {
    nextBtn.onclick = nextId ? (e) => { e.stopPropagation(); App.openDetail(nextId); } : null;
    nextBtn.disabled = !nextId;
    nextBtn.style.display = hideNav ? 'none' : '';
  }

  State.selectedDish = r;
  const isSaved = State.saved.has(r.id);
  const overlay = document.getElementById('detail-overlay');
  const hero = r.image
    ? `<div class="sheet-hero-image"><img src="${esc(r.image)}" class="enlargeable" alt="Photo of ${esc(r.dish)}" onclick="if(window.innerWidth >= 769) App.openPhotoZoom('${esc(r.image)}')" onerror="this.parentElement.style.display='none'"></div>`
    : `<span class="sheet-emoji-hero">${esc(r.emoji)}</span>`;

  const contentHtml = `
    <button class="sheet-close-btn" onclick="App.closeDetail()" aria-label="Close detail view">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <button class="bookmark-btn ${isSaved ? 'saved' : ''}" onclick="App.toggleSave(${r.id})" aria-label="${isSaved ? 'Remove from saved' : 'Save dish'}" aria-pressed="${isSaved}">
      <svg class="save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="save-text" style="display: inline-block;">${isSaved ? 'Saved' : 'Save'}</span>
    </button>
    <div class="sheet-handle"></div>
    ${hero}
    <div class="sheet-dish">${esc(r.dish)}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
    <div class="sheet-restaurant">
      ${r.restaurantUrl ? `<a href="${esc(safeUrl(r.restaurantUrl))}" target="_blank" rel="noopener" class="venue-link sheet-link-grid" style="color: inherit;"><span class="link-text">${esc(r.restaurant)}</span><span class="link-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></span></a>` : esc(r.restaurant)}
    </div>
    <div class="sheet-address">
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.restaurant + ' ' + r.address)}" target="_blank" rel="noopener" title="Open in Google Maps" class="venue-link sheet-link-grid">
        <span class="link-text">📍 ${esc(r.address)}</span>
        <span class="link-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </span>
      </a>
    </div>
    ${r.whatsOnIt ? `<div class="sheet-section-title" style="font-weight: 600; margin-bottom: 4px; font-size: 15px;">${State.currentWeekId === 'slushie-2026' ? "What's in it..." : "What's on it..."}</div><div class="sheet-desc" style="margin-bottom: 16px;">${esc(r.whatsOnIt)}</div>` : ''}
    ${r.whatTheySay ? `<div class="sheet-section-title" style="font-weight: 600; margin-bottom: 4px; font-size: 15px;">What they say...</div><div class="sheet-desc">${esc(r.whatTheySay)}</div>` : ''}
    ${!r.whatsOnIt && !r.whatTheySay && r.desc ? `<div class="sheet-desc">${esc(r.desc)}</div>` : ''}
    <div class="sheet-tags">${buildTags(r)}</div>
    <div class="sheet-actions" style="display: flex; gap: 8px;">
      <a class="btn btn-link" style="flex: 1;" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">
        ${esc(r.url && r.url.includes('theactualportland.com') ? 'The Actual Portland' : (r.url && r.url.includes('bridgetownbites.com') ? 'Bridgetown Bites' : (r.url && r.url.includes('everout.com') ? 'EverOut' : 'Website')))} ↗
      </a>
      <button class="btn" style="flex: 1; background: var(--card-bg); border: 1.5px solid var(--border); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600;" onclick="App.shareDish(${r.id})">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Share
      </button>
    </div>
    ${!hideNav ? `
    <div class="sheet-nav" style="display: flex; justify-content: space-between; margin-top: 16px; gap: 12px;">
      <button class="btn" style="flex: 1; background: var(--card-bg); border: 1.5px solid var(--border); color: var(--ink); display: flex; align-items: center; justify-content: center; gap: 8px; ${!prevId ? 'opacity: 0.4; pointer-events: none;' : ''}" onclick="App.openDetail(${prevId})" ${!prevId ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Previous
      </button>
      <button class="btn" style="flex: 1; background: var(--card-bg); border: 1.5px solid var(--border); color: var(--ink); display: flex; align-items: center; justify-content: center; gap: 8px; ${!nextId ? 'opacity: 0.4; pointer-events: none;' : ''}" onclick="App.openDetail(${nextId})" ${!nextId ? 'disabled' : ''}>
        Next
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>` : ''}
    ${isSaved ? `
    <div class="sheet-notes-section" style="margin-top: 20px; border-top: 1px solid var(--ink-20); padding-top: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 14px; font-weight: 600;">Your Notes</span>
        <span id="note-save-indicator" style="font-size: 11px; color: var(--pizza); opacity: 0; transition: opacity 0.3s ease; font-weight: 500;">Saved to device ✓</span>
      </div>
      <div class="rating-stars" style="font-size: 24px; color: var(--ink-30); cursor: pointer; margin-bottom: 8px;">
        ${[1, 2, 3, 4, 5].map(star => `<span style="${State.notes[r.id] && State.notes[r.id].rating >= star ? 'color: #FFB800;' : ''}" onclick="App.setRating(${r.id}, ${star})">★</span>`).join('')}
      </div>
      <textarea class="note-input" placeholder="Add your personal notes..." oninput="App.handleNoteInput(${r.id}, this.value)" style="width: 100%; border: 1px solid var(--ink-20); border-radius: 8px; padding: 12px; font-family: inherit; font-size: 14px; resize: vertical; min-height: 80px;">${State.notes[r.id] && State.notes[r.id].note ? esc(State.notes[r.id].note) : ''}</textarea>
    </div>` : ''}
  `;

  const sheetEl = document.getElementById('detail-sheet-content');
  if (!sheetEl) return;

  const doUpdate = () => {
    sheetEl.innerHTML = contentHtml;

    if (isNew) {
      State.viewedNew.add(r.id);
      saveState();
      const card = document.querySelector(`.dish-card[data-id="${r.id}"]`);
      if (card) {
        const badge = card.querySelector('.new-badge');
        if (badge) badge.remove();
      }
      const swipeCard = document.querySelector(`.swipe-card[data-id="${r.id}"]`);
      if (swipeCard) {
        const badge = swipeCard.querySelector('.new-badge');
        if (badge) badge.remove();
      }
      updateBrowseBadge();
    }

    if (window.innerWidth <= 768) {
      setTimeout(() => {
        const closeBtn = sheetEl.querySelector('.sheet-close') || 
                         document.getElementById('detail-overlay')?.querySelector('.close-desktop');
        if (closeBtn) {
          closeBtn.focus();
        }
      }, 50);
    }
  };

  if (overlay.classList.contains('open')) {
    sheetEl.style.transition = 'opacity 0.15s ease-out';
    sheetEl.style.opacity = '0';
    setTimeout(() => {
      doUpdate();
      sheetEl.style.transition = 'opacity 0.2s ease-in';
      sheetEl.style.opacity = '1';
    }, 150);
  } else {
    sheetEl.style.opacity = '1';
    sheetEl.style.transition = '';
    doUpdate();
    overlay.classList.add('open');
    document.getElementById('app').classList.add('detail-open');
    if (window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    }
    if (State.activeTab === 'map' && window.App && window.App.refreshMapLayout) {
      setTimeout(window.App.refreshMapLayout, 360);
    }
  }

  if (!fromPopState) {
    const url = new URL(window.location);
    url.searchParams.set('dish', id);
    const newState = { ...history.state, detailDishId: id };
    if (wasAlreadyOpen) {
      history.replaceState(newState, '', url);
    } else {
      newState.dishOpenedHere = true;
      history.pushState(newState, '', url);
    }
  }
}

export function closeDetail(fromPopState = false) {
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('app').classList.remove('detail-open');
  document.body.style.overflow = '';
  State.selectedDish = null;

  if (State.activeTab === 'map' && window.App && window.App.refreshMapLayout) {
    setTimeout(window.App.refreshMapLayout, 360);
  }

  if (State.lastActiveElement) {
    try {
      State.lastActiveElement.focus();
    } catch (e) {
      console.warn("Could not restore focus:", e);
    }
    State.lastActiveElement = null;
  }

  if (!fromPopState) {
    try {
      if (history.state && history.state.dishOpenedHere) {
        history.back();
      } else {
        const url = new URL(window.location);
        url.searchParams.delete('dish');
        const newState = { ...history.state };
        delete newState.detailDishId;
        delete newState.dishOpenedHere;
        history.pushState(newState, '', url);
      }
    } catch (e) { }
  }
}

export function openPhotoZoom(url) {
  document.getElementById('photo-zoom-img').src = url;
  document.getElementById('photo-zoom-overlay').classList.add('open');
}

export function closePhotoZoom() {
  document.getElementById('photo-zoom-overlay').classList.remove('open');
}

export function showMetricDetails(type) {
  const items = State.activeTab === 'browse' ? getFiltered() : getSaved();
  if (items.length === 0) return;

  const overlay = document.getElementById('metric-modal-overlay');
  const title = document.getElementById('metric-modal-title');
  const body = document.getElementById('metric-modal-body');

  let list = [];
  if (type === 'hoods') {
    const hoods = new Set(items.map(r => r.neighborhood || r.address).filter(Boolean));
    if (hoods.size === 0) return;
    title.textContent = 'Neighborhoods';
    list = Array.from(hoods).sort();
  } else if (type === 'types') {
    const types = new Set(items.map(r => r.type).filter(Boolean));
    if (types.size === 0) return;
    title.textContent = 'Dish Types';
    list = Array.from(types).sort();
  }

  body.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;">` +
    list.map(item => `<li style="padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 15px; text-transform: capitalize;">${item}</li>`).join('') +
    `</ul>`;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeMetricModal() {
  const overlay = document.getElementById('metric-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

export function shareDish(id) {
  const r = getRestaurants().find(x => x.id === id);
  if (!r) return;

  const basePath = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '');
  const shareUrl = `${window.location.origin}${basePath}/d/${r.weekId}-${r.id}.html`;
  const title = `${r.dish} @ ${r.restaurant}`;
  const text = `Check out ${r.dish} at ${r.restaurant} for ${r.weekId || 'PDX Food Week'}!`;

  if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
    navigator.share({ title, text, url: shareUrl }).catch(() => {});
  } else if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Share link copied to clipboard!');
    }).catch(() => {
      showToast('Share link: ' + shareUrl);
    });
  } else {
    showToast('Share link: ' + shareUrl);
  }
}
