/* ── Rendering Loops & Week Switcher UI ── */
import { State, saveState, WEEK_FILTERS } from './state.js';
import { esc } from './utils.js';
import { getRestaurants, getFiltered, getSaved } from './data.js';
import { cardHTML } from './cards.js';
import { updateMobileFabBadge, renderSavedFilters } from './filters.js';
import { renderFriends } from './friends.js';
import { renderMap } from './map.js';
import { buildSwipeQueue, renderSwipe } from './swipe.js';

export function renderBrowse() {
  const filtered = getFiltered();
  
  const hoods = new Set(filtered.map(r => r.neighborhood || r.address)).size;
  const types = new Set(filtered.map(r => r.type)).size;
  const browseCountEl = document.getElementById('browse-stat-count');
  if (browseCountEl) browseCountEl.textContent = filtered.length;
  
  const browseHoodsEl = document.getElementById('browse-stat-hoods');
  const browseTypesEl = document.getElementById('browse-stat-types');
  if (browseHoodsEl && browseTypesEl) {
    if (State.currentWeekId === 'slushie-2026') {
      browseHoodsEl.parentElement.style.display = 'none';
      browseTypesEl.parentElement.style.display = 'none';
    } else {
      browseHoodsEl.parentElement.style.display = '';
      browseTypesEl.parentElement.style.display = '';
      browseHoodsEl.textContent = hoods;
      browseTypesEl.textContent = types;
    }
  }

  const container = document.getElementById('cards-browse');
  if (!container) return;
  if (filtered.length === 0) {
    container.innerHTML = `<div class="no-results">
      <svg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 -960 960 960" width="48" fill="#e3e3e3" style="margin-bottom: 16px; opacity: 0.8;"><path d="M280-80v-366q-51-14-85.5-56T160-596v-284h80v280h40v-280h80v280h40v-280h80v284q0 52-34.5 94T360-446v366h-80Zm400 0v-320H560v-480q66 0 113 47t47 113v640h-40Z"/></svg>
      <p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">Nothing on the menu</p>
      <p style="color: var(--ink-60);">Try a different filter!</p>
    </div>`;
  } else {
    container.innerHTML = filtered.map(r => cardHTML(r)).join('');
  }
  container.classList.remove('fade-in');
  void container.offsetWidth;
  container.classList.add('fade-in');
}

export function renderSaved() {
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
  const hoods = new Set(items.map(r => r.neighborhood || r.address)).size;
  const types = new Set(items.map(r => r.type)).size;
  const statCountEl = document.getElementById('stat-count');
  if (statCountEl) statCountEl.textContent = items.length;
  
  const hoodsBox = document.getElementById('stat-hoods')?.parentElement;
  const typesBox = document.getElementById('stat-types')?.parentElement;
  if (hoodsBox && typesBox) {
    if (State.currentWeekId === 'slushie-2026') {
      hoodsBox.style.display = 'none';
      typesBox.style.display = 'none';
    } else {
      hoodsBox.style.display = '';
      typesBox.style.display = '';
      const sh = document.getElementById('stat-hoods');
      const st = document.getElementById('stat-types');
      if (sh) sh.textContent = hoods;
      if (st) st.textContent = types;
    }
  }

  if (State.activeTab === 'saved') {
    const h = document.getElementById('saved-header-title');
    const eBtn = document.getElementById('saved-exit-friend-btn');
    const cBtn = document.getElementById('saved-copy-btn');
    const mBtn = document.getElementById('saved-merge-friend-btn');
    
    if (State.viewingFriendIndex !== null && State.friends[State.viewingFriendIndex]) {
      const fn = State.friends[State.viewingFriendIndex].name || 'Friend';
      if (h) h.textContent = `${fn}'s List`;
      if (eBtn) eBtn.style.display = 'inline-block';
      if (mBtn) mBtn.style.display = 'inline-block';
      if (cBtn) cBtn.style.display = 'none';
    } else {
      if (h) h.textContent = 'Your Saved Spots';
      if (eBtn) eBtn.style.display = 'none';
      if (mBtn) mBtn.style.display = 'none';
      if (cBtn) cBtn.style.display = 'inline-block';
    }
  }

  const targetSet = State.viewingFriendIndex !== null && State.friends[State.viewingFriendIndex] 
    ? new Set(State.friends[State.viewingFriendIndex].ids) 
    : State.saved;
  const totalSavedForWeek = getRestaurants().filter(r => targetSet.has(r.id)).length;
  
  const tabs = document.querySelectorAll('[data-tab="saved"]');
  tabs.forEach(tab => {
    if (State.viewingFriendIndex === null) {
      tab.classList.toggle('has-items', totalSavedForWeek > 0);
      tab.setAttribute('data-count', totalSavedForWeek);
    }
  });

  const hasSavedItems = totalSavedForWeek > 0;
  const savedHeader = document.querySelector('#view-saved .saved-header');
  const savedSort = document.getElementById('saved-sort-section');
  if (savedHeader) savedHeader.style.display = hasSavedItems ? '' : 'none';
  if (savedSort) savedSort.style.display = hasSavedItems ? '' : 'none';

  const container = document.getElementById('cards-saved');
  if (!container) return;
  const headerTitle = document.getElementById('saved-header-title');
  const copyBtn = document.getElementById('saved-copy-btn');
  const exitBtn = document.getElementById('saved-exit-friend-btn');
  const mergeBtn = document.getElementById('saved-merge-friend-btn');
  
  if (State.viewingFriendIndex !== null && State.friends[State.viewingFriendIndex]) {
    if (headerTitle) headerTitle.textContent = `${esc(State.friends[State.viewingFriendIndex].name)}'s Spots`;
    if (copyBtn) copyBtn.style.display = 'none';
    if (exitBtn) exitBtn.style.display = 'inline-block';
    if (mergeBtn) mergeBtn.style.display = 'inline-block';
  } else {
    if (headerTitle) headerTitle.textContent = 'Your Saved Spots';
    if (copyBtn) copyBtn.style.display = 'inline-block';
    if (exitBtn) exitBtn.style.display = 'none';
    if (mergeBtn) mergeBtn.style.display = 'none';
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="no-results" style="text-align: center; margin-top: 40px; grid-column: 1 / -1;">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--pizza-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.8; margin-left: auto; margin-right: auto;">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">${State.viewingFriendIndex !== null ? "Friend hasn't saved spots yet" : "No saved spots yet"}</p>
      <p style="color: var(--ink-60);">${State.viewingFriendIndex !== null ? "Check back later!" : "Save spots from Browse to build your list!"}</p>
    </div>`;
  } else {
    container.innerHTML = items.map((r, index) => cardHTML(r, false, true, index, items.length)).join('');
  }
  container.classList.remove('fade-in');
  void container.offsetWidth;
  container.classList.add('fade-in');

  if (hasSavedItems) {
    renderSavedFilters();
    if (State.activeSavedSort === 'custom' && window.App && window.App.setupSavedDragEvents) {
      window.App.setupSavedDragEvents();
    }
  }

  if (focusSelector) {
    const elToFocus = document.querySelector(focusSelector);
    if (elToFocus) {
      elToFocus.focus();
    }
  }

  if (State.activeTab === 'saved') {
    const fabButton = document.getElementById('mobile-filter-fab');
    if (fabButton) {
      if (hasSavedItems) fabButton.classList.add('show-fab');
      else fabButton.classList.remove('show-fab');
    }
  }
}

export function renderFilters() {
  let filters = [...(WEEK_FILTERS[State.currentWeekId] || [])];
  const activeWeekRestaurants = getRestaurants();
  const hasUnviewedNew = activeWeekRestaurants.some(r => r.isNew && !State.viewedNew.has(r.id));
  if (hasUnviewedNew || State.activeFilters.has('new')) {
    filters.push({ id: 'new', label: 'Recently Added' });
  }
  const container = document.getElementById('browse-filters');
  if (!container) return;

  if (filters.length === 0) {
    container.innerHTML = '';
    return;
  }

  const currentSet = State.filterDrawerOpen ? State.draftFilters : State.activeFilters;
  const labelHTML = `<span class="filter-label">Filter:</span>`;
  const clearHTML = (currentSet.size > 0 || State.searchQuery !== '' || State.activeSort === 'distance') ? `<button class="filter-chip clear-filters" style="background:var(--pizza-light); color:var(--pizza-dark); font-weight:bold; border: 1px solid var(--pizza-dark);" onclick="App.clearAllFilters()">✕ Clear</button>` : '';
  const chipsHTML = `<div class="filter-chips-wrapper">` + clearHTML + filters.map(f => {
    const activeCls = currentSet.has(f.id) ? 'active' : '';
    return `<button class="filter-chip ${activeCls}" onclick="App.toggleFilter('${f.id}')">${esc(f.label)}</button>`;
  }).join('') + `</div>`;

  container.innerHTML = labelHTML + chipsHTML;
  updateMobileFabBadge();
}

export function renderHeader() {
  const week = (window.FOOD_WEEKS || []).find(w => w.id === State.currentWeekId);
  if (!week) return;

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

  const titleEl = document.getElementById('header-title');
  if (titleEl) {
    if (State.currentWeekId === 'slushie-2026') {
      titleEl.innerHTML = `Summer of <em>Slushies</em> 2026`;
    } else {
      const parts = week.name.split(' ');
      if (parts.length > 0) {
        const first = parts[0];
        const rest = parts.slice(1).join(' ');
        titleEl.innerHTML = `<em>${esc(first)}</em> ${esc(rest)}`;
      } else {
        titleEl.textContent = week.name;
      }
    }
  }

  const metaEl = document.getElementById('header-meta');
  if (metaEl) {
    const dates = `<span>${esc(week.dates)}</span>`;
    const pills = (week.pricePills || []).map(p => `<span class="pill">${esc(p)}</span>`).join('');
    const locations = `<span>${week.totalLocations || getRestaurants().length} locations</span>`;
    metaEl.innerHTML = dates + pills + locations;
  }

  document.title = `PDX ${week.name}`;

  const mapCanvas = document.getElementById('map-canvas');
  if (mapCanvas) {
    mapCanvas.setAttribute('aria-label', `Map of Portland ${week.name} locations`);
  }
}

export function applyWeekTheme(week) {
  const root = document.documentElement;
  if (!week) {
    root.style.setProperty('--pizza', '#E85B38');
    root.style.setProperty('--pizza-dark', '#B5472E');
    root.style.setProperty('--pizza-light', '#F5E6DF');
    root.style.setProperty('--pizza-pale', '#FDF7F4');
    return;
  }
  const themeColor = week.color || '#E85B38';
  let dark = week.colorDark || '#B5472E';
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

export function renderAll() {
  renderBrowse();
  renderSaved();
  renderFriends();
  if (State.activeTab === 'map') renderMap();
  if (State.activeTab === 'swipe') {
    if (!State.swipeQueue) buildSwipeQueue();
    renderSwipe();
  }
}
