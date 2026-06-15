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
  let activeSavedFilters = new Set();
  let savedSearchQuery = '';
  let activeSavedSort = 'restaurant';
  let customSavedOrder = [];
  let saved = new Set();
  let passed = new Set();
  let friends = [];
  let viewedNew = new Set();
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
  const STORAGE_KEY_VIEWED_NEW = 'pdxfw_viewed_new_v1';
  const STORAGE_KEY_SAVED_SORT = 'pdxfw_saved_sort_v1';
  const STORAGE_KEY_CUSTOM_ORDER = 'pdxfw_custom_order_v1';

  const WEEK_FILTERS = {
    'pizza-2026': [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' },
      { id: 'pie', label: 'Whole Pie' },
      { id: 'minors', label: 'Family OK' }
    ],
    'highball-2026': [
      { id: 'minors', label: 'Minors OK' },
      { id: '21plus', label: '21+ Only' },
      { id: 'takeout', label: 'Takeout OK' }
    ],
    'taco-2026': [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' },
      { id: 'spicy', label: 'Spicy' }
    ],
    'nacho-2026': [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
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
      const vn = localStorage.getItem(STORAGE_KEY_VIEWED_NEW);
      if (vn) viewedNew = new Set(JSON.parse(vn));
      const ss = localStorage.getItem(STORAGE_KEY_SAVED_SORT);
      if (ss) activeSavedSort = ss;
      const co = localStorage.getItem(STORAGE_KEY_CUSTOM_ORDER);
      if (co) {
        customSavedOrder = JSON.parse(co);
      } else {
        customSavedOrder = [...saved];
      }
      // Keep customSavedOrder in sync with saved items
      for (const id of saved) {
        if (!customSavedOrder.includes(id)) {
          customSavedOrder.push(id);
        }
      }
      customSavedOrder = customSavedOrder.filter(id => saved.has(id));
    } catch (e) { }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...saved]));
      localStorage.setItem(STORAGE_KEY_PASSED, JSON.stringify([...passed]));
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
      localStorage.setItem(STORAGE_KEY_WEEK, currentWeekId);
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
      localStorage.setItem(STORAGE_KEY_VIEWED_NEW, JSON.stringify([...viewedNew]));
      localStorage.setItem(STORAGE_KEY_SAVED_SORT, activeSavedSort);
      localStorage.setItem(STORAGE_KEY_CUSTOM_ORDER, JSON.stringify(customSavedOrder));
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

  function updateBrowseBadge() {
    const browseTab = document.querySelector('[data-tab="browse"]');
    if (!browseTab) return;
    const badge = browseTab.querySelector('.badge-dot');
    if (!badge) return;

    const banner = document.getElementById('new-listings-banner');

    if (!currentWeekId) {
      badge.classList.remove('show');
      if (banner) banner.style.display = 'none';
      return;
    }

    const activeWeekRestaurants = getRestaurants();
    const newItems = activeWeekRestaurants.filter(r => r.isNew);
    const unviewedNewItems = newItems.filter(r => !viewedNew.has(r.id));
    const hasUnviewedNew = unviewedNewItems.length > 0;

    badge.classList.toggle('show', hasUnviewedNew);

    if (banner) {
      const isDismissed = localStorage.getItem(`pdxfw_dismissed_banner_${currentWeekId}`) === 'true';
      if (hasUnviewedNew && !isDismissed) {
        const week = window.FOOD_WEEKS.find(w => w.id === currentWeekId);
        const foodType = week ? week.name.split(' ')[0].toLowerCase() : 'listing';
        const weekDisplayName = week ? week.name.replace(/\s*\d{4}/, '') : 'this week';
        
        let message = '';
        if (unviewedNewItems.length === 1) {
          message = `There is one new ${foodType} listing for ${weekDisplayName}!`;
        } else {
          message = `There are ${unviewedNewItems.length} new ${foodType} listings for ${weekDisplayName}!`;
        }

        banner.style.display = 'flex';
        banner.innerHTML = `
          <span class="banner-icon">✨</span>
          <span class="banner-text">${message}</span>
          <button class="banner-close" aria-label="Dismiss notification" onclick="App.dismissNewBanner()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        `;
      } else {
        banner.style.display = 'none';
      }
    }
  }

  function dismissNewBanner() {
    if (currentWeekId) {
      localStorage.setItem(`pdxfw_dismissed_banner_${currentWeekId}`, 'true');
      updateBrowseBadge();
    }
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
      if (activeFilters.has('new') && !(r.isNew && !viewedNew.has(r.id))) return false;
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

    savedItems = savedItems.filter(r => {
      if (activeSavedFilters.has('meat') && r.type !== 'meat') return false;
      if (activeSavedFilters.has('vegetarian') && !isVegetarianFriendly(r)) return false;
      if (activeSavedFilters.has('vegan') && !isVeganFriendly(r)) return false;
      if (activeSavedFilters.has('gf') && !r.glutenFree) return false;
      if (activeSavedFilters.has('pie') && !r.wholePie) return false;
      if (activeSavedFilters.has('minors') && !r.minors) return false;
      if (activeSavedFilters.has('21plus') && r.minors) return false;
      if (activeSavedFilters.has('takeout') && !r.takeout) return false;
      if (activeSavedFilters.has('spicy') && !r.spicy) return false;
      if (activeSavedFilters.has('new') && !(r.isNew && !viewedNew.has(r.id))) return false;
      if (savedSearchQuery) {
        const q = savedSearchQuery.toLowerCase();
        if (!r.dish.toLowerCase().includes(q) &&
          !r.restaurant.toLowerCase().includes(q) &&
          !r.neighborhood.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (activeSavedSort === 'dish') {
      savedItems.sort((a, b) => a.dish.localeCompare(b.dish));
    } else if (activeSavedSort === 'restaurant') {
      savedItems.sort((a, b) => a.restaurant.localeCompare(b.restaurant));
    } else if (activeSavedSort === 'distance' && userLat !== null && userLng !== null) {
      savedItems.sort((a, b) => {
        const d1 = haversineDistance(userLat, userLng, a.lat, a.lng);
        const d2 = haversineDistance(userLat, userLng, b.lat, b.lng);
        return d1 - d2;
      });
    } else if (activeSavedSort === 'custom') {
      savedItems.sort((a, b) => {
        let idxA = customSavedOrder.indexOf(a.id);
        let idxB = customSavedOrder.indexOf(b.id);
        if (idxA === -1) idxA = 999999;
        if (idxB === -1) idxB = 999999;
        if (idxA === idxB) {
          return a.id - b.id;
        }
        return idxA - idxB;
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
  function cardHTML(r, overlap, isSavedTab = false, index = -1, totalCount = -1) {
    const isSaved = saved.has(r.id);
    const cls = ['dish-card', isSaved ? 'bookmarked' : '', overlap ? 'overlap-card' : ''].filter(Boolean).join(' ');
    const thumb = r.image
      ? `<div class="card-emoji card-thumb"><img src="${esc(r.image)}" alt="" loading="lazy"></div>`
      : `<div class="card-emoji">${esc(r.emoji)}</div>`;

    const sortType = isSavedTab ? activeSavedSort : activeSort;
    const dist = (sortType === 'distance' && userLat !== null && userLng !== null)
      ? ` <span style="font-size: 13px; font-weight: normal; color: var(--ink-60);">(${haversineDistance(userLat, userLng, r.lat, r.lng).toFixed(1)} mi)</span>`
      : '';

    const restaurantHtml = r.restaurantUrl
      ? `<a href="${esc(r.restaurantUrl)}" target="_blank" rel="noopener" class="venue-link" onclick="event.stopPropagation()">${esc(r.restaurant)} <span class="mobile-arrow">↗</span></a>`
      : esc(r.restaurant);

    const isNew = r.isNew && !viewedNew.has(r.id);

    let dragHandleHtml = '';
    if (isSavedTab && activeSavedSort === 'custom') {
      const isFirst = index === 0;
      const isLast = index === totalCount - 1;
      dragHandleHtml = `
        <div class="drag-handle-container" onclick="event.stopPropagation()">
          <div class="drag-grip" title="Drag to reorder">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="5" r="1" fill="currentColor"></circle>
              <circle cx="9" cy="12" r="1" fill="currentColor"></circle>
              <circle cx="9" cy="19" r="1" fill="currentColor"></circle>
              <circle cx="15" cy="5" r="1" fill="currentColor"></circle>
              <circle cx="15" cy="12" r="1" fill="currentColor"></circle>
              <circle cx="15" cy="19" r="1" fill="currentColor"></circle>
            </svg>
          </div>
          <div class="reorder-btns">
            <button class="reorder-btn reorder-up" onclick="event.stopPropagation(); App.moveSavedItem(${r.id}, -1)" aria-label="Move up" ${isFirst ? 'disabled' : ''}>
              ▲
            </button>
            <button class="reorder-btn reorder-down" onclick="event.stopPropagation(); App.moveSavedItem(${r.id}, 1)" aria-label="Move down" ${isLast ? 'disabled' : ''}>
              ▼
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="${cls}" data-id="${r.id}" onclick="App.openDetail(${r.id})" ${isSavedTab && activeSavedSort === 'custom' ? 'draggable="true"' : ''}>
        ${dragHandleHtml}
        ${thumb}
        <div class="card-body">
          <div class="card-dish">${esc(r.dish)}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
          <div class="card-restaurant">${restaurantHtml}${dist}</div>
          <div class="card-neighborhood">📍 ${esc(r.neighborhood)}</div>
          <div class="card-desc">${esc(r.desc)}</div>
          <div class="card-tags">${buildTags(r)}</div>
        </div>
        <button class="bookmark-btn ${isSaved ? 'saved' : ''}"
          onclick="event.stopPropagation(); App.toggleSave(${r.id})"
          aria-label="${isSaved ? 'Remove bookmark' : 'Bookmark this dish'}">
          <svg class="save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="save-text">${isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>`;
  }

  // ── Toggle save ────────────────────────────────────────────
  function toggleSave(id) {
    if (saved.has(id)) {
      saved.delete(id);
      customSavedOrder = customSavedOrder.filter(x => x !== id);
      showToast('Removed from saved');
    } else {
      saved.add(id);
      passed.delete(id);
      if (!customSavedOrder.includes(id)) {
        customSavedOrder.push(id);
      }
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

  let noteSaveTimeout = null;
  function handleNoteInput(id, text) {
    const ind = document.getElementById('note-save-indicator');
    if (ind) {
      ind.style.opacity = '1';
      ind.textContent = 'Saving...';
    }
    clearTimeout(noteSaveTimeout);
    noteSaveTimeout = setTimeout(() => {
      if (!notes[id]) notes[id] = { rating: 0, note: '' };
      notes[id].note = text;
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

  function getCurrentContextList() {
    if (activeTab === 'saved') return getSaved();
    if (activeTab === 'share') {
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

    const wasAlreadyOpen = document.getElementById('detail-overlay').classList.contains('open');
    const isNew = r.isNew && !viewedNew.has(r.id);

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

    const contentHtml = `
      <button class="sheet-close" onclick="App.closeDetail()" aria-label="Close">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="sheet-handle"></div>
      ${hero}
      <div class="sheet-dish">${esc(r.dish)}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
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
          <svg class="save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          ${isSaved ? 'Saved' : 'Save'}
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
        <textarea class="note-input" placeholder="Add your personal notes..." oninput="App.handleNoteInput(${r.id}, this.value)" style="width: 100%; border: 1px solid var(--ink-20); border-radius: 8px; padding: 12px; font-family: inherit; font-size: 14px; resize: vertical; min-height: 80px;">${notes[r.id] && notes[r.id].note ? esc(notes[r.id].note) : ''}</textarea>
      </div>` : ''}
    `;

    const sheetEl = document.getElementById('detail-sheet-content');
    if (!sheetEl) return;

    const doUpdate = () => {
      sheetEl.innerHTML = contentHtml;

      // Mark as viewed
      if (isNew) {
        viewedNew.add(r.id);
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

      // Shift focus to the close button inside the detail sheet for accessibility (only on mobile modal layout)
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
      // If already open, apply smooth content cross-fade
      sheetEl.style.transition = 'opacity 0.15s ease-out';
      sheetEl.style.opacity = '0';
      setTimeout(() => {
        doUpdate();
        sheetEl.style.transition = 'opacity 0.2s ease-in';
        sheetEl.style.opacity = '1';
      }, 150);
    } else {
      // Opening fresh: reset opacity immediately
      sheetEl.style.opacity = '1';
      sheetEl.style.transition = '';
      doUpdate();
      overlay.classList.add('open');
      document.getElementById('app').classList.add('detail-open');
      if (window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
      }
      if (activeTab === 'map') {
        setTimeout(refreshMapLayout, 360);
      }
    }

    if (!fromPopState) {
      const url = new URL(window.location);
      url.searchParams.set('dish', id);
      if (wasAlreadyOpen) {
        history.replaceState({ detailDishId: id }, '', url);
      } else {
        history.pushState({ detailDishId: id }, '', url);
      }
    }
  }

  function closeDetail(fromPopState = false) {
    document.getElementById('detail-overlay').classList.remove('open');
    document.getElementById('app').classList.remove('detail-open');
    document.body.style.overflow = '';
    selectedDish = null;

    if (activeTab === 'map') {
      setTimeout(refreshMapLayout, 360);
    }

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
    if (typeof filterDrawerOpen !== 'undefined' && filterDrawerOpen) {
      closeFilterDrawer();
    }
    if (window.App && App.hideCompactDropdowns) {
      App.hideCompactDropdowns();
    }
    activeTab = name;
    document.querySelectorAll('.nav-tab, .compact-menu-item').forEach(el => {
      const isActive = el.dataset.tab === name;
      el.classList.toggle('active', isActive);
      if (el.classList.contains('nav-tab')) {
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
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

    const appContainer = document.getElementById('app');
    const fabButton = document.getElementById('mobile-filter-fab');
    if (appContainer) appContainer.classList.remove('compact-header');
    if (fabButton) fabButton.classList.remove('show-fab');
    lastScrollTop = 0;

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
    if (sortSection) {
      sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    }
    if (el) el.classList.add('active');
    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    renderBrowse();
  }

  function toggleDistanceSort(el) {
    const zipContainer = document.getElementById('zip-code-container');
    const sortSection = document.getElementById('sort-section');
    if (activeSort === 'distance') {
      // Revert to default
      setSort('restaurant', sortSection ? sortSection.querySelector('button.filter-chip') : null);
    } else {
      activeSort = 'distance';
      if (sortSection) {
        sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      }
      if (el) el.classList.add('active');

      if (userLat !== null && userLng !== null) {
        if (zipContainer) zipContainer.style.display = 'none';
        renderBrowse();
      } else {
        if (zipContainer) zipContainer.style.display = 'flex';
      }
    }
  }

  // Local cache of Portland metropolitan area zip codes to avoid hitting the external API
  const PORTLAND_ZIP_CACHE = {
    "97005": { lat: 45.4963, lng: -122.8001 },
    "97006": { lat: 45.5201, lng: -122.8604 },
    "97007": { lat: 45.4505, lng: -122.8652 },
    "97008": { lat: 45.4560, lng: -122.7996 },
    "97015": { lat: 45.4150, lng: -122.5200 },
    "97027": { lat: 45.3899, lng: -122.5902 },
    "97030": { lat: 45.5154, lng: -122.4203 },
    "97034": { lat: 45.4093, lng: -122.6847 },
    "97035": { lat: 45.4147, lng: -122.7227 },
    "97060": { lat: 45.5254, lng: -122.3739 },
    "97062": { lat: 45.3727, lng: -122.7631 },
    "97068": { lat: 45.3669, lng: -122.6480 },
    "97070": { lat: 45.2986, lng: -122.7699 },
    "97080": { lat: 45.4817, lng: -122.4156 },
    "97086": { lat: 45.4446, lng: -122.5372 },
    "97123": { lat: 45.4984, lng: -122.9570 },
    "97124": { lat: 45.5387, lng: -122.9636 },
    "97201": { lat: 45.5078, lng: -122.6897 },
    "97202": { lat: 45.4840, lng: -122.6365 },
    "97203": { lat: 45.5889, lng: -122.7347 },
    "97204": { lat: 45.5181, lng: -122.6745 },
    "97205": { lat: 45.5207, lng: -122.6888 },
    "97206": { lat: 45.4840, lng: -122.5973 },
    "97207": { lat: 45.4803, lng: -122.7111 },
    "97208": { lat: 45.5322, lng: -122.5648 },
    "97209": { lat: 45.5270, lng: -122.6854 },
    "97210": { lat: 45.5303, lng: -122.7033 },
    "97211": { lat: 45.5653, lng: -122.6448 },
    "97212": { lat: 45.5441, lng: -122.6423 },
    "97213": { lat: 45.5373, lng: -122.5987 },
    "97214": { lat: 45.5142, lng: -122.6364 },
    "97215": { lat: 45.5143, lng: -122.5990 },
    "97216": { lat: 45.5137, lng: -122.5569 },
    "97217": { lat: 45.5742, lng: -122.6842 },
    "97218": { lat: 45.5600, lng: -122.6001 },
    "97219": { lat: 45.4580, lng: -122.7074 },
    "97220": { lat: 45.5411, lng: -122.5566 },
    "97221": { lat: 45.4918, lng: -122.7267 },
    "97222": { lat: 45.4373, lng: -122.6147 },
    "97223": { lat: 45.4403, lng: -122.7793 },
    "97224": { lat: 45.4094, lng: -122.8014 },
    "97225": { lat: 45.4985, lng: -122.7787 },
    "97227": { lat: 45.5496, lng: -122.6743 },
    "97229": { lat: 45.5483, lng: -122.8276 },
    "97230": { lat: 45.5472, lng: -122.5001 },
    "97231": { lat: 45.6401, lng: -122.8380 },
    "97232": { lat: 45.5287, lng: -122.6363 },
    "97233": { lat: 45.5142, lng: -122.4985 },
    "97236": { lat: 45.4887, lng: -122.5091 },
    "97239": { lat: 45.4983, lng: -122.6913 },
    "97266": { lat: 45.4762, lng: -122.5596 },
    "97267": { lat: 45.4021, lng: -122.6144 }
  };

  async function applyZipCode() {
    const zipInput = document.getElementById('zip-code-input');
    const zip = zipInput.value.trim();
    if (!zip || zip.length !== 5) {
      showToast('⚠️ Please enter a valid 5-digit zip code');
      return;
    }

    if (PORTLAND_ZIP_CACHE[zip]) {
      userLat = PORTLAND_ZIP_CACHE[zip].lat;
      userLng = PORTLAND_ZIP_CACHE[zip].lng;
      
      // Sync ZIP inputs
      const savedZipInput = document.getElementById('saved-zip-code-input');
      if (savedZipInput) savedZipInput.value = zip;
      
      const zipContainer = document.getElementById('zip-code-container');
      if (zipContainer) zipContainer.style.display = 'none';
      const savedZipContainer = document.getElementById('saved-zip-code-container');
      if (savedZipContainer) savedZipContainer.style.display = 'none';

      renderBrowse();
      renderSaved();
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

      // Sync ZIP inputs
      const savedZipInput = document.getElementById('saved-zip-code-input');
      if (savedZipInput) savedZipInput.value = zip;

      const zipContainer = document.getElementById('zip-code-container');
      if (zipContainer) zipContainer.style.display = 'none';
      const savedZipContainer = document.getElementById('saved-zip-code-container');
      if (savedZipContainer) savedZipContainer.style.display = 'none';

      renderBrowse();
      renderSaved();
    } catch (e) {
      showToast('⚠️ Could not find that zip code');
    } finally {
      zipInput.nextElementSibling.textContent = 'Go';
    }
  }

  // ── Saved Tab Filter & Sort & Reorder ───────────────────────
  function toggleSavedFilter(f) {
    if (activeSavedFilters.has(f)) {
      activeSavedFilters.delete(f);
    } else {
      activeSavedFilters.add(f);
    }
    renderSavedFilters();
    renderSaved();
  }

  function renderSavedFilters() {
    let filters = [...(WEEK_FILTERS[currentWeekId] || [])];
    const activeWeekRestaurants = getRestaurants();
    const hasAnyNew = activeWeekRestaurants.some(r => r.isNew);
    if (hasAnyNew) {
      filters.push({ id: 'new', label: 'New' });
    }
    const container = document.getElementById('saved-filters');
    if (!container) return;

    if (filters.length === 0) {
      container.innerHTML = '';
      return;
    }

    const labelHTML = `<span class="filter-label">Filter:</span>`;
    const chipsHTML = `<div class="filter-chips-wrapper">` + filters.map(f => {
      const activeCls = activeSavedFilters.has(f.id) ? 'active' : '';
      return `<button class="filter-chip ${activeCls}" onclick="App.toggleSavedFilter('${f.id}')">${esc(f.label)}</button>`;
    }).join('') + `</div>`;

    container.innerHTML = labelHTML + chipsHTML;
  }

  function setSavedSort(s, el) {
    activeSavedSort = s;
    const sortSection = document.getElementById('saved-sort-section');
    if (sortSection) {
      sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    }
    if (el) el.classList.add('active');
    const zipContainer = document.getElementById('saved-zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    saveState();
    renderSaved();
  }

  function toggleSavedDistanceSort(el) {
    const zipContainer = document.getElementById('saved-zip-code-container');
    const sortSection = document.getElementById('saved-sort-section');
    if (activeSavedSort === 'distance') {
      // Revert to default
      setSavedSort('restaurant', sortSection ? sortSection.querySelector('button.filter-chip') : null);
    } else {
      activeSavedSort = 'distance';
      if (sortSection) {
        sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      }
      if (el) el.classList.add('active');

      if (userLat !== null && userLng !== null) {
        if (zipContainer) zipContainer.style.display = 'none';
        saveState();
        renderSaved();
      } else {
        if (zipContainer) zipContainer.style.display = 'flex';
      }
    }
  }

  async function applySavedZipCode() {
    const zipInput = document.getElementById('saved-zip-code-input');
    const zip = zipInput.value.trim();
    if (!zip || zip.length !== 5) {
      showToast('⚠️ Please enter a valid 5-digit zip code');
      return;
    }

    if (PORTLAND_ZIP_CACHE[zip]) {
      userLat = PORTLAND_ZIP_CACHE[zip].lat;
      userLng = PORTLAND_ZIP_CACHE[zip].lng;
      
      // Sync ZIP inputs
      const browseZipInput = document.getElementById('zip-code-input');
      if (browseZipInput) browseZipInput.value = zip;

      const zipContainer = document.getElementById('zip-code-container');
      if (zipContainer) zipContainer.style.display = 'none';
      const savedZipContainer = document.getElementById('saved-zip-code-container');
      if (savedZipContainer) savedZipContainer.style.display = 'none';

      renderBrowse();
      renderSaved();
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

      // Sync ZIP inputs
      const browseZipInput = document.getElementById('zip-code-input');
      if (browseZipInput) browseZipInput.value = zip;

      const zipContainer = document.getElementById('zip-code-container');
      if (zipContainer) zipContainer.style.display = 'none';
      const savedZipContainer = document.getElementById('saved-zip-code-container');
      if (savedZipContainer) savedZipContainer.style.display = 'none';

      renderBrowse();
      renderSaved();
    } catch (e) {
      showToast('⚠️ Could not find that zip code');
    } finally {
      zipInput.nextElementSibling.textContent = 'Go';
    }
  }

  function moveSavedItem(id, direction) {
    const currentSavedItems = getSaved();
    const savedIds = currentSavedItems.map(r => r.id);
    const idx = savedIds.indexOf(id);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= savedIds.length) return;

    // Swap items
    const targetId = savedIds[newIdx];
    savedIds[idx] = targetId;
    savedIds[newIdx] = id;

    // Update customSavedOrder
    const remainingIds = [...saved].filter(x => !savedIds.includes(x));
    customSavedOrder = [...savedIds, ...remainingIds];

    saveState();
    renderSaved();
  }

  function reorderSavedItems(draggedId, targetId, insertAfter) {
    const currentSavedItems = getSaved();
    const savedIds = currentSavedItems.map(r => r.id);
    const dragIdx = savedIds.indexOf(draggedId);
    let targetIdx = savedIds.indexOf(targetId);

    if (dragIdx === -1 || targetIdx === -1) return;

    savedIds.splice(dragIdx, 1);
    targetIdx = savedIds.indexOf(targetId);
    if (insertAfter) {
      savedIds.splice(targetIdx + 1, 0, draggedId);
    } else {
      savedIds.splice(targetIdx, 0, draggedId);
    }

    const remainingIds = [...saved].filter(x => !savedIds.includes(x));
    customSavedOrder = [...savedIds, ...remainingIds];

    saveState();
    renderSaved();
  }

  let draggedCardId = null;

  function setupSavedDragEvents() {
    const cards = document.querySelectorAll('#cards-saved .dish-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        if (activeSavedSort !== 'custom') return;
        draggedCardId = Number(card.getAttribute('data-id'));
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedCardId);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        cards.forEach(c => {
          c.classList.remove('drag-over-top');
          c.classList.remove('drag-over-bottom');
        });
        draggedCardId = null;
      });

      card.addEventListener('dragover', (e) => {
        if (activeSavedSort !== 'custom' || draggedCardId === null) return;
        const targetId = Number(card.getAttribute('data-id'));
        if (targetId === draggedCardId) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const rect = card.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        if (relativeY < rect.height / 2) {
          card.classList.add('drag-over-top');
          card.classList.remove('drag-over-bottom');
        } else {
          card.classList.add('drag-over-bottom');
          card.classList.remove('drag-over-top');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over-top');
        card.classList.remove('drag-over-bottom');
      });

      card.addEventListener('drop', (e) => {
        if (activeSavedSort !== 'custom' || draggedCardId === null) return;
        e.preventDefault();
        const targetId = Number(card.getAttribute('data-id'));
        if (targetId === draggedCardId) return;

        const rect = card.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const insertAfter = relativeY >= rect.height / 2;

        reorderSavedItems(draggedCardId, targetId, insertAfter);
      });
    });
  }

  // ── Render: Browse ─────────────────────────────────────────
  function renderBrowse() {
    const filtered = getFiltered();
    const container = document.getElementById('cards-browse');
    if (!container) return;
    if (filtered.length === 0) {
      container.innerHTML = `<div class="no-results">
        <img src="https://cdn-icons-png.flaticon.com/512/1046/1046857.png" alt="Empty plate" width="48" height="48" style="margin-bottom: 16px; opacity: 0.8;" />
        <p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">Nothing on the menu</p>
        <p style="color: var(--ink-60);">Try a different filter!</p>
      </div>`;
    } else {
      container.innerHTML = filtered.map(r => cardHTML(r)).join('');
    }
    container.classList.remove('fade-in');
    void container.offsetWidth; // trigger reflow
    container.classList.add('fade-in');
  }

  // ── Render: Saved ──────────────────────────────────────────
  function renderSaved() {
    // Preserve focus state for accessibility
    const activeEl = document.activeElement;
    let focusSelector = null;
    if (activeEl && activeEl.closest('#cards-saved')) {
      const card = activeEl.closest('.dish-card');
      if (card) {
        const id = card.getAttribute('data-id');
        const isUp = activeEl.classList.contains('reorder-up');
        const isDown = activeEl.classList.contains('reorder-down');
        if (isUp) {
          focusSelector = `#cards-saved .dish-card[data-id="${id}"] .reorder-up`;
        } else if (isDown) {
          focusSelector = `#cards-saved .dish-card[data-id="${id}"] .reorder-down`;
        }
      }
    }

    const items = getSaved();
    const hoods = new Set(items.map(r => r.neighborhood)).size;
    const types = new Set(items.map(r => r.type)).size;
    document.getElementById('stat-count').textContent = items.length;
    document.getElementById('stat-hoods').textContent = hoods;
    document.getElementById('stat-types').textContent = types;

    const tabs = document.querySelectorAll('[data-tab="saved"]');
    tabs.forEach(tab => {
      tab.classList.toggle('has-items', items.length > 0);
      tab.setAttribute('data-count', items.length);
    });

    const hasSavedItems = saved.size > 0;
    const savedHeader = document.querySelector('#view-saved .saved-header');
    const savedSort = document.getElementById('saved-sort-section');
    if (savedHeader) savedHeader.style.display = hasSavedItems ? '' : 'none';
    if (savedSort) savedSort.style.display = hasSavedItems ? '' : 'none';

    const container = document.getElementById('cards-saved');
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = `<div class="no-results">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--pizza-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.8">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">No saved spots yet</p>
        <p style="color: var(--ink-60);">Bookmark spots from Browse to build your list!</p>
      </div>`;
    } else {
      container.innerHTML = items.map((r, index) => cardHTML(r, false, true, index, items.length)).join('');
    }
    container.classList.remove('fade-in');
    void container.offsetWidth; // trigger reflow
    container.classList.add('fade-in');

    if (hasSavedItems) {
      renderSavedFilters();
      if (activeSavedSort === 'custom') {
        setupSavedDragEvents();
      }
    }

    // Restore focus if selector matches a rendered element
    if (focusSelector) {
      const elToFocus = document.querySelector(focusSelector);
      if (elToFocus) {
        elToFocus.focus();
      }
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
      ? `<div class="no-results" style="padding:24px 0">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--pizza-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">No friends added yet.</p>
        </div>`
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
      overlapContainer.innerHTML = `<div class="no-results" style="padding:20px 0">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--pizza-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p style="font-family: var(--font-display); font-size: 18px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">No overlap yet</p>
        <p style="color: var(--ink-60);">Save more spots and add more friends!</p>
      </div>`;
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

      const isNew = item.isNew && !viewedNew.has(item.id);

      cardEl.innerHTML = `
        <div class="swipe-card-image">${imageBlock}</div>
        <div class="swipe-card-body">
          <div class="swipe-card-dish">${esc(item.dish)}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
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

    if (r.isNew && !viewedNew.has(r.id)) {
      viewedNew.add(r.id);
    }
    saveState();
    updateBrowseBadge();

    swipeIdx++;
    swipeAnimating = true;

    // Tactile spring punch before card flies off-screen
    cardEl.style.transition = 'transform 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    const punchX = dir === 'right' ? 30 : -30;
    const punchRot = dir === 'right' ? 6 : -6;
    cardEl.style.transform = `translate(${punchX}px, 6px) rotate(${punchRot}deg) scale(1.03)`;

    setTimeout(() => {
      cardEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease-out';
      const tx = dir === 'right' ? window.innerWidth : -window.innerWidth;
      const rot = dir === 'right' ? 18 : -18;
      cardEl.style.transform = `translate(${tx}px, 40px) rotate(${rot}deg) scale(0.95)`;
      cardEl.style.opacity = '0';
    }, 100);

    setTimeout(() => {
      swipeAnimating = false;
      renderSwipe();
      // Other tabs' contents reflect the updated saved set.
      renderBrowse();
      renderSaved();
      renderFriends();
    }, 450);
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

    // Update select switcher values
    document.querySelectorAll('.week-switcher-select').forEach(select => {
      select.value = week.id;
    });

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
    let filters = [...(WEEK_FILTERS[currentWeekId] || [])];
    const activeWeekRestaurants = getRestaurants();
    const hasAnyNew = activeWeekRestaurants.some(r => r.isNew);
    if (hasAnyNew) {
      filters.push({ id: 'new', label: 'New' });
    }
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

  function renderShimmer() {
    const container = document.getElementById('cards-browse');
    if (!container) return;
    container.innerHTML = `
      <div class="shimmer-card">
        <div class="shimmer-emoji"></div>
        <div class="shimmer-body">
          <div class="shimmer-line title"></div>
          <div class="shimmer-line sub"></div>
          <div class="shimmer-line desc"></div>
          <div class="shimmer-line desc2"></div>
        </div>
      </div>
      <div class="shimmer-card">
        <div class="shimmer-emoji"></div>
        <div class="shimmer-body">
          <div class="shimmer-line title"></div>
          <div class="shimmer-line sub"></div>
          <div class="shimmer-line desc"></div>
          <div class="shimmer-line desc2"></div>
        </div>
      </div>
      <div class="shimmer-card">
        <div class="shimmer-emoji"></div>
        <div class="shimmer-body">
          <div class="shimmer-line title"></div>
          <div class="shimmer-line sub"></div>
          <div class="shimmer-line desc"></div>
          <div class="shimmer-line desc2"></div>
        </div>
      </div>
    `;
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

    activeSavedFilters.clear();
    savedSearchQuery = '';
    const savedSearchInput = document.getElementById('saved-search-input');
    if (savedSearchInput) {
      savedSearchInput.value = '';
      const savedSearchClearBtn = document.getElementById('saved-search-clear-btn');
      if (savedSearchClearBtn) savedSearchClearBtn.style.display = 'none';
    }

    // Reset activeSort and sort chips active states
    activeSort = 'restaurant';
    document.querySelectorAll('#sort-row button.filter-chip, #sort-section button.filter-chip').forEach(btn => {
      if (btn.textContent.includes('Restaurant')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    activeSavedSort = 'restaurant';
    document.querySelectorAll('#saved-sort-section button.filter-chip').forEach(btn => {
      if (btn.textContent.includes('Restaurant')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    const savedZipContainer = document.getElementById('saved-zip-code-container');
    if (savedZipContainer) savedZipContainer.style.display = 'none';

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
    renderSavedFilters();

    const url = new URL(window.location);
    url.searchParams.set('week', weekId);
    url.searchParams.delete('tab');
    history.pushState({ ...history.state, week: weekId, tab: 'browse' }, '', url);
    document.body.classList.remove('is-landing');

    switchTab('browse');
    renderShimmer();
    setTimeout(() => {
      renderAll();
      updateBrowseBadge();
      showToast(`Switched to ${week.name}!`);
    }, 450);
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

  // ── Mobile Scroll-to-Hide & Filter Drawer Logic ────────────
  let lastScrollTop = 0;
  let filterDrawerOpen = false;

  function setupMobileScrollListener() {
    const viewBrowse = document.getElementById('view-browse');
    const viewSaved = document.getElementById('view-saved');
    if (!viewBrowse || !viewSaved) return;

    const onScroll = () => {
      if (window.innerWidth > 768) {
        // Reset compact header if switched to desktop/tablet
        document.getElementById('app').classList.remove('compact-header');
        const fab = document.getElementById('mobile-filter-fab');
        if (fab) fab.classList.remove('show-fab');
        return;
      }

      if (activeTab !== 'browse' && activeTab !== 'saved') return;

      const currentView = activeTab === 'browse' ? viewBrowse : viewSaved;
      const st = currentView.scrollTop || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      const appContainer = document.getElementById('app');
      const fabButton = document.getElementById('mobile-filter-fab');

      if (activeTab === 'saved' && saved.size === 0) {
        if (fabButton) fabButton.classList.remove('show-fab');
        return;
      }

      const delta = st - lastScrollTop;

      if (st <= 60) {
        // Near the top: always show full header and hide FAB
        appContainer.classList.remove('compact-header');
        if (fabButton) fabButton.classList.remove('show-fab');
      } else if (delta > 20 && st > 150) {
        // Significant scroll down: hide header and show FAB
        appContainer.classList.add('compact-header');
        if (fabButton) fabButton.classList.add('show-fab');
      } else if (delta < -30) {
        // Significant scroll up: show header
        appContainer.classList.remove('compact-header');
      }
      lastScrollTop = st <= 0 ? 0 : st;
    };

    viewBrowse.addEventListener('scroll', onScroll, { passive: true });
    viewSaved.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function openFilterDrawer() {
    if (filterDrawerOpen) return;

    const overlay = document.getElementById('filter-drawer-overlay');
    const drawerBody = document.getElementById('filter-drawer-body');
    if (!overlay || !drawerBody) return;

    if (activeTab === 'saved') {
      const searchBar = document.querySelector('#view-saved .search-bar');
      const savedFilters = document.getElementById('saved-filters');
      const sortSection = document.getElementById('saved-sort-section');
      if (searchBar && savedFilters && sortSection) {
        drawerBody.appendChild(searchBar);
        drawerBody.appendChild(savedFilters);
        drawerBody.appendChild(sortSection);

        overlay.classList.add('open');
        filterDrawerOpen = true;
        document.body.style.overflow = 'hidden'; // prevent underlying body scroll
      }
    } else {
      const searchBar = document.querySelector('#view-browse .search-bar');
      const browseFilters = document.getElementById('browse-filters');
      const sortSection = document.getElementById('sort-section');
      if (searchBar && browseFilters && sortSection) {
        drawerBody.appendChild(searchBar);
        drawerBody.appendChild(browseFilters);
        drawerBody.appendChild(sortSection);

        overlay.classList.add('open');
        filterDrawerOpen = true;
        document.body.style.overflow = 'hidden'; // prevent underlying body scroll
      }
    }
  }

  function closeFilterDrawer() {
    if (!filterDrawerOpen) return;

    const overlay = document.getElementById('filter-drawer-overlay');
    if (!overlay) return;

    if (activeTab === 'saved') {
      const searchBar = document.querySelector('#filter-drawer-body .search-bar');
      const savedFilters = document.getElementById('saved-filters');
      const sortSection = document.getElementById('saved-sort-section');
      const savedHeader = document.querySelector('#view-saved .saved-header');
      const cardsSaved = document.getElementById('cards-saved');
      if (searchBar && savedFilters && sortSection && savedHeader && cardsSaved) {
        savedHeader.appendChild(searchBar);
        savedHeader.appendChild(savedFilters);
        document.getElementById('view-saved').insertBefore(sortSection, document.querySelector('#view-saved .section-header') || cardsSaved);
      }
    } else {
      const searchBar = document.querySelector('#filter-drawer-body .search-bar');
      const browseFilters = document.getElementById('browse-filters');
      const sortSection = document.getElementById('sort-section');
      const browseHeader = document.querySelector('#view-browse .browse-header');
      const cardsBrowse = document.getElementById('cards-browse');
      if (searchBar && browseFilters && sortSection && browseHeader && cardsBrowse) {
        browseHeader.appendChild(searchBar);
        browseHeader.appendChild(browseFilters);
        document.getElementById('view-browse').insertBefore(sortSection, cardsBrowse);
      }
    }

    overlay.classList.remove('open');
    filterDrawerOpen = false;
    document.body.style.overflow = ''; // restore body scroll
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

      let tab = (e.state && e.state.tab) || new URLSearchParams(window.location.search).get('tab') || 'browse';
      if (tab === 'friends') tab = 'share';
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

    // Wire up saved search
    const savedSearchInput = document.getElementById('saved-search-input');
    const savedSearchClearBtn = document.getElementById('saved-search-clear-btn');
    if (savedSearchInput && savedSearchClearBtn) {
      savedSearchInput.addEventListener('input', e => {
        savedSearchQuery = e.target.value;
        savedSearchClearBtn.style.display = savedSearchQuery ? 'flex' : 'none';
        renderSaved();
      });
      savedSearchClearBtn.addEventListener('click', () => {
        savedSearchInput.value = '';
        savedSearchQuery = '';
        savedSearchClearBtn.style.display = 'none';
        savedSearchInput.focus();
        renderSaved();
      });
    }

    // Wire up compact app bar search and menu
    const compactSearchBtn = document.getElementById('compact-search-btn');
    const compactMenuBtn = document.getElementById('compact-menu-btn');
    const compactSearchDropdown = document.getElementById('compact-search-dropdown');
    const compactMenuDropdown = document.getElementById('compact-menu-dropdown');
    const compactSearchInput = document.getElementById('compact-search-input');
    const compactSearchClearBtn = document.getElementById('compact-search-clear-btn');

    if (compactSearchBtn) {
      compactSearchBtn.addEventListener('click', () => {
        const isHidden = compactSearchDropdown.style.display === 'none';
        compactSearchDropdown.style.display = isHidden ? 'block' : 'none';
        compactMenuDropdown.style.display = 'none';
        if (isHidden && compactSearchInput) {
          compactSearchInput.value = (activeTab === 'saved') ? savedSearchQuery : searchQuery;
          if (compactSearchClearBtn) {
            compactSearchClearBtn.style.display = compactSearchInput.value ? 'flex' : 'none';
          }
          compactSearchInput.focus();
        }
      });
    }

    if (compactMenuBtn) {
      compactMenuBtn.addEventListener('click', () => {
        const isHidden = compactMenuDropdown.style.display === 'none';
        compactMenuDropdown.style.display = isHidden ? 'block' : 'none';
        compactSearchDropdown.style.display = 'none';
      });
    }

    if (compactSearchInput && compactSearchClearBtn) {
      compactSearchInput.addEventListener('input', e => {
        const val = e.target.value;
        compactSearchClearBtn.style.display = val ? 'flex' : 'none';
        
        if (activeTab === 'browse') {
          searchQuery = val;
          const mainSearchInput = document.getElementById('search-input');
          if (mainSearchInput) mainSearchInput.value = val;
          renderBrowse();
        } else if (activeTab === 'saved') {
          savedSearchQuery = val;
          const mainSavedSearchInput = document.getElementById('saved-search-input');
          if (mainSavedSearchInput) mainSavedSearchInput.value = val;
          renderSaved();
        }
      });

      compactSearchClearBtn.addEventListener('click', () => {
        compactSearchInput.value = '';
        compactSearchClearBtn.style.display = 'none';
        if (activeTab === 'browse') {
          searchQuery = '';
          const mainSearchInput = document.getElementById('search-input');
          if (mainSearchInput) mainSearchInput.value = '';
          renderBrowse();
        } else if (activeTab === 'saved') {
          savedSearchQuery = '';
          const mainSavedSearchInput = document.getElementById('saved-search-input');
          if (mainSavedSearchInput) mainSavedSearchInput.value = '';
          renderSaved();
        }
        compactSearchInput.focus();
      });
    }

    // Hide dropdowns when clicking outside
    document.addEventListener('click', e => {
      const isCompactClick = e.target.closest('.compact-app-bar') || e.target.closest('.compact-dropdown');
      if (!isCompactClick && compactSearchDropdown && compactMenuDropdown) {
        compactSearchDropdown.style.display = 'none';
        compactMenuDropdown.style.display = 'none';
      }
    });

    // Hide dropdowns when compact header is removed (e.g. scrolling back up)
    window.addEventListener('scroll', () => {
      const appContainer = document.getElementById('app');
      if (appContainer && !appContainer.classList.contains('compact-header')) {
        if (compactSearchDropdown) compactSearchDropdown.style.display = 'none';
        if (compactMenuDropdown) compactMenuDropdown.style.display = 'none';
      }
    });

    // Attach to App globally so we can hide dropdowns in switchTab if needed
    window.App.hideCompactDropdowns = () => {
      if (compactSearchDropdown) compactSearchDropdown.style.display = 'none';
      if (compactMenuDropdown) compactMenuDropdown.style.display = 'none';
    };

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
        if (activeTab !== 'share') switchTab('share');
      }, 500);
    }

    // Wire up friend code input (Enter key)
    document.getElementById('friend-code-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addFriend();
    });

    // Wire up zip code inputs (Enter key)
    const zipCodeInput = document.getElementById('zip-code-input');
    if (zipCodeInput) {
      zipCodeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') applyZipCode();
      });
    }
    const savedZipCodeInput = document.getElementById('saved-zip-code-input');
    if (savedZipCodeInput) {
      savedZipCodeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') applySavedZipCode();
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
    let initialTab = urlParams.get('tab');
    if (initialTab === 'friends') initialTab = 'share';
    if (initialTab && ['browse', 'swipe', 'saved', 'share', 'map'].includes(initialTab)) {
      switchTab(initialTab, true);
    } else {
      switchTab('browse', true);
    }
    renderAll();
    updateBrowseBadge();

    // Deep linking: Open detail sheet if dish ID in URL
    const initialDishId = urlParams.get('dish');
    if (initialDishId) {
      setTimeout(() => openDetail(parseInt(initialDishId, 10), true), 100);
    }

    // Re-render swipe deck on window resize to ensure correct responsive fanning transforms
    window.addEventListener('resize', () => {
      if (activeTab === 'swipe') renderSwipe();
      if (window.innerWidth > 768 && filterDrawerOpen) {
        closeFilterDrawer();
      }
    });

    setupMobileScrollListener();
  }

  return { init, switchTab, toggleFilter, setSort, toggleSave, openDetail, closeDetail, addFriend, renameFriend, removeFriend, swipe, undoSwipe, resetSwipe, swipeOpenDetail, skipSwipe, switchWeek, exportSavedToClipboard, setRating, setNote, toggleDistanceSort, applyZipCode, generateShareLink, copyTextFromElement, shareNative, dismissNewBanner, openFilterDrawer, closeFilterDrawer, handleNoteInput, toggleSavedFilter, setSavedSort, toggleSavedDistanceSort, applySavedZipCode, moveSavedItem };
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
