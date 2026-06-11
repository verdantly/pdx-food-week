/* ── PDX Food Week App ── */
'use strict';

// ── Firebase Configuration ───────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD4aVF_dVWxrZ6F_GNQuZa1eBLOWdL0xXc",
  authDomain: "pdx-food-week.firebaseapp.com",
  projectId: "pdx-food-week",
  storageBucket: "pdx-food-week.firebasestorage.app",
  messagingSenderId: "641950496269",
  appId: "1:641950496269:web:05be564e86427f24d08744",
  measurementId: "G-78YTW9CPLJ"
};

// Initialize Firebase only if the global object exists
let db = null;
if (window.firebase) {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

const App = (() => {
  // ── State ──────────────────────────────────────────────────
  let activeTab = 'browse';
  let activeFilters = new Set();
  let activeSort = 'restaurant';
  let searchQuery = '';
  let saved = new Set();
  let passed = new Set();
  let friends = [];
  let notes = {};
  let selectedDish = null;
  let currentWeekId = 'nacho-2026';
  let swipeQueue = null;
  let swipeIdx = 0;
  let swipeAnimating = false;
  let userLat = null;
  let userLng = null;
  let lastActiveElement = null;

  const STORAGE_KEY_SAVED = 'pdxfw_saved_v1';
  const STORAGE_KEY_PASSED = 'pdxfw_passed_v1';
  const STORAGE_KEY_FRIENDS = 'pdxfw_friends_v1';
  const STORAGE_KEY_WEEK = 'pdxfw_current_week_v1';
  const STORAGE_KEY_NOTES = 'pdxfw_notes_v1';

  const WEEK_FILTERS = {
    'pizza-2026': [
      { id: 'meat', label: '🥩 Meat' },
      { id: 'vegetarian', label: '🌿 Vegetarian' },
      { id: 'vegan', label: '🌱 Vegan' },
      { id: 'gf', label: '🌾 Gluten-free' },
      { id: 'pie', label: '🍕 Whole Pie' },
      { id: 'minors', label: '👨‍👩‍👧 Family OK' }
    ],
    'highball-2026': [
      { id: 'minors', label: '👨‍👩‍👧 Minors OK' },
      { id: '21plus', label: '🥃 21+ Only' },
      { id: 'takeout', label: '🥡 Takeout OK' }
    ],
    'taco-2026': [
      { id: 'meat', label: '🥩 Meat' },
      { id: 'vegetarian', label: '🌿 Vegetarian' },
      { id: 'vegan', label: '🌱 Vegan' },
      { id: 'gf', label: '🌾 Gluten-free' },
      { id: 'spicy', label: '🌶️ Spicy' }
    ],
    'nacho-2026': [
      { id: 'meat', label: '🥩 Meat' },
      { id: 'vegetarian', label: '🌿 Vegetarian' },
      { id: 'vegan', label: '🌱 Vegan' },
      { id: 'gf', label: '🌾 Gluten-free' }
    ]
  };

  // ── Persistence ────────────────────────────────────────────
  function loadState() {
    try {
      const s = localStorage.getItem(STORAGE_KEY_SAVED);
      if (s) saved = new Set(JSON.parse(s));
      const p = localStorage.getItem(STORAGE_KEY_PASSED);
      if (p) passed = new Set(JSON.parse(p));
      const f = localStorage.getItem(STORAGE_KEY_FRIENDS);
      if (f) friends = JSON.parse(f);
      const w = localStorage.getItem(STORAGE_KEY_WEEK);
      if (w) currentWeekId = w;
      const n = localStorage.getItem(STORAGE_KEY_NOTES);
      if (n) notes = JSON.parse(n);
    } catch (e) { }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...saved]));
      localStorage.setItem(STORAGE_KEY_PASSED, JSON.stringify([...passed]));
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
      localStorage.setItem(STORAGE_KEY_WEEK, currentWeekId);
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch (e) { }
  }

  // Basic HTML-escape for interpolated scraped text. Keep conservative — we
  // only need to neutralize tag/quote syntax, not full XSS hardening.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Only allow http/https URLs to be interpolated into href. Drop anything
  // else (javascript:, data:, etc.) to a safe fallback.
  function safeUrl(u) {
    const v = String(u || '').trim();
    return /^https?:\/\//i.test(v) ? v : '#';
  }

  // ── Data helpers ───────────────────────────────────────────
  function haversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 3958.8; // Radius of the Earth in miles
    const rlat1 = lat1 * (Math.PI / 180);
    const rlat2 = lat2 * (Math.PI / 180);
    const difflat = rlat2 - rlat1;
    const difflon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(difflat / 2) * Math.sin(difflat / 2) +
      Math.cos(rlat1) * Math.cos(rlat2) *
      Math.sin(difflon / 2) * Math.sin(difflon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function getRestaurants() {
    return window.RESTAURANTS.filter(r => r.weekId === currentWeekId);
  }

  function isVeganFriendly(r) {
    if (r.type === 'vegan' || r.veganOption) return true;
    const txt = `${r.dish} ${r.desc}`.toLowerCase();
    return txt.includes('vegan option') ||
      txt.includes('can be made vegan') ||
      txt.includes('vegan available') ||
      txt.includes('optionally vegan') ||
      txt.includes('vegan version') ||
      txt.includes('request vegan');
  }

  function isVegetarianFriendly(r) {
    if (r.type === 'vegan' || r.type === 'vegetarian' || r.vegOption) return true;
    const txt = `${r.dish} ${r.desc}`.toLowerCase();
    return txt.includes('vegetarian option') ||
      txt.includes('vegetarian available') ||
      txt.includes('veggie option') ||
      txt.includes('veggie available') ||
      txt.includes('veg option') ||
      txt.includes('can be made veg') ||
      txt.includes('optionally veg') ||
      txt.includes('or tofu') ||
      txt.includes('vegetarian version') ||
      txt.includes('request veg') ||
      isVeganFriendly(r);
  }

  function getFiltered() {
    let filtered = getRestaurants().filter(r => {
      if (activeFilters.has('meat') && r.type !== 'meat') return false;
      if (activeFilters.has('vegetarian') && !isVegetarianFriendly(r)) return false;
      if (activeFilters.has('vegan') && !isVeganFriendly(r)) return false;
      if (activeFilters.has('gf') && !r.glutenFree) return false;
      if (activeFilters.has('pie') && !r.wholePie) return false;
      if (activeFilters.has('minors') && !r.minors) return false;
      if (activeFilters.has('21plus') && r.minors) return false;
      if (activeFilters.has('takeout') && !r.takeout) return false;
      if (activeFilters.has('spicy') && !r.spicy) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.dish.toLowerCase().includes(q) &&
          !r.restaurant.toLowerCase().includes(q) &&
          !r.neighborhood.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (activeSort === 'dish') {
      filtered.sort((a, b) => a.dish.localeCompare(b.dish));
    } else if (activeSort === 'restaurant') {
      filtered.sort((a, b) => a.restaurant.localeCompare(b.restaurant));
    } else if (activeSort === 'distance' && userLat !== null && userLng !== null) {
      filtered.sort((a, b) => {
        const d1 = haversineDistance(userLat, userLng, a.lat, a.lng);
        const d2 = haversineDistance(userLat, userLng, b.lat, b.lng);
        return d1 - d2;
      });
    } else {
      filtered.sort((a, b) => a.id - b.id);
    }

    return filtered;
  }

  function getSaved() {
    let savedItems = getRestaurants().filter(r => saved.has(r.id));

    if (activeSort === 'dish') {
      savedItems.sort((a, b) => a.dish.localeCompare(b.dish));
    } else if (activeSort === 'restaurant') {
      savedItems.sort((a, b) => a.restaurant.localeCompare(b.restaurant));
    } else if (activeSort === 'distance' && userLat !== null && userLng !== null) {
      savedItems.sort((a, b) => {
        const d1 = haversineDistance(userLat, userLng, a.lat, a.lng);
        const d2 = haversineDistance(userLat, userLng, b.lat, b.lng);
        return d1 - d2;
      });
    }

    return savedItems;
  }

  // ── Encode/decode share code ───────────────────────────────
  function encodeShareCode() {
    if (saved.size === 0) return null;
    const ids = [...saved].sort((a, b) => a - b).join(',');
    return 'PDX26-' + btoa(ids).replace(/=/g, '');
  }

  function decodeShareCode(code) {
    try {
      if (!code.startsWith('PDX26-')) return null;
      const raw = atob(code.replace('PDX26-', ''));
      const ids = raw.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      return ids.length > 0 ? ids : null;
    } catch (e) {
      return null;
    }
  }

  // ── Tag builder ────────────────────────────────────────────
  function buildTags(r) {
    const t = [];
    if (currentWeekId === 'pizza-2026') {
      if (r.type === 'meat') {
        t.push('<span class="tag tag-meat">Meat</span>');
        if (isVeganFriendly(r)) {
          t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
        } else if (isVegetarianFriendly(r)) {
          t.push('<span class="tag tag-veg" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Veg option</span>');
        }
      } else if (r.type === 'vegetarian') {
        t.push('<span class="tag tag-veg">Vegetarian only</span>');
        if (isVeganFriendly(r)) {
          t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
        }
      } else if (r.type === 'vegan') {
        t.push('<span class="tag tag-vegan">Vegan only</span>');
      }
      if (r.glutenFree) t.push('<span class="tag tag-gf">GF available</span>');
      if (r.wholePie) t.push('<span class="tag tag-pie">Whole pie $25</span>');
      else t.push('<span class="tag tag-slice">By the slice</span>');
    } else if (currentWeekId === 'highball-2026') {
      if (r.minors) t.push('<span class="tag tag-minors" style="background:#E3EFDB;color:#2F6316;">Minors OK</span>');
      else t.push('<span class="tag tag-21plus" style="background:#FAE8E0;color:#8B3015;">21+ Only</span>');
      if (r.takeout) t.push('<span class="tag tag-takeout" style="background:#E3EEF8;color:#185FA5;">Takeout OK</span>');
    } else if (currentWeekId === 'taco-2026') {
      if (r.type === 'meat') {
        t.push('<span class="tag tag-meat">Meat</span>');
        if (isVeganFriendly(r)) {
          t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
        } else if (isVegetarianFriendly(r)) {
          t.push('<span class="tag tag-veg" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Veg option</span>');
        }
      } else if (r.type === 'vegetarian') {
        t.push('<span class="tag tag-veg">Vegetarian only</span>');
        if (isVeganFriendly(r)) {
          t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
        }
      } else if (r.type === 'vegan') {
        t.push('<span class="tag tag-vegan">Vegan only</span>');
      }
      if (r.glutenFree) t.push('<span class="tag tag-gf">GF available</span>');
      if (r.spicy) t.push('<span class="tag tag-spicy" style="background:#FAE8E0;color:#8B3015;">🌶️ Spicy</span>');
    } else if (currentWeekId === 'nacho-2026') {
      if (r.type === 'meat') {
        t.push('<span class="tag tag-meat">Meat</span>');
        if (isVeganFriendly(r)) {
          t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
        } else if (isVegetarianFriendly(r)) {
          t.push('<span class="tag tag-veg" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Veg option</span>');
        }
      } else if (r.type === 'vegetarian') {
        t.push('<span class="tag tag-veg">Vegetarian only</span>');
        if (isVeganFriendly(r)) {
          t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
        }
      } else if (r.type === 'vegan') {
        t.push('<span class="tag tag-vegan">Vegan only</span>');
      }
      if (r.glutenFree) t.push('<span class="tag tag-gf">GF available</span>');
    }
    return t.join('');
  }

  // ── Card HTML ──────────────────────────────────────────────
  function cardHTML(r, overlap) {
    const isSaved = saved.has(r.id);
    const cls = ['dish-card', isSaved ? 'bookmarked' : '', overlap ? 'overlap-card' : ''].filter(Boolean).join(' ');
    const thumb = r.image
      ? `<div class="card-emoji card-thumb"><img src="${esc(r.image)}" alt="" loading="lazy"></div>`
      : `<div class="card-emoji">${esc(r.emoji)}</div>`;

    const dist = (activeSort === 'distance' && userLat !== null && userLng !== null)
      ? ` <span style="font-size: 13px; font-weight: normal; color: var(--ink-60);">(${haversineDistance(userLat, userLng, r.lat, r.lng).toFixed(1)} mi)</span>`
      : '';

    const restaurantHtml = r.restaurantUrl
      ? `<a href="${esc(r.restaurantUrl)}" target="_blank" rel="noopener" class="venue-link" onclick="event.stopPropagation()">${esc(r.restaurant)} <span class="mobile-arrow">↗</span></a>`
      : esc(r.restaurant);

    return `
      <div class="${cls}" data-id="${r.id}" onclick="App.openDetail(${r.id})">
        ${thumb}
        <div class="card-body">
          <div class="card-dish">${esc(r.dish)}</div>
          <div class="card-restaurant">${restaurantHtml}${dist}</div>
          <div class="card-neighborhood">📍 ${esc(r.neighborhood)}</div>
          <div class="card-desc">${esc(r.desc)}</div>
          <div class="card-tags">${buildTags(r)}</div>
        </div>
        <button class="bookmark-btn ${isSaved ? 'saved' : ''}"
          onclick="event.stopPropagation(); App.toggleSave(${r.id})"
          aria-label="${isSaved ? 'Remove bookmark' : 'Bookmark this dish'}">
          ${isSaved ? '★' : '☆'}
        </button>
      </div>`;
  }

  // ── Toggle save ────────────────────────────────────────────
  function toggleSave(id) {
    if (saved.has(id)) {
      saved.delete(id);
      showToast('Removed from saved');
    } else {
      saved.add(id);
      passed.delete(id);
      showToast('🍕 Saved!');
    }
    saveState();
    // Any change to saved/passed from outside Swipe invalidates the deck so
    // the next Swipe-tab entry rebuilds against current state.
    swipeQueue = null;
    renderAll();
    // If detail sheet open, update its button
    if (selectedDish && selectedDish.id === id) {
      openDetail(id, true);
    }
  }

  // Helper to show inline save indicator in detail sheet
  function showSaveIndicator() {
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

  // ── Notes & Ratings ─────────────────────────────────────────
  function setRating(id, rating) {
    if (!notes[id]) notes[id] = { rating: 0, note: '' };
    notes[id].rating = rating;
    saveState();
    
    // Update active stars in DOM directly instead of re-rendering openDetail!
    const starsContainer = document.querySelector('.rating-stars');
    if (starsContainer) {
      const stars = starsContainer.querySelectorAll('span');
      stars.forEach((star, index) => {
        star.style.color = (index < rating) ? '#FFB800' : '';
      });
    }
    showSaveIndicator();
  }

  function setNote(id, note) {
    if (!notes[id]) notes[id] = { rating: 0, note: '' };
    notes[id].note = note;
    saveState();
    showSaveIndicator();
  }

  function getCurrentContextList() {
    if (activeTab === 'saved') return getSaved();
    if (activeTab === 'friends') {
      const myIds = [...saved];
      const allSets = [myIds, ...friends.map(f => f.ids)];
      const overlap = getRestaurants().filter(r => allSets.every(set => set.includes(r.id)));
      if (overlap.length > 0) return overlap;
      return [];
    }
    if (activeTab === 'swipe') return swipeQueue || [];
    return getFiltered();
  }

  // ── Detail sheet ───────────────────────────────────────────
  function openDetail(id, fromPopState = false) {
    const r = getRestaurants().find(x => x.id === id);
    if (!r) return;

    // Save current active element for accessibility focus restore
    if (document.activeElement && document.activeElement !== document.body) {
      lastActiveElement = document.activeElement;
    }

    const list = getCurrentContextList();
    const idx = list.findIndex(x => x.id === id);
    const prevId = idx > 0 ? list[idx - 1].id : null;
    const nextId = idx !== -1 && idx < list.length - 1 ? list[idx + 1].id : null;

    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    if (prevBtn) {
      prevBtn.onclick = prevId ? (e) => { e.stopPropagation(); App.openDetail(prevId); } : null;
      prevBtn.disabled = !prevId;
    }
    if (nextBtn) {
      nextBtn.onclick = nextId ? (e) => { e.stopPropagation(); App.openDetail(nextId); } : null;
      nextBtn.disabled = !nextId;
    }

    selectedDish = r;
    const isSaved = saved.has(r.id);
    const overlay = document.getElementById('detail-overlay');
    const hero = r.image
      ? `<div class="sheet-hero-image"><img src="${esc(r.image)}" alt=""></div>`
      : `<span class="sheet-emoji-hero">${esc(r.emoji)}</span>`;
    document.getElementById('detail-sheet-content').innerHTML = `
      <button class="sheet-close" onclick="App.closeDetail()" aria-label="Close">×</button>
      <div class="sheet-handle"></div>
      ${hero}
      <div class="sheet-dish">${esc(r.dish)}</div>
      <div class="sheet-restaurant">
        ${r.restaurantUrl ? `<a href="${esc(r.restaurantUrl)}" target="_blank" rel="noopener" class="venue-link">${esc(r.restaurant)} <span class="mobile-arrow">↗</span></a>` : esc(r.restaurant)}
      </div>
      <div class="sheet-address">
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.restaurant + ' ' + r.address)}" target="_blank" rel="noopener" title="Open in Google Maps" class="venue-link">
          📍 ${esc(r.address)} <span class="mobile-arrow">↗</span>
        </a>
      </div>
      <div class="sheet-desc">${esc(r.desc)}</div>
      <div class="sheet-tags">${buildTags(r)}</div>
      <div class="sheet-actions">
        <button class="btn btn-save ${isSaved ? 'saved' : ''}" id="sheet-save-btn"
          onclick="App.toggleSave(${r.id})">
          ${isSaved ? '★ Saved' : '☆ Save'}
        </button>
        <a class="btn btn-link" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">
          ${esc(r.url && r.url.includes('theactualportland.com') ? 'The Actual Portland' : (r.url && r.url.includes('everout.com') ? 'EverOut' : 'Website'))} ↗
        </a>
      </div>
      <div class="sheet-nav" style="display: flex; justify-content: space-between; margin-top: 16px; gap: 12px;">
        <button class="btn" style="flex: 1; background: var(--card-bg); border: 1.5px solid var(--border); color: var(--ink);" onclick="App.openDetail(${prevId})" ${!prevId ? 'disabled' : ''}>&larr; Previous</button>
        <button class="btn" style="flex: 1; background: var(--card-bg); border: 1.5px solid var(--border); color: var(--ink);" onclick="App.openDetail(${nextId})" ${!nextId ? 'disabled' : ''}>Next &rarr;</button>
      </div>
      ${isSaved ? `
      <div class="sheet-notes-section" style="margin-top: 20px; border-top: 1px solid var(--ink-20); padding-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 14px; font-weight: 600;">Your Notes</span>
          <span id="note-save-indicator" style="font-size: 11px; color: var(--pizza); opacity: 0; transition: opacity 0.3s ease; font-weight: 500;">Saved to device ✓</span>
        </div>
        <div class="rating-stars" style="font-size: 24px; color: var(--ink-30); cursor: pointer; margin-bottom: 8px;">
          ${[1, 2, 3, 4, 5].map(star => `<span style="${notes[r.id] && notes[r.id].rating >= star ? 'color: #FFB800;' : ''}" onclick="App.setRating(${r.id}, ${star})">★</span>`).join('')}
        </div>
        <textarea class="note-input" placeholder="Add your personal notes..." onchange="App.setNote(${r.id}, this.value)" style="width: 100%; border: 1px solid var(--ink-20); border-radius: 8px; padding: 12px; font-family: inherit; font-size: 14px; resize: vertical; min-height: 80px;">${notes[r.id] && notes[r.id].note ? esc(notes[r.id].note) : ''}</textarea>
      </div>` : ''}
    `;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Shift focus to the close button inside the detail sheet for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('detail-sheet-content')?.querySelector('.sheet-close') || 
                       document.getElementById('detail-overlay')?.querySelector('.close-desktop');
      if (closeBtn) {
        closeBtn.focus();
      }
    }, 50);

    if (!fromPopState) {
      const url = new URL(window.location);
      url.searchParams.set('dish', id);
      history.pushState({ detailDishId: id }, '', url);
    }
  }

  function closeDetail(fromPopState = false) {
    document.getElementById('detail-overlay').classList.remove('open');
    document.body.style.overflow = '';
    selectedDish = null;

    if (lastActiveElement) {
      try {
        lastActiveElement.focus();
      } catch (e) {
        console.warn("Could not restore focus:", e);
      }
      lastActiveElement = null;
    }

    if (!fromPopState) {
      if (history.state && history.state.detailDishId !== undefined) {
        history.back();
      } else {
        const url = new URL(window.location);
        url.searchParams.delete('dish');
        history.pushState(null, '', url);
      }
    }
  }

  // ── Toast ──────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ── Tab switching ──────────────────────────────────────────
  function switchTab(name, fromPopState = false) {
    activeTab = name;
    document.querySelectorAll('.nav-tab').forEach(el => {
      const isActive = el.dataset.tab === name;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === `view-${name}`);
    });
    if (name === 'map') {
      renderMap();
      // The container's real dimensions are only known once the tab is
      // visible; a deferred invalidateSize() forces Leaflet to remeasure.
      requestAnimationFrame(refreshMapLayout);
    }
    if (name === 'swipe') {
      if (!swipeQueue) buildSwipeQueue();
      renderSwipe();
    }

    document.body.classList.toggle('is-landing', name === 'landing');

    if (!fromPopState) {
      const url = new URL(window.location);
      if (name === 'browse') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', name);
      }
      history.pushState({ ...history.state, tab: name }, '', url);
    }
  }

  // ── Filter ────────────────────────────────────────────────
  function toggleFilter(f) {
    if (activeFilters.has(f)) {
      activeFilters.delete(f);
    } else {
      activeFilters.add(f);
    }
    renderFilters();
    renderBrowse();
  }

  // ── Sort ──────────────────────────────────────────────────
  function setSort(s, el) {
    activeSort = s;
    const sortSection = document.getElementById('sort-section');
    sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('zip-code-container').style.display = 'none';
    renderBrowse();
    renderSaved(); // sorting also applies to your saved list
  }

  function toggleDistanceSort(el) {
    const zipContainer = document.getElementById('zip-code-container');
    const sortSection = document.getElementById('sort-section');
    if (activeSort === 'distance') {
      // Revert to default
      setSort('restaurant', sortSection.querySelector('button.filter-chip'));
    } else {
      activeSort = 'distance';
      sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      zipContainer.style.display = 'flex';

      if (userLat !== null && userLng !== null) {
        renderBrowse();
        renderSaved();
      }
    }
  }

  async function applyZipCode() {
    const zipInput = document.getElementById('zip-code-input');
    const zip = zipInput.value.trim();
    if (!zip || zip.length !== 5) {
      showToast('⚠️ Please enter a valid 5-digit zip code');
      return;
    }

    try {
      const btn = zipInput.nextElementSibling;
      btn.textContent = '...';
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      userLat = parseFloat(data.places[0].latitude);
      userLng = parseFloat(data.places[0].longitude);
      renderBrowse();
      renderSaved();
    } catch (e) {
      showToast('⚠️ Could not find that zip code');
    } finally {
      zipInput.nextElementSibling.textContent = 'Go';
    }
  }

  // ── Render: Browse ─────────────────────────────────────────
  function renderBrowse() {
    const filtered = getFiltered();
    const container = document.getElementById('cards-browse');
    if (filtered.length === 0) {
      container.innerHTML = `<div class="no-results"><div class="nr-emoji">🤷</div><p>No results. Try a different filter!</p></div>`;
    } else {
      container.innerHTML = filtered.map(r => cardHTML(r)).join('');
    }
  }

  // ── Render: Saved ──────────────────────────────────────────
  function renderSaved() {
    const items = getSaved();
    const hoods = new Set(items.map(r => r.neighborhood)).size;
    const types = new Set(items.map(r => r.type)).size;
    document.getElementById('stat-count').textContent = items.length;
    document.getElementById('stat-hoods').textContent = hoods;
    document.getElementById('stat-types').textContent = types;

    const tab = document.querySelector('[data-tab="saved"]');
    tab.classList.toggle('has-items', items.length > 0);
    tab.setAttribute('data-count', items.length);

    const container = document.getElementById('cards-saved');
    if (items.length === 0) {
      container.innerHTML = `<div class="no-results"><div class="nr-emoji">☆</div><p>Bookmark spots from Browse to build your list!</p></div>`;
    } else {
      container.innerHTML = items.map(r => cardHTML(r)).join('');
    }
  }

  // ── Export Saved ───────────────────────────────────────────
  function exportSavedToClipboard() {
    const items = getSaved();
    if (items.length === 0) {
      showToast('Nothing to export!');
      return;
    }
    const text = items.map(r => `• ${r.restaurant} - ${r.dish}\n  📍 ${r.address}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      showToast('List copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy text');
    });
  }

  // ── Render: Friends ────────────────────────────────────────
  function renderFriends() {
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.disabled = (saved.size === 0);
    }

    if (saved.size === 0) {
      const resultsDiv = document.getElementById('share-results');
      if (resultsDiv) {
        resultsDiv.style.display = 'none';
      }
    }

    // Friends list
    const fl = document.getElementById('friends-list');
    fl.innerHTML = friends.length === 0
      ? `<div class="no-results" style="padding:24px 0"><div class="nr-emoji" style="font-size:28px">👥</div><p>No friends added yet.</p></div>`
      : friends.map((f, i) => `
          <div class="friend-item">
            <div class="friend-avatar">${f.name.charAt(0).toUpperCase()}</div>
            <div class="friend-info">
              <div class="friend-name">${f.name}</div>
              <div class="friend-count">${f.ids.length} dish${f.ids.length === 1 ? '' : 'es'} saved</div>
            </div>
            <button class="friend-remove" style="margin-right: 4px;" onclick="App.renameFriend(${i})">✏️ Edit</button>
            <button class="friend-remove" onclick="App.removeFriend(${i})">Remove</button>
          </div>`).join('');

    // Overlap
    const overlapSection = document.getElementById('overlap-section');
    if (friends.length === 0) {
      overlapSection.style.display = 'none';
      return;
    }
    overlapSection.style.display = 'block';

    const myIds = [...saved];
    const allSets = [myIds, ...friends.map(f => f.ids)];
    const overlap = getRestaurants().filter(r => allSets.every(set => set.includes(r.id)));
    const overlapContainer = document.getElementById('overlap-container');

    overlapContainer.className = 'cards-list';
    if (overlap.length === 0) {
      overlapContainer.innerHTML = `<div class="no-results" style="padding:20px 0"><p>No overlap yet — save more spots and add more friends!</p></div>`;
    } else {
      overlapContainer.innerHTML = overlap.map(r => cardHTML(r, true)).join('');
    }
  }

  // Helper to wrap promises with a timeout to prevent hanging on blocked networks/adblockers
  function timeoutPromise(promise, ms, errorMsg) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMsg || "Timeout"));
      }, ms);
      promise.then(
        (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  // ── Friends: Generate Magic Link ───────────────────────────
  async function generateShareLink() {
    if (saved.size === 0) {
      showToast('⚠️ Save some spots first!');
      return;
    }

    const btn = document.getElementById('copy-btn');
    const nameInput = document.getElementById('my-name-input');
    const myName = nameInput ? nameInput.value.trim() : '';

    btn.textContent = 'Generating...';
    btn.disabled = true;

    const shortId = Math.random().toString(36).substring(2, 7);
    let firebaseSuccess = false;

    if (db) {
      try {
        const writePromise = db.collection('shared_lists').doc(shortId).set({
          ids: Array.from(saved),
          name: myName,
          weekId: currentWeekId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Wait at most 5000ms before falling back to client-side encoding
        await timeoutPromise(writePromise, 5000, "Firestore write timeout");
        firebaseSuccess = true;
      } catch (e) {
        console.error("Firebase Firestore save failed! Verify that your Firestore security rules allow public write access to the 'shared_lists' collection.", e);
      }
    } else {
      console.warn("Firebase is not initialized (window.firebase is undefined or db is null). Falling back to local encoding.");
    }

    try {
      const encodedBackup = encodeShareCode();
      const baseUrl = window.location.origin + window.location.pathname;
      let url;

      if (firebaseSuccess) {
        url = `${baseUrl}?week=${currentWeekId}&list=${shortId}`;
      } else {
        url = `${baseUrl}?week=${currentWeekId}&fallback=${encodedBackup}`;
      }

      // Populate displays
      const magicDisplay = document.getElementById('magic-link-display');
      if (magicDisplay) {
        magicDisplay.value = url;
      }

      const codeDisplay = document.getElementById('manual-code-display');
      if (codeDisplay) {
        codeDisplay.value = encodedBackup;
      }

      // Reveal results section
      const resultsDiv = document.getElementById('share-results');
      if (resultsDiv) {
        resultsDiv.style.display = 'flex';
      }

      // Show/hide native share button depending on browser support
      const shareNativeBtn = document.getElementById('share-native-btn');
      if (shareNativeBtn) {
        shareNativeBtn.style.display = navigator.share ? 'block' : 'none';
      }

      let copiedSuccessfully = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          copiedSuccessfully = true;
        } else {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(ta);
          if (successful) copiedSuccessfully = true;
        }
      } catch (e) {
        console.warn("Auto-copy failed:", e);
      }

      if (copiedSuccessfully) {
        btn.textContent = 'Generated & Copied!';
        btn.classList.add('copied');
        showToast('✅ Magic Link Copied!');
      } else {
        btn.textContent = 'Generated!';
        showToast('✅ Magic Link generated! Copy it below.');
      }
    } catch (err) {
      console.error("Error in generateShareLink:", err);
      showToast('⚠️ Error generating share details');
    } finally {
      setTimeout(() => {
        btn.textContent = 'Generate Magic Link';
        btn.classList.remove('copied');
        btn.disabled = false;
      }, 2000);
    }
  }

  async function copyTextFromElement(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;

    const text = input.value;
    if (!text) return;

    try {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(ta);
        if (successful) copied = true;
      }

      if (copied) {
        const origText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        showToast('✅ Copied to clipboard!');

        setTimeout(() => {
          btn.textContent = origText;
          btn.classList.remove('copied');
        }, 2000);
      } else {
        showToast('⚠️ Copy failed, please copy manually');
      }
    } catch (e) {
      console.error("Failed to copy", e);
      showToast('⚠️ Copy failed, please copy manually');
    }
  }

  async function shareNative() {
    const magicDisplay = document.getElementById('magic-link-display');
    const url = magicDisplay ? magicDisplay.value : '';
    if (!url) return;

    try {
      await navigator.share({
        title: 'PDX Food Week List',
        text: 'Import my saved spots for PDX Food Week!',
        url: url
      });
      showToast('✅ List shared!');
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error("Native share failed", e);
        showToast('⚠️ Native sharing failed, please copy the link.');
      }
    }
  }

  // ── Friends: Add friend ────────────────────────────────────
  async function addFriend() {
    const input = document.getElementById('friend-code-input');
    const nameInput = document.getElementById('my-name-input'); // not the friend's name, but keeping it generic or using a prompt
    const rawVal = input.value.trim();
    if (!rawVal) return;

    // Check if it's a URL
    let listId = null;
    let fallbackCode = null;
    try {
      if (rawVal.startsWith('http')) {
        const urlParams = new URL(rawVal).searchParams;
        listId = urlParams.get('list');
        fallbackCode = urlParams.get('fallback');
      } else {
        // If it's short, it's a list ID. Otherwise it's a raw code.
        if (rawVal.length <= 10 && !rawVal.startsWith('PDX')) listId = rawVal;
        else fallbackCode = rawVal;
      }
    } catch (e) { }

    let ids = null;
    let friendName = `Friend ${friends.length + 1}`;

    if (listId && db) {
      try {
        const fetchPromise = db.collection('shared_lists').doc(listId).get();
        // Wait at most 5000ms before falling back to local fallback decoding
        const doc = await timeoutPromise(fetchPromise, 5000, "Firestore fetch timeout");
        if (doc && doc.exists) {
          const data = doc.data();
          ids = data.ids || [];
          if (data.name) friendName = data.name;
        }
      } catch (e) {
        console.error("Failed to fetch shared list", e);
      }
    }

    if (!ids && fallbackCode) {
      ids = decodeShareCode(fallbackCode);
    }

    if (!ids) {
      showToast('⚠️ Invalid link or code');
      return;
    }

    friends.push({ name: friendName, ids, code: fallbackCode || listId });
    saveState();
    input.value = '';
    renderFriends();
    showToast(`Added ${friendName}!`);
  }

  // ── Friends: Rename friend ─────────────────────────────────
  function renameFriend(i) {
    const currentName = friends[i].name;
    const newName = prompt("Enter a new name for this friend:", currentName);
    if (newName && newName.trim() !== "" && newName !== currentName) {
      friends[i].name = newName.trim();
      saveState();
      renderFriends();
      showToast('Name updated');
    }
  }

  // ── Friends: Remove friend ─────────────────────────────────
  function removeFriend(i) {
    friends.splice(i, 1);
    saveState();
    renderFriends();
    showToast('Friend removed');
  }

  // ── Map (Leaflet + OpenStreetMap tiles) ────────────────────
  // `leafletMap` and the marker index are lazily created on first entry into
  // the Map tab. renderMap() refreshes marker styling against the current
  // saved set on each call.
  let leafletMap = null;
  let leafletMarkers = null;
  let markerClusterGroup = null; // Map<id, L.CircleMarker>
  let selectedMapId = null;

  function pinIcon(isSaved, isSelected) {
    const cls = ['pdx-pin', isSaved ? 'saved' : '', isSelected ? 'selected' : '']
      .filter(Boolean).join(' ');
    const size = isSaved ? 22 : 18;
    return L.divIcon({
      className: '',
      html: `<div class="${cls}"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function renderMap() {
    const host = document.getElementById('map-canvas');
    if (typeof L === 'undefined') {
      // Leaflet failed to load (CDN blocked, offline, restrictive CSP).
      // Render a user-visible message so the tab isn't silently empty.
      host.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--ink-60);font-size:13px;line-height:1.5">
          <div style="font-size:28px;margin-bottom:8px">🗺️</div>
          Map couldn't load — check your connection or a blocker extension.<br>
          The list and swipe tabs still work offline-cached.
        </div>`;
      return;
    }
    const restaurants = getRestaurants();
    const points = restaurants.filter(r => isFinite(r.lat) && isFinite(r.lng));
    if (points.length === 0) return;

    if (!leafletMap) {
      leafletMap = L.map(host, {
        zoomControl: true,
        scrollWheelZoom: true,
        tap: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).addTo(leafletMap);

      const bounds = L.latLngBounds(points.map(r => [r.lat, r.lng])).pad(0.12);
      leafletMap.fitBounds(bounds);

      leafletMarkers = new Map();
      markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 16,
        maxClusterRadius: 40
      });
      for (const r of points) {
        const m = L.marker([r.lat, r.lng], {
          icon: pinIcon(saved.has(r.id), false),
          title: `${r.dish} — ${r.restaurant}`,
          riseOnHover: true,
        });
        m.bindPopup(
          `<div class="popup-dish">${esc(r.dish)}</div>
           <div class="popup-restaurant">${esc(r.restaurant)}</div>
           <div style="margin-top:4px"><a href="#" data-popup-id="${r.id}">Details →</a></div>`
        );
        m.on('click', () => showMapSelected(r));
        leafletMarkers.set(r.id, m);
        markerClusterGroup.addLayer(m);
      }
      leafletMap.addLayer(markerClusterGroup);

      // Delegate popup "Details" link clicks to openDetail.
      leafletMap.on('popupopen', e => {
        const link = e.popup.getElement().querySelector('a[data-popup-id]');
        if (link) link.addEventListener('click', ev => {
          ev.preventDefault();
          openDetail(parseInt(link.dataset.popupId, 10));
        });
      });
    } else {
      // Refresh pin styling for current saved set, preserving selection.
      for (const [id, m] of leafletMarkers) {
        m.setIcon(pinIcon(saved.has(id), id === selectedMapId));
      }
      // Keep the "Selected location" card in sync with the saved set so
      // its star/styling reflects changes made elsewhere (e.g. saving
      // from the detail sheet while a pin is selected).
      if (selectedMapId != null) {
        const r = getRestaurants().find(x => x.id === selectedMapId);
        if (r) {
          const el = document.getElementById('map-selected-card');
          el.innerHTML = `
            <div class="section-header">Selected location</div>
            <div class="cards-list" style="padding:0 0 8px">
              ${cardHTML(r)}
            </div>`;
        }
      }
    }
  }

  // Called when tab becomes visible so Leaflet can measure the container.
  function refreshMapLayout() {
    if (leafletMap) leafletMap.invalidateSize();
  }

  function showMapSelected(r) {
    selectedMapId = r.id;
    const el = document.getElementById('map-selected-card');
    el.innerHTML = `
      <div class="section-header">Selected location</div>
      <div class="cards-list" style="padding:0 0 8px">
        ${cardHTML(r)}
      </div>`;
    // Highlight the selected pin; reset the rest.
    if (leafletMarkers) {
      for (const [id, m] of leafletMarkers) {
        m.setIcon(pinIcon(saved.has(id), id === r.id));
      }
    }
  }

  // ── Swipe ──────────────────────────────────────────────────
  function buildSwipeQueue() {
    const pool = getRestaurants().filter(r => !saved.has(r.id) && !passed.has(r.id));
    // Fisher-Yates shuffle for variety on each rebuild.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    swipeQueue = pool;
    swipeIdx = 0;
  }

  function currentSwipeCard() {
    return swipeQueue && swipeIdx < swipeQueue.length ? swipeQueue[swipeIdx] : null;
  }

  function renderSwipe() {
    const deckEl = document.querySelector('.swipe-deck');
    if (!deckEl) return;

    const emptyEl = document.getElementById('swipe-empty');
    const ctrlsEl = document.getElementById('swipe-controls');
    const counterEl = document.getElementById('swipe-counter');

    // Remove any existing card elements
    deckEl.querySelectorAll('.swipe-card').forEach(el => el.remove());

    const undoBtn = document.getElementById('swipe-btn-undo');
    const passBtn = ctrlsEl ? ctrlsEl.querySelector('.swipe-pass') : null;
    const infoBtn = ctrlsEl ? ctrlsEl.querySelector('.swipe-info') : null;
    const likeBtn = ctrlsEl ? ctrlsEl.querySelector('.swipe-like') : null;

    if (undoBtn) undoBtn.disabled = (swipeIdx <= 0);

    const r = currentSwipeCard();
    if (!r) {
      emptyEl.style.display = 'flex';
      if (passBtn) passBtn.disabled = true;
      if (infoBtn) infoBtn.disabled = true;
      if (likeBtn) likeBtn.disabled = true;
      counterEl.textContent = 'Nothing left';
      return;
    }

    emptyEl.style.display = 'none';
    if (passBtn) passBtn.disabled = false;
    if (infoBtn) infoBtn.disabled = false;
    if (likeBtn) likeBtn.disabled = false;

    // Render up to 3 cards in the deck
    const maxStacked = 3;
    for (let i = maxStacked - 1; i >= 0; i--) {
      const idx = swipeIdx + i;
      if (idx >= swipeQueue.length) continue;

      const item = swipeQueue[idx];
      const isTop = (i === 0);

      const cardEl = document.createElement('div');
      cardEl.className = `swipe-card ${isTop ? 'swipe-card-top' : 'swipe-card-bg'}`;
      cardEl.dataset.id = item.id;
      cardEl.style.zIndex = 10 - i;

      if (isTop) {
        cardEl.id = 'swipe-card'; // Top card gets the ID so attachSwipeGestures works
      } else {
        // Shift and scale background cards based on viewport
        if (window.innerWidth >= 768) {
          // Hand of cards layout: fan out to the right
          cardEl.style.transform = `translate(${i * 60}px, ${i * 12}px) rotate(${i * 4}deg) scale(${1 - i * 0.05})`;
        } else {
          // Vertical stack layout (mobile)
          cardEl.style.transform = `scale(${1 - i * 0.05}) translateY(${i * 12}px)`;
        }
        cardEl.style.opacity = i === 1 ? '0.6' : '0.25';
        cardEl.style.pointerEvents = 'none';
      }

      const imageBlock = item.image
        ? `<img src="${esc(item.image)}" alt="" loading="eager">`
        : `<div class="swipe-card-emoji">${esc(item.emoji)}</div>`;

      cardEl.innerHTML = `
        <div class="swipe-card-image">${imageBlock}</div>
        <div class="swipe-card-body">
          <div class="swipe-card-dish">${esc(item.dish)}</div>
          <div class="swipe-card-restaurant">${esc(item.restaurant)}</div>
          <div class="swipe-card-neighborhood">📍 ${esc(item.neighborhood)}</div>
          <div class="swipe-card-desc">${esc(item.desc)}</div>
          <div class="swipe-card-tags">${buildTags(item)}</div>
        </div>
        ${isTop ? `
          <div class="swipe-stamp swipe-stamp-like">Like</div>
          <div class="swipe-stamp swipe-stamp-pass">Dislike</div>
        ` : ''}
      `;

      deckEl.insertBefore(cardEl, deckEl.firstChild);
    }

    // Re-attach gestures to the newly rendered top card
    attachSwipeGestures();

    const remaining = swipeQueue.length - swipeIdx;
    counterEl.textContent = `${remaining} to go · ${swipeIdx + 1}/${swipeQueue.length}`;
  }

  function swipe(dir) {
    if (swipeAnimating) return; // prevent spam-click / held-key double-advance
    const cardEl = document.getElementById('swipe-card');
    const r = currentSwipeCard();
    if (!r) return;

    if (dir === 'right') {
      saved.add(r.id);
      passed.delete(r.id);
      showToast('★ Saved!');
    } else {
      passed.add(r.id);
      saved.delete(r.id);
    }
    saveState();

    // Advance the index synchronously so guard + currentSwipeCard() reflect
    // the committed state immediately; the animation runs on the detached
    // visual card.
    swipeIdx++;
    swipeAnimating = true;

    const tx = dir === 'right' ? window.innerWidth : -window.innerWidth;
    const rot = dir === 'right' ? 18 : -18;
    cardEl.style.transition = 'transform 0.32s ease-out, opacity 0.32s ease-out';
    cardEl.style.transform = `translate(${tx}px, 40px) rotate(${rot}deg)`;
    cardEl.style.opacity = '0';

    setTimeout(() => {
      swipeAnimating = false;
      renderSwipe();
      // Other tabs' contents reflect the updated saved set.
      renderBrowse();
      renderSaved();
      renderFriends();
    }, 300);
  }

  function undoSwipe() {
    if (swipeIdx <= 0 || !swipeQueue || swipeAnimating) return;
    swipeIdx--;
    const r = swipeQueue[swipeIdx];
    saved.delete(r.id);
    passed.delete(r.id);
    saveState();

    // Animate card back from off-screen
    renderSwipe();

    const cardEl = document.getElementById('swipe-card');
    if (cardEl) {
      cardEl.style.transition = 'none';
      cardEl.style.transform = 'translate(-40px, 20px) rotate(-8deg)';
      cardEl.style.opacity = '0';
      cardEl.offsetHeight; // force reflow
      cardEl.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
      cardEl.style.transform = 'translate(0, 0) rotate(0deg)';
      cardEl.style.opacity = '1';
    }

    renderBrowse();
    renderSaved();
    renderFriends();
    showToast('Undo successful');
  }

  function skipSwipe() {
    if (swipeIdx >= swipeQueue.length || swipeAnimating) return;
    const r = swipeQueue[swipeIdx];

    // Move to end of queue instead of marking passed/saved
    swipeQueue.push(r);
    swipeIdx++;
    swipeAnimating = true;

    const cardEl = document.getElementById('swipe-card');
    cardEl.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
    cardEl.style.transform = `translateY(${window.innerHeight}px)`;
    cardEl.style.opacity = '0';

    setTimeout(() => {
      swipeAnimating = false;
      renderSwipe();
    }, 300);
  }

  function resetSwipe() {
    passed.clear();
    saveState();
    buildSwipeQueue();
    renderSwipe();
    showToast('Reshuffled');
  }

  function swipeOpenDetail() {
    const r = currentSwipeCard();
    if (r) openDetail(r.id);
  }

  function attachSwipeGestures() {
    const cardEl = document.getElementById('swipe-card');
    if (!cardEl) return;
    let startX = 0, startY = 0, isDown = false, pointerId = null;

    cardEl.addEventListener('pointerdown', e => {
      if (!currentSwipeCard()) return;
      isDown = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      cardEl.style.transition = '';
      try { cardEl.setPointerCapture(e.pointerId); } catch (err) { }
    });

    cardEl.addEventListener('pointermove', e => {
      if (!isDown || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rot = dx * 0.06;
      cardEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      const like = cardEl.querySelector('.swipe-stamp-like');
      const pass = cardEl.querySelector('.swipe-stamp-pass');
      if (like) like.style.opacity = Math.max(0, Math.min(1, dx / 120));
      if (pass) pass.style.opacity = Math.max(0, Math.min(1, -dx / 120));
    });

    const snapBack = () => {
      cardEl.style.transition = 'transform 0.2s ease';
      cardEl.style.transform = '';
      const like = cardEl.querySelector('.swipe-stamp-like');
      const pass = cardEl.querySelector('.swipe-stamp-pass');
      if (like) like.style.opacity = 0;
      if (pass) pass.style.opacity = 0;
    };

    cardEl.addEventListener('pointerup', e => {
      if (!isDown || e.pointerId !== pointerId) return;
      isDown = false;
      const dx = e.clientX - startX;
      const threshold = 100;
      if (dx > threshold) swipe('right');
      else if (dx < -threshold) swipe('left');
      else snapBack();
    });

    // pointercancel (gesture interruption, lost focus) — never commit.
    // The event's clientX is unreliable here, so treat it as "reset card".
    cardEl.addEventListener('pointercancel', () => {
      if (!isDown) return;
      isDown = false;
      snapBack();
    });
  }

  // ── Render All ─────────────────────────────────────────────
  function renderAll() {
    renderBrowse();
    renderSaved();
    renderFriends();
    if (activeTab === 'map') renderMap();
    if (activeTab === 'swipe') {
      if (!swipeQueue) buildSwipeQueue();
      renderSwipe();
    }
  }

  // ── Week / Theme Switcher Logic ─────────────────────────────
  function applyWeekTheme(week) {
    if (!week) return;
    const root = document.documentElement;
    const themeColor = week.color || '#C94B2C';
    let dark = week.colorDark || '#9E3318';
    let light = week.colorLight || '#F5E6DF';
    let pale = week.colorPale || '#FDF7F4';

    if (week.id === 'pizza-2026') {
      dark = '#9E3318';
      light = '#F5E6DF';
      pale = '#FDF7F4';
    }

    root.style.setProperty('--pizza', themeColor);
    root.style.setProperty('--pizza-dark', dark);
    root.style.setProperty('--pizza-light', light);
    root.style.setProperty('--pizza-pale', pale);
  }

  function renderHeader() {
    const week = window.FOOD_WEEKS.find(w => w.id === currentWeekId);
    if (!week) return;

    // Update select switcher value
    const select = document.getElementById('week-switcher');
    if (select) select.value = '';

    // Update all footer elements (sidebar on desktop, view footers on mobile/tablet)
    let dataSrcHtml = '';
    if (week.organizer === 'Portland Mercury') {
      dataSrcHtml = `<a href="${esc(week.url)}" target="_blank" rel="noopener">EverOut</a> &amp; <a href="https://www.portlandmercury.com" target="_blank" rel="noopener">Portland Mercury</a>`;
    } else {
      const label = week.organizer || 'EverOut';
      dataSrcHtml = `<a href="${esc(week.url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
    }
    const footers = document.querySelectorAll('.sidebar-footer, .view-footer');
    footers.forEach(el => {
      el.innerHTML = `PDX Food Week<br><a href="privacy.html">Privacy Policy</a> &nbsp;•&nbsp; <a href="terms.html">Terms of Use</a><br>Data from ${dataSrcHtml}.<br>Not affiliated with either.<br>Created by <a href="https://github.com/verdantly" target="_blank" rel="noopener">@verdantly</a> &amp; <a href="https://github.com/oberonix" target="_blank" rel="noopener">@oberonix</a>`;
    });

    // Update header title
    const titleEl = document.getElementById('header-title');
    if (titleEl) {
      const parts = week.name.split(' ');
      if (parts.length > 0) {
        const first = parts[0];
        const rest = parts.slice(1).join(' ');
        titleEl.innerHTML = `<em>${esc(first)}</em> ${esc(rest)}`;
      } else {
        titleEl.textContent = week.name;
      }
    }

    // Update header meta (dates, price pills, location count)
    const metaEl = document.getElementById('header-meta');
    if (metaEl) {
      const dates = `<span>${esc(week.dates)}</span>`;
      const pills = (week.pricePills || []).map(p => `<span class="pill">${esc(p)}</span>`).join('');
      const locations = `<span>${week.totalLocations || getRestaurants().length} locations</span>`;
      metaEl.innerHTML = dates + pills + locations;
    }

    // Dynamic browser tab title updates
    document.title = `PDX ${week.name}`;

    // Dynamic map canvas accessibility label
    const mapCanvas = document.getElementById('map-canvas');
    if (mapCanvas) {
      mapCanvas.setAttribute('aria-label', `Map of Portland ${week.name} locations`);
    }
  }

  function renderFilters() {
    const filters = WEEK_FILTERS[currentWeekId] || [];
    const container = document.getElementById('browse-filters');
    if (!container) return;

    if (filters.length === 0) {
      container.innerHTML = '';
      return;
    }

    const labelHTML = `<span class="filter-label">Filter:</span>`;
    const chipsHTML = `<div class="filter-chips-wrapper">` + filters.map(f => {
      const activeCls = activeFilters.has(f.id) ? 'active' : '';
      return `<button class="filter-chip ${activeCls}" onclick="App.toggleFilter('${f.id}')">${esc(f.label)}</button>`;
    }).join('') + `</div>`;

    container.innerHTML = labelHTML + chipsHTML;
  }

  function updateFilterDisplay() {
    renderFilters();
  }

  function switchWeek(weekId) {
    if (!window.FOOD_WEEKS.some(w => w.id === weekId)) return;

    currentWeekId = weekId;
    saveState();

    // Reset filters and search
    activeFilters.clear();
    searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    // Reset activeSort and sort chips active states
    activeSort = 'restaurant';
    document.querySelectorAll('#sort-row button.filter-chip').forEach(btn => {
      if (btn.textContent.includes('Restaurant')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Reset Swipe queue
    swipeQueue = null;

    // Reset Leaflet Map
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      leafletMarkers = null;
      markerClusterGroup = null;
    }
    selectedMapId = null;
    const mapCard = document.getElementById('map-selected-card');
    if (mapCard) mapCard.innerHTML = '';

    // Update theme, header, and filter displays
    const week = window.FOOD_WEEKS.find(w => w.id === currentWeekId);
    applyWeekTheme(week);
    renderHeader();
    updateFilterDisplay();

    const url = new URL(window.location);
    url.searchParams.set('week', weekId);
    url.searchParams.delete('tab');
    history.pushState({ ...history.state, week: weekId, tab: 'browse' }, '', url);
    document.body.classList.remove('is-landing');

    switchTab('browse');
    renderAll();

    showToast(`Switched to ${week.name}!`);
  }

  function renderLanding() {
    const grid = document.getElementById('landing-grid');
    if (!grid) return;

    // Determine the next upcoming event
    const now = new Date('2026-06-08T00:00:00Z'); // Using today's date context
    let nextWeek = null;
    let minDiff = Infinity;

    window.FOOD_WEEKS.forEach(w => {
      if (w.startDate) {
        const start = new Date(w.startDate);
        const diff = start - now;
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          nextWeek = w;
        }
      }
    });

    const sortedWeeks = [...window.FOOD_WEEKS].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
      const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
      return dateB - dateA; // reverse chronological (newest first)
    });

    grid.innerHTML = sortedWeeks.map(w => {
      const isNext = nextWeek && w.id === nextWeek.id;
      const badgeHTML = isNext ? '<div class="badge-upcoming">Next</div>' : '';
      return `
        <a href="?week=${w.id}" class="landing-card" onclick="event.preventDefault(); App.switchWeek('${w.id}');">
          ${badgeHTML}
          <div class="landing-emoji">${w.emoji || '🍽️'}</div>
          <h3>${esc(w.name)}</h3>
          <p>${esc(w.dates)}</p>
          <button class="landing-btn" style="background: ${w.color || 'var(--ink)'}">Explore</button>
        </a>
      `;
    }).join('');
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    loadState();

    const urlParams = new URLSearchParams(window.location.search);
    const urlWeekId = urlParams.get('week');

    // Wire up popstate to handle browser back button closing detail sheet and tab navigation
    window.addEventListener('popstate', e => {
      if (e.state && e.state.detailDishId !== undefined) {
        openDetail(e.state.detailDishId, true);
      } else if (selectedDish) {
        closeDetail(true);
      }

      const tab = (e.state && e.state.tab) || new URLSearchParams(window.location.search).get('tab') || 'browse';
      if (activeTab !== tab && currentWeekId) {
        switchTab(tab, true);
      }
    });

    // Wire up detail overlay close
    document.getElementById('detail-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeDetail();
    });

    // Wire up search
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchInput && searchClearBtn) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        searchClearBtn.style.display = searchQuery ? 'flex' : 'none';
        renderBrowse();
      });
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        searchInput.focus();
        renderBrowse();
      });
    }

    // Handle auto-import from URL Magic Link
    const shareListId = urlParams.get('list');
    const shareFallback = urlParams.get('fallback');
    if (shareListId || shareFallback) {
      setTimeout(async () => {
        // Mocking an input event for addFriend
        const input = document.getElementById('friend-code-input');
        input.value = window.location.href;
        await addFriend();
        // Clean URL without reloading to avoid multiple imports
        window.history.replaceState({}, document.title, window.location.pathname + '?week=' + currentWeekId);
        if (activeTab !== 'friends') switchTab('friends');
      }, 500);
    }

    // Wire up friend code input (Enter key)
    document.getElementById('friend-code-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addFriend();
    });

    // Wire up zip code input (Enter key)
    const zipCodeInput = document.getElementById('zip-code-input');
    if (zipCodeInput) {
      zipCodeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') applyZipCode();
      });
    }

    // Swipe gestures + keyboard shortcuts
    attachSwipeGestures();
    document.addEventListener('keydown', e => {
      // Handle keydown events when the detail overlay is open
      const overlay = document.getElementById('detail-overlay');
      if (overlay && overlay.classList.contains('open')) {
        if (e.target && /INPUT|TEXTAREA/i.test(e.target.tagName)) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDetail();
        } else if (e.key === 'ArrowLeft') {
          const list = getCurrentContextList();
          const idx = selectedDish ? list.findIndex(x => x.id === selectedDish.id) : -1;
          const prevId = idx > 0 ? list[idx - 1].id : null;
          if (prevId) {
            e.preventDefault();
            openDetail(prevId);
          }
        } else if (e.key === 'ArrowRight') {
          const list = getCurrentContextList();
          const idx = selectedDish ? list.findIndex(x => x.id === selectedDish.id) : -1;
          const nextId = idx !== -1 && idx < list.length - 1 ? list[idx + 1].id : null;
          if (nextId) {
            e.preventDefault();
            openDetail(nextId);
          }
        }
        return;
      }

      // Handle swipe view shortcuts
      if (activeTab !== 'swipe') return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); swipe('right'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); swipe('left'); }
    });

    if (!urlWeekId) {
      currentWeekId = null;
      switchTab('landing', true);
      renderLanding();
      return; // Stop app initialization
    } else if (window.FOOD_WEEKS.some(w => w.id === urlWeekId)) {
      currentWeekId = urlWeekId;
      document.body.classList.remove('is-landing');
    }

    // Apply active week's initial theme, header metadata, and dynamic filters
    const week = window.FOOD_WEEKS.find(w => w.id === currentWeekId);
    applyWeekTheme(week);
    renderHeader();
    updateFilterDisplay();

    // Set initial tab from URL
    const initialTab = urlParams.get('tab');
    if (initialTab && ['browse', 'swipe', 'saved', 'friends', 'map'].includes(initialTab)) {
      switchTab(initialTab, true);
    } else {
      switchTab('browse', true);
    }
    renderAll();

    // Deep linking: Open detail sheet if dish ID in URL
    const initialDishId = urlParams.get('dish');
    if (initialDishId) {
      setTimeout(() => openDetail(parseInt(initialDishId, 10), true), 100);
    }

    // Re-render swipe deck on window resize to ensure correct responsive fanning transforms
    window.addEventListener('resize', () => {
      if (activeTab === 'swipe') renderSwipe();
    });
  }

  return { init, switchTab, toggleFilter, setSort, toggleSave, openDetail, closeDetail, addFriend, renameFriend, removeFriend, swipe, undoSwipe, resetSwipe, swipeOpenDetail, skipSwipe, switchWeek, exportSavedToClipboard, setRating, setNote, toggleDistanceSort, applyZipCode, generateShareLink, copyTextFromElement, shareNative };
})();

window.App = App;

const isTestMode = window.location.search.includes('test=true');
if (!isTestMode) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }
}
