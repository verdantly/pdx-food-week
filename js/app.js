/* ── PDX Food Week App ── */
'use strict';

const App = (() => {
  // ── State ──────────────────────────────────────────────────
  let activeTab = 'browse';
  let activeFilter = 'all';
  let activeSort = 'default';
  let searchQuery = '';
  let saved = new Set();
  let friends = [];
  let selectedDish = null;
  let currentWeekId = 'pizza-2026';

  const STORAGE_KEY_SAVED = 'pdxfw_saved_v1';
  const STORAGE_KEY_FRIENDS = 'pdxfw_friends_v1';

  // ── Persistence ────────────────────────────────────────────
  function loadState() {
    try {
      const s = localStorage.getItem(STORAGE_KEY_SAVED);
      if (s) saved = new Set(JSON.parse(s));
      const f = localStorage.getItem(STORAGE_KEY_FRIENDS);
      if (f) friends = JSON.parse(f);
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...saved]));
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
    } catch (e) {}
  }

  // ── Data helpers ───────────────────────────────────────────
  function getRestaurants() {
    return window.RESTAURANTS.filter(r => r.weekId === currentWeekId);
  }

  function getFiltered() {
    let filtered = getRestaurants().filter(r => {
      if (activeFilter === 'meat'       && r.type !== 'meat')       return false;
      if (activeFilter === 'vegetarian' && r.type !== 'vegetarian') return false;
      if (activeFilter === 'vegan'      && r.type !== 'vegan')      return false;
      if (activeFilter === 'gf'         && !r.glutenFree)            return false;
      if (activeFilter === 'pie'        && !r.wholePie)              return false;
      if (activeFilter === 'minors'     && !r.minors)                return false;
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
    if (r.type === 'meat')       t.push('<span class="tag tag-meat">Meat</span>');
    if (r.type === 'vegetarian') t.push('<span class="tag tag-veg">Vegetarian</span>');
    if (r.type === 'vegan')      t.push('<span class="tag tag-vegan">Vegan</span>');
    if (r.glutenFree)            t.push('<span class="tag tag-gf">GF available</span>');
    if (r.wholePie)              t.push('<span class="tag tag-pie">Whole pie $25</span>');
    else                         t.push('<span class="tag tag-slice">By the slice</span>');
    return t.join('');
  }

  // ── Card HTML ──────────────────────────────────────────────
  function cardHTML(r, overlap) {
    const isSaved = saved.has(r.id);
    const cls = ['dish-card', isSaved ? 'bookmarked' : '', overlap ? 'overlap-card' : ''].filter(Boolean).join(' ');
    return `
      <div class="${cls}" data-id="${r.id}" onclick="App.openDetail(${r.id})">
        <div class="card-emoji">${r.emoji}</div>
        <div class="card-body">
          <div class="card-dish">${r.dish}</div>
          <div class="card-restaurant">${r.restaurant}</div>
          <div class="card-neighborhood">📍 ${r.neighborhood}</div>
          <div class="card-desc">${r.desc}</div>
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
      showToast('🍕 Saved!');
    }
    saveState();
    renderAll();
    // If detail sheet open, update its button
    if (selectedDish && selectedDish.id === id) {
      const btn = document.getElementById('sheet-save-btn');
      if (btn) {
        btn.textContent = saved.has(id) ? '★ Saved' : '☆ Save';
        btn.className = 'btn btn-save' + (saved.has(id) ? ' saved' : '');
      }
    }
  }

  // ── Detail sheet ───────────────────────────────────────────
  function openDetail(id) {
    const r = getRestaurants().find(x => x.id === id);
    if (!r) return;
    selectedDish = r;
    const isSaved = saved.has(r.id);
    const overlay = document.getElementById('detail-overlay');
    document.getElementById('detail-sheet-content').innerHTML = `
      <div class="sheet-handle"></div>
      <span class="sheet-emoji-hero">${r.emoji}</span>
      <div class="sheet-dish">${r.dish}</div>
      <div class="sheet-restaurant">${r.restaurant}</div>
      <div class="sheet-address">📍 ${r.address}</div>
      <div class="sheet-desc">${r.desc}</div>
      <div class="sheet-tags">${buildTags(r)}</div>
      <div class="sheet-actions">
        <button class="btn btn-save ${isSaved ? 'saved' : ''}" id="sheet-save-btn"
          onclick="App.toggleSave(${r.id})">
          ${isSaved ? '★ Saved' : '☆ Save'}
        </button>
        <a class="btn btn-link" href="${r.url}" target="_blank" rel="noopener">
          EverOut ↗
        </a>
      </div>
    `;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    document.getElementById('detail-overlay').classList.remove('open');
    document.body.style.overflow = '';
    selectedDish = null;
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
  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.nav-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === name);
    });
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === `view-${name}`);
    });
  }

  // ── Filter ────────────────────────────────────────────────
  function setFilter(f, el) {
    activeFilter = f;
    el.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
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

  // ── Render All ─────────────────────────────────────────────
  function renderAll() {
    renderBrowse();
    renderSaved();
    renderFriends();
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    loadState();

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

    renderAll();
  }

  // Public API
  return { init, switchTab, setFilter, setSort, toggleSave, openDetail, closeDetail, copyCode, addFriend, removeFriend };
})();

document.addEventListener('DOMContentLoaded', App.init);
