/* ── PDX Food Week App ── */
'use strict';

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
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...saved]));
      localStorage.setItem(STORAGE_KEY_PASSED, JSON.stringify([...passed]));
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
      localStorage.setItem(STORAGE_KEY_WEEK, currentWeekId);
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch (e) {}
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
      if (activeFilters.has('meat')       && r.type !== 'meat')       return false;
      if (activeFilters.has('vegetarian') && !isVegetarianFriendly(r)) return false;
      if (activeFilters.has('vegan')      && !isVeganFriendly(r))      return false;
      if (activeFilters.has('gf')         && !r.glutenFree)            return false;
      if (activeFilters.has('pie')        && !r.wholePie)              return false;
      if (activeFilters.has('minors')     && !r.minors)                return false;
      if (activeFilters.has('21plus')     && r.minors)                 return false;
      if (activeFilters.has('takeout')    && !r.takeout)               return false;
      if (activeFilters.has('spicy')      && !r.spicy)                 return false;
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
      if (r.glutenFree)            t.push('<span class="tag tag-gf">GF available</span>');
      if (r.wholePie)              t.push('<span class="tag tag-pie">Whole pie $25</span>');
      else                         t.push('<span class="tag tag-slice">By the slice</span>');
    } else if (currentWeekId === 'highball-2026') {
      if (r.minors)                t.push('<span class="tag tag-minors" style="background:#E3EFDB;color:#2F6316;">Minors OK</span>');
      else                         t.push('<span class="tag tag-21plus" style="background:#FAE8E0;color:#8B3015;">21+ Only</span>');
      if (r.takeout)               t.push('<span class="tag tag-takeout" style="background:#E3EEF8;color:#185FA5;">Takeout OK</span>');
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
      if (r.glutenFree)            t.push('<span class="tag tag-gf">GF available</span>');
      if (r.spicy)                 t.push('<span class="tag tag-spicy" style="background:#FAE8E0;color:#8B3015;">🌶️ Spicy</span>');
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
      if (r.glutenFree)            t.push('<span class="tag tag-gf">GF available</span>');
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
    return `
      <div class="${cls}" data-id="${r.id}" onclick="App.openDetail(${r.id})">
        ${thumb}
        <div class="card-body">
          <div class="card-dish">${esc(r.dish)}</div>
          <div class="card-restaurant">${esc(r.restaurant)}</div>
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

  // ── Notes & Ratings ─────────────────────────────────────────
  function setRating(id, rating) {
    if (!notes[id]) notes[id] = { rating: 0, note: '' };
    notes[id].rating = rating;
    saveState();
    if (selectedDish && selectedDish.id === id) {
      openDetail(id, true); // re-render to show stars
    }
  }

  function setNote(id, note) {
    if (!notes[id]) notes[id] = { rating: 0, note: '' };
    notes[id].note = note;
    saveState();
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
      <div class="sheet-handle"></div>
      ${hero}
      <div class="sheet-dish">${esc(r.dish)}</div>
      <div class="sheet-restaurant">${esc(r.restaurant)}</div>
      <div class="sheet-address">
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.restaurant + ' ' + r.address)}" target="_blank" rel="noopener" title="Open in Google Maps">
          📍 ${esc(r.address)} ↗
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
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Your Notes</div>
        <div class="rating-stars" style="font-size: 24px; color: var(--ink-30); cursor: pointer; margin-bottom: 8px;">
          ${[1, 2, 3, 4, 5].map(star => `<span style="${notes[r.id] && notes[r.id].rating >= star ? 'color: #FFB800;' : ''}" onclick="App.setRating(${r.id}, ${star})">★</span>`).join('')}
        </div>
        <textarea class="note-input" placeholder="Add your personal notes..." onchange="App.setNote(${r.id}, this.value)" style="width: 100%; border: 1px solid var(--ink-20); border-radius: 8px; padding: 12px; font-family: inherit; font-size: 14px; resize: vertical; min-height: 80px;">${notes[r.id] && notes[r.id].note ? esc(notes[r.id].note) : ''}</textarea>
      </div>` : ''}
    `;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

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
      el.classList.toggle('active', el.dataset.tab === name);
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
    el.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderBrowse();
    renderSaved(); // sorting also applies to your saved list
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
    const code = encodeShareCode();
    const codeBox = document.getElementById('share-code-box');
    const copyBtn = document.getElementById('copy-btn');

    if (code) {
      codeBox.innerHTML = `<code>${code}</code>`;
      copyBtn.disabled = false;
      copyBtn.textContent = 'Copy my code';
    } else {
      codeBox.innerHTML = `<span class="code-placeholder">Save some spots first…</span>`;
      copyBtn.disabled = true;
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

  // ── Friends: Copy code ─────────────────────────────────────
  function copyCode() {
    const code = encodeShareCode();
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy my code';
      btn.classList.remove('copied');
    }, 2000);
  }

  // ── Friends: Add friend ────────────────────────────────────
  function addFriend() {
    const input = document.getElementById('friend-code-input');
    const code = input.value.trim();
    if (!code) return;
    const ids = decodeShareCode(code);
    if (!ids) {
      showToast('⚠️ Invalid code — check with your friend');
      return;
    }
    const name = `Friend ${friends.length + 1}`;
    friends.push({ name, ids, code });
    saveState();
    input.value = '';
    renderFriends();
    showToast(`Added ${name}!`);
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
    const cardEl = document.getElementById('swipe-card');
    const emptyEl = document.getElementById('swipe-empty');
    const ctrlsEl = document.getElementById('swipe-controls');
    const counterEl = document.getElementById('swipe-counter');
    const r = currentSwipeCard();

    // Update button states
    const undoBtn = document.getElementById('swipe-btn-undo');
    const passBtn = ctrlsEl.querySelector('.swipe-pass');
    const infoBtn = ctrlsEl.querySelector('.swipe-info');
    const likeBtn = ctrlsEl.querySelector('.swipe-like');

    if (undoBtn) undoBtn.disabled = (swipeIdx <= 0);

    if (!r) {
      cardEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      if (passBtn) passBtn.disabled = true;
      if (infoBtn) infoBtn.disabled = true;
      if (likeBtn) likeBtn.disabled = true;
      counterEl.textContent = 'Nothing left';
      return;
    }

    cardEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    cardEl.style.transform = '';
    cardEl.style.opacity = '';
    cardEl.style.transition = '';
    cardEl.dataset.id = r.id;

    if (passBtn) passBtn.disabled = false;
    if (infoBtn) infoBtn.disabled = false;
    if (likeBtn) likeBtn.disabled = false;

    const imageBlock = r.image
      ? `<img src="${esc(r.image)}" alt="" loading="eager">`
      : `<div class="swipe-card-emoji">${esc(r.emoji)}</div>`;

    cardEl.innerHTML = `
      <div class="swipe-card-image">${imageBlock}</div>
      <div class="swipe-card-body">
        <div class="swipe-card-dish">${esc(r.dish)}</div>
        <div class="swipe-card-restaurant">${esc(r.restaurant)}</div>
        <div class="swipe-card-neighborhood">📍 ${esc(r.neighborhood)}</div>
        <div class="swipe-card-desc">${esc(r.desc)}</div>
        <div class="swipe-card-tags">${buildTags(r)}</div>
      </div>
      <div class="swipe-stamp swipe-stamp-like">Like</div>
      <div class="swipe-stamp swipe-stamp-pass">Dislike</div>
    `;

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
      try { cardEl.setPointerCapture(e.pointerId); } catch (err) {}
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
      el.innerHTML = `PDX Food Week<br>Data from ${dataSrcHtml}.<br>Not affiliated with either.<br>Created by <a href="https://github.com/oberonix" target="_blank" rel="noopener">@oberonix</a> &amp; <a href="https://github.com/verdantly" target="_blank" rel="noopener">@verdantly</a>`;
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

    // Dynamic browser tab title & favicon updates
    document.title = `PDX ${week.name}`;
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon && week.emoji) {
      favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${week.emoji}</text></svg>`;
    }

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
    
    container.innerHTML = filters.map(f => {
      const activeCls = activeFilters.has(f.id) ? 'active' : '';
      return `<button class="filter-chip ${activeCls}" onclick="App.toggleFilter('${f.id}')">${esc(f.label)}</button>`;
    }).join('');
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
    
    // Full re-render
    renderAll();
    
    showToast(`Switched to ${week.name}!`);
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    loadState();

    // Wire up popstate to handle browser back button closing detail sheet and tab navigation
    window.addEventListener('popstate', e => {
      if (e.state && e.state.detailDishId !== undefined) {
        openDetail(e.state.detailDishId, true);
      } else if (selectedDish) {
        closeDetail(true);
      }
      
      const tab = (e.state && e.state.tab) || new URLSearchParams(window.location.search).get('tab') || 'browse';
      if (activeTab !== tab) {
        switchTab(tab, true);
      }
    });

    // Wire up detail overlay close
    document.getElementById('detail-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeDetail();
    });

    // Wire up search
    document.getElementById('search-input').addEventListener('input', e => {
      searchQuery = e.target.value;
      renderBrowse();
    });

    // Wire up friend code input (Enter key)
    document.getElementById('friend-code-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addFriend();
    });

    // Swipe gestures + keyboard shortcuts
    attachSwipeGestures();
    document.addEventListener('keydown', e => {
      if (activeTab !== 'swipe') return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      // Don't steer the underlying deck while the detail sheet is open.
      if (document.getElementById('detail-overlay').classList.contains('open')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); swipe('right'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); swipe('left'); }
    });

    // Apply active week's initial theme, header metadata, and dynamic filters
    const week = window.FOOD_WEEKS.find(w => w.id === currentWeekId);
    applyWeekTheme(week);
    renderHeader();
    updateFilterDisplay();

    // Set initial tab from URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab');
    if (initialTab && ['browse', 'swipe', 'saved', 'friends', 'map'].includes(initialTab)) {
      switchTab(initialTab, true);
    } else {
      renderAll();
    }

    // Deep linking: Open detail sheet if dish ID in URL
    const initialDishId = urlParams.get('dish');
    if (initialDishId) {
      setTimeout(() => openDetail(parseInt(initialDishId, 10), true), 100);
    }
  }

  // Public API
  return { init, switchTab, toggleFilter, setSort, toggleSave, openDetail, closeDetail, copyCode, addFriend, removeFriend, swipe, undoSwipe, resetSwipe, swipeOpenDetail, skipSwipe, switchWeek, exportSavedToClipboard, setRating, setNote };
})();

document.addEventListener('DOMContentLoaded', App.init);
