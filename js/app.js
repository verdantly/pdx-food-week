/* ── PDX Food Week App ── */
'use strict';

const App = (() => {
  // ── State ──────────────────────────────────────────────────
  let activeTab = 'browse';
  let activeFilter = 'all';
  let searchQuery = '';
  let saved = new Set();
  let passed = new Set();
  let friends = [];
  let selectedDish = null;
  let currentWeekId = 'pizza-2026';
  let swipeQueue = null;
  let swipeIdx = 0;
  let swipeAnimating = false;

  const STORAGE_KEY_SAVED = 'pdxfw_saved_v1';
  const STORAGE_KEY_PASSED = 'pdxfw_passed_v1';
  const STORAGE_KEY_FRIENDS = 'pdxfw_friends_v1';

  // ── Persistence ────────────────────────────────────────────
  function loadState() {
    try {
      const s = localStorage.getItem(STORAGE_KEY_SAVED);
      if (s) saved = new Set(JSON.parse(s));
      const p = localStorage.getItem(STORAGE_KEY_PASSED);
      if (p) passed = new Set(JSON.parse(p));
      const f = localStorage.getItem(STORAGE_KEY_FRIENDS);
      if (f) friends = JSON.parse(f);
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...saved]));
      localStorage.setItem(STORAGE_KEY_PASSED, JSON.stringify([...passed]));
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
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

  function getFiltered() {
    return getRestaurants().filter(r => {
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
  }

  function getSaved() {
    return getRestaurants().filter(r => saved.has(r.id));
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
    const hero = r.image
      ? `<div class="sheet-hero-image"><img src="${esc(r.image)}" alt=""></div>`
      : `<span class="sheet-emoji-hero">${esc(r.emoji)}</span>`;
    document.getElementById('detail-sheet-content').innerHTML = `
      <div class="sheet-handle"></div>
      ${hero}
      <div class="sheet-dish">${esc(r.dish)}</div>
      <div class="sheet-restaurant">${esc(r.restaurant)}</div>
      <div class="sheet-address">📍 ${esc(r.address)}</div>
      <div class="sheet-desc">${esc(r.desc)}</div>
      <div class="sheet-tags">${buildTags(r)}</div>
      <div class="sheet-actions">
        <button class="btn btn-save ${isSaved ? 'saved' : ''}" id="sheet-save-btn"
          onclick="App.toggleSave(${r.id})">
          ${isSaved ? '★ Saved' : '☆ Save'}
        </button>
        <a class="btn btn-link" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">
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
    if (name === 'map') renderMap();
    if (name === 'swipe') {
      if (!swipeQueue) buildSwipeQueue();
      renderSwipe();
    }
  }

  // ── Filter ────────────────────────────────────────────────
  function setFilter(f, el) {
    activeFilter = f;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderBrowse();
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

  // ── Map ────────────────────────────────────────────────────
  function renderMap() {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 300;

    const restaurants = getRestaurants();
    const lats = restaurants.map(r => r.lat);
    const lngs = restaurants.map(r => r.lng);
    const minLat = Math.min(...lats) - 0.008;
    const maxLat = Math.max(...lats) + 0.008;
    const minLng = Math.min(...lngs) - 0.012;
    const maxLng = Math.max(...lngs) + 0.012;

    const toX = lng => ((lng - minLng) / (maxLng - minLng)) * (W - 40) + 20;
    const toY = lat => ((maxLat - lat) / (maxLat - minLat)) * (H - 40) + 20;

    // Background
    ctx.fillStyle = '#F0EBE1';
    ctx.fillRect(0, 0, W, H);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(26,18,8,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * W / 8, 0); ctx.lineTo(i * W / 8, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * H / 8); ctx.lineTo(W, i * H / 8); ctx.stroke();
    }

    // Willamette River (approximate)
    ctx.strokeStyle = 'rgba(100,160,200,0.5)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const riverX = toX(-122.6745);
    ctx.moveTo(riverX - 10, 0);
    ctx.bezierCurveTo(riverX, H * 0.3, riverX - 15, H * 0.6, riverX - 5, H);
    ctx.stroke();

    // River label
    ctx.fillStyle = 'rgba(100,160,200,0.7)';
    ctx.font = '10px DM Sans, sans-serif';
    ctx.fillText('Willamette', riverX - 40, H * 0.45);

    // Draw pins
    restaurants.forEach(r => {
      const x = toX(r.lng);
      const y = toY(r.lat);
      const isSaved = saved.has(r.id);

      // Pulse ring for saved
      if (isSaved) {
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(201,75,44,0.15)';
        ctx.fill();
      }

      // Pin body
      ctx.beginPath();
      ctx.arc(x, y, isSaved ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isSaved ? '#C94B2C' : '#888';
      ctx.fill();

      // Pin inner dot
      ctx.beginPath();
      ctx.arc(x, y, isSaved ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Store position for click handling
      r._mapX = x; r._mapY = y;
    });

    // Set up click handler
    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      let hit = null;
      let minDist = Infinity;
      restaurants.forEach(r => {
        const dx = r._mapX - mx;
        const dy = r._mapY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20 && dist < minDist) { minDist = dist; hit = r; }
      });
      if (hit) {
        showMapSelected(hit);
        // Redraw with highlight
        renderMapHighlight(hit, restaurants, toX, toY, ctx, W, H, canvas);
      }
    };
  }

  function renderMapHighlight(selected, restaurants, toX, toY, ctx, W, H, canvas) {
    renderMap(); // re-render base
    const ctx2 = canvas.getContext('2d');
    const x = toX(selected.lng);
    const y = toY(selected.lat);
    // Draw large highlight ring
    ctx2.beginPath();
    ctx2.arc(x, y, 16, 0, Math.PI * 2);
    ctx2.strokeStyle = '#C94B2C';
    ctx2.lineWidth = 2;
    ctx2.stroke();
  }

  function showMapSelected(r) {
    const el = document.getElementById('map-selected-card');
    el.innerHTML = `
      <div class="section-header">Selected location</div>
      <div class="cards-list" style="padding:0 0 8px">
        ${cardHTML(r)}
      </div>`;
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

    if (!r) {
      cardEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      ctrlsEl.style.display = 'none';
      counterEl.textContent = 'Nothing left';
      return;
    }

    cardEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    ctrlsEl.style.display = 'flex';
    cardEl.style.transform = '';
    cardEl.style.opacity = '';
    cardEl.style.transition = '';
    cardEl.dataset.id = r.id;

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
      <div class="swipe-stamp swipe-stamp-like">Save</div>
      <div class="swipe-stamp swipe-stamp-pass">Pass</div>
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

    renderAll();
  }

  // Public API
  return { init, switchTab, setFilter, toggleSave, openDetail, closeDetail, copyCode, addFriend, removeFriend, swipe, resetSwipe, swipeOpenDetail };
})();

document.addEventListener('DOMContentLoaded', App.init);
