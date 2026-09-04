/* ── Filters & Search & Sort Logic ── */
import { State, saveState, WEEK_FILTERS } from './state.js';
import { esc, showToast } from './utils.js';
import { getRestaurants, getSaved } from './data.js';

export const PORTLAND_ZIP_CACHE = {
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

export function updateMobileFabBadge() {
  const badge = document.getElementById('mobile-fab-badge');
  if (!badge) return;
  
  let count = 0;
  if (State.activeTab === 'browse') {
    count = State.activeFilters.size + (State.searchQuery !== '' ? 1 : 0) + (State.activeSort === 'distance' ? 1 : 0);
  } else if (State.activeTab === 'saved') {
    count = State.activeSavedFilters.size + (State.savedSearchQuery !== '' ? 1 : 0) + (State.activeSavedSort === 'distance' ? 1 : 0);
  }
  
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

export function toggleFilter(f) {
  const targetSet = State.filterDrawerOpen ? State.draftFilters : State.activeFilters;
  if (targetSet.has(f)) {
    targetSet.delete(f);
  } else {
    targetSet.add(f);
  }
  if (window.App && window.App.renderFilters) window.App.renderFilters();
  if (!State.filterDrawerOpen && window.App && window.App.renderBrowse) {
    window.App.renderBrowse();
  }
}

export function setSort(s, el) {
  State.activeSort = s;
  const sortSection = document.getElementById('sort-section');
  if (sortSection) {
    sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  }
  if (el) el.classList.add('active');
  const zipContainer = document.getElementById('zip-code-container');
  if (zipContainer) zipContainer.style.display = 'none';
  if (window.App && window.App.renderBrowse) window.App.renderBrowse();
}

export function toggleDistanceSort(el) {
  const zipContainer = document.getElementById('zip-code-container');
  const sortSection = document.getElementById('sort-section');
  if (State.activeSort === 'distance') {
    setSort('restaurant', sortSection ? sortSection.querySelector('button.filter-chip') : null);
  } else {
    State.activeSort = 'distance';
    if (sortSection) {
      sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    }
    if (el) el.classList.add('active');

    if (zipContainer) zipContainer.style.display = 'flex';
    if (State.userLat !== null && State.userLng !== null && window.App && window.App.renderBrowse) {
      window.App.renderBrowse();
    }
  }
}

export function useMyLocation(isSavedTab) {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser. Please enter a zip code manually.");
    return;
  }
  
  const inputId = isSavedTab ? 'saved-zip-code-input' : 'zip-code-input';
  const inputEl = document.getElementById(inputId);
  if (inputEl) inputEl.value = 'Locating...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      State.userLat = position.coords.latitude;
      State.userLng = position.coords.longitude;
      if (inputEl) inputEl.value = 'Location Set';
      
      const otherInputId = isSavedTab ? 'zip-code-input' : 'saved-zip-code-input';
      const otherInputEl = document.getElementById(otherInputId);
      if (otherInputEl) otherInputEl.value = 'Location Set';

      if (isSavedTab) {
        saveState();
        if (window.App && window.App.renderSaved) window.App.renderSaved();
      } else {
        if (window.App && window.App.renderBrowse) window.App.renderBrowse();
      }
    },
    (error) => {
      console.error("Geolocation error:", error);
      alert("Unable to retrieve your location. Please enter a zip code manually.");
      if (inputEl) inputEl.value = '';
    },
    { timeout: 10000 }
  );
}

export async function applyZipCode() {
  const zipInput = document.getElementById('zip-code-input');
  const zip = zipInput.value.trim();
  if (!zip || zip.length !== 5) {
    showToast('⚠️ Please enter a valid 5-digit zip code');
    return;
  }

  if (PORTLAND_ZIP_CACHE[zip]) {
    State.userLat = PORTLAND_ZIP_CACHE[zip].lat;
    State.userLng = PORTLAND_ZIP_CACHE[zip].lng;
    
    const savedZipInput = document.getElementById('saved-zip-code-input');
    if (savedZipInput) savedZipInput.value = zip;
    
    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    const savedZipContainer = document.getElementById('saved-zip-code-container');
    if (savedZipContainer) savedZipContainer.style.display = 'none';

    if (window.App && window.App.renderBrowse) window.App.renderBrowse();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
    return;
  }

  try {
    const btn = zipInput.nextElementSibling;
    btn.textContent = '...';
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    State.userLat = parseFloat(data.places[0].latitude);
    State.userLng = parseFloat(data.places[0].longitude);

    const savedZipInput = document.getElementById('saved-zip-code-input');
    if (savedZipInput) savedZipInput.value = zip;

    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    const savedZipContainer = document.getElementById('saved-zip-code-container');
    if (savedZipContainer) savedZipContainer.style.display = 'none';

    if (window.App && window.App.renderBrowse) window.App.renderBrowse();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
  } catch (e) {
    showToast('⚠️ Could not find that zip code');
  } finally {
    zipInput.nextElementSibling.textContent = 'Go';
  }
}

export function toggleSavedFilter(f) {
  const targetSet = State.filterDrawerOpen ? State.draftSavedFilters : State.activeSavedFilters;
  if (targetSet.has(f)) {
    targetSet.delete(f);
  } else {
    targetSet.add(f);
  }
  renderSavedFilters();
  if (!State.filterDrawerOpen && window.App && window.App.renderSaved) {
    window.App.renderSaved();
  }
}

export function renderSavedFilters() {
  let filters = [...(WEEK_FILTERS[State.currentWeekId] || [])];
  const activeWeekRestaurants = getRestaurants();
  const hasUnviewedNew = activeWeekRestaurants.some(r => r.isNew && !State.viewedNew.has(r.id));
  if (hasUnviewedNew || State.activeSavedFilters.has('new')) {
    filters.push({ id: 'new', label: 'Recently Added' });
  }
  const container = document.getElementById('saved-filters');
  if (!container) return;

  if (filters.length === 0) {
    container.innerHTML = '';
    return;
  }

  const currentSet = State.filterDrawerOpen ? State.draftSavedFilters : State.activeSavedFilters;
  const labelHTML = `<span class="filter-label">Filter:</span>`;
  const clearHTML = (currentSet.size > 0 || State.savedSearchQuery !== '' || State.activeSavedSort === 'distance') ? `<button class="filter-chip clear-filters" style="background:var(--pizza-light); color:var(--pizza-dark); font-weight:bold; border: 1px solid var(--pizza-dark);" onclick="App.clearAllSavedFilters()">✕ Clear</button>` : '';
  const chipsHTML = `<div class="filter-chips-wrapper">` + clearHTML + filters.map(f => {
    const activeCls = currentSet.has(f.id) ? 'active' : '';
    return `<button class="filter-chip ${activeCls}" onclick="App.toggleSavedFilter('${f.id}')">${esc(f.label)}</button>`;
  }).join('') + `</div>`;

  container.innerHTML = labelHTML + chipsHTML;
  updateMobileFabBadge();
}

export function clearAllSavedFilters() {
  State.activeSavedFilters.clear();
  State.draftSavedFilters.clear();
  State.savedSearchQuery = '';
  const searchInput = document.getElementById('saved-search-input');
  if (searchInput) searchInput.value = '';
  const savedSearchClearBtn = document.getElementById('saved-search-clear-btn');
  if (savedSearchClearBtn) savedSearchClearBtn.style.display = 'none';
  const compactInput = document.getElementById('compact-search-input');
  if (compactInput && State.activeTab === 'saved') compactInput.value = '';
  const compactClearBtn = document.getElementById('compact-search-clear-btn');
  if (compactClearBtn && State.activeTab === 'saved') compactClearBtn.style.display = 'none';
  
  if (State.activeSavedSort === 'distance') {
    toggleSavedDistanceSort();
  } else {
    if (window.App && window.App.renderSavedFilters) window.App.renderSavedFilters();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
  }
}

export function setSavedSort(s, el) {
  State.activeSavedSort = s;
  const sortSection = document.getElementById('saved-sort-section');
  if (sortSection) {
    sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  }
  if (el) el.classList.add('active');
  const zipContainer = document.getElementById('saved-zip-code-container');
  if (zipContainer) zipContainer.style.display = 'none';
  saveState();
  if (window.App && window.App.renderSaved) window.App.renderSaved();
}

export function toggleSavedDistanceSort(el) {
  const zipContainer = document.getElementById('saved-zip-code-container');
  const sortSection = document.getElementById('saved-sort-section');
  if (State.activeSavedSort === 'distance') {
    setSavedSort('restaurant', sortSection ? sortSection.querySelector('button.filter-chip') : null);
  } else {
    State.activeSavedSort = 'distance';
    if (sortSection) {
      sortSection.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    }
    if (el) el.classList.add('active');

    if (zipContainer) zipContainer.style.display = 'flex';
    if (State.userLat !== null && State.userLng !== null) {
      saveState();
      if (window.App && window.App.renderSaved) window.App.renderSaved();
    }
  }
}

export async function applySavedZipCode() {
  const zipInput = document.getElementById('saved-zip-code-input');
  const zip = zipInput.value.trim();
  if (!zip || zip.length !== 5) {
    showToast('⚠️ Please enter a valid 5-digit zip code');
    return;
  }

  if (PORTLAND_ZIP_CACHE[zip]) {
    State.userLat = PORTLAND_ZIP_CACHE[zip].lat;
    State.userLng = PORTLAND_ZIP_CACHE[zip].lng;
    
    const browseZipInput = document.getElementById('zip-code-input');
    if (browseZipInput) browseZipInput.value = zip;

    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    const savedZipContainer = document.getElementById('saved-zip-code-container');
    if (savedZipContainer) savedZipContainer.style.display = 'none';

    if (window.App && window.App.renderBrowse) window.App.renderBrowse();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
    return;
  }

  try {
    const btn = zipInput.nextElementSibling;
    btn.textContent = '...';
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    State.userLat = parseFloat(data.places[0].latitude);
    State.userLng = parseFloat(data.places[0].longitude);

    const browseZipInput = document.getElementById('zip-code-input');
    if (browseZipInput) browseZipInput.value = zip;

    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
    const savedZipContainer = document.getElementById('saved-zip-code-container');
    if (savedZipContainer) savedZipContainer.style.display = 'none';

    if (window.App && window.App.renderBrowse) window.App.renderBrowse();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
  } catch (e) {
    showToast('⚠️ Could not find that zip code');
  } finally {
    zipInput.nextElementSibling.textContent = 'Go';
  }
}

export function moveSavedItem(id, direction) {
  const currentSavedItems = getSaved();
  const savedIds = currentSavedItems.map(r => r.id);
  const idx = savedIds.indexOf(id);
  if (idx === -1) return;

  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= savedIds.length) return;

  const targetId = savedIds[newIdx];
  savedIds[idx] = targetId;
  savedIds[newIdx] = id;

  const remainingIds = [...State.saved].filter(x => !savedIds.includes(x));
  State.customSavedOrder = [...savedIds, ...remainingIds];

  saveState();
  if (window.App && window.App.renderSaved) window.App.renderSaved();
}

export function clearAllFilters() {
  if (State.activeTab === 'saved') {
    clearAllSavedFilters();
    return;
  }
  
  State.activeFilters.clear();
  State.draftFilters.clear();
  State.searchQuery = '';

  if (State.currentWeekId && State.weekFilters[State.currentWeekId]) {
    State.weekFilters[State.currentWeekId].activeFilters = [];
    delete State.weekFilters[State.currentWeekId].searchQuery;
  }
  saveState();
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchClearBtn) searchClearBtn.style.display = 'none';
  }
  const compactInput = document.getElementById('compact-search-input');
  if (compactInput) {
    compactInput.value = '';
    const compactClearBtn = document.getElementById('compact-search-clear-btn');
    if (compactClearBtn) compactClearBtn.style.display = 'none';
  }
  
  if (State.activeSort === 'distance') {
    State.activeSort = 'restaurant';
    const zipContainer = document.getElementById('zip-code-container');
    if (zipContainer) zipContainer.style.display = 'none';
  }

  if (window.App && window.App.renderFilters) window.App.renderFilters();
  if (window.App && window.App.renderBrowse) window.App.renderBrowse();
}

export function openFilterDrawer() {
  if (State.filterDrawerOpen) return;

  const overlay = document.getElementById('filter-drawer-overlay');
  const drawerBody = document.getElementById('filter-drawer-body');
  if (!overlay || !drawerBody) return;

  State.filterDrawerOpen = true;

  if (State.activeTab === 'saved') {
    State.draftSavedFilters = new Set(State.activeSavedFilters);
    const savedFilters = document.getElementById('saved-filters');
    const sortSection = document.getElementById('saved-sort-section');
    if (savedFilters && sortSection) {
      drawerBody.appendChild(savedFilters);
      drawerBody.appendChild(sortSection);

      if (window.App && window.App.renderSavedFilters) window.App.renderSavedFilters();
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  } else {
    State.draftFilters = new Set(State.activeFilters);
    const browseFilters = document.getElementById('browse-filters');
    const sortSection = document.getElementById('sort-section');
    if (browseFilters && sortSection) {
      drawerBody.appendChild(browseFilters);
      drawerBody.appendChild(sortSection);

      if (window.App && window.App.renderFilters) window.App.renderFilters();
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }
}

export function applyFilterDrawer() {
  if (State.activeTab === 'saved') {
    State.activeSavedFilters = new Set(State.draftSavedFilters);
    if (window.App && window.App.renderSavedFilters) window.App.renderSavedFilters();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
  } else {
    State.activeFilters = new Set(State.draftFilters);
    if (window.App && window.App.renderFilters) window.App.renderFilters();
    if (window.App && window.App.renderBrowse) window.App.renderBrowse();
  }
  closeFilterDrawer();
}

export function closeFilterDrawer() {
  if (!State.filterDrawerOpen) return;

  const overlay = document.getElementById('filter-drawer-overlay');
  if (!overlay) return;

  if (State.activeTab === 'saved') {
    State.draftSavedFilters = new Set(State.activeSavedFilters);
    const savedFilters = document.getElementById('saved-filters');
    const sortSection = document.getElementById('saved-sort-section');
    const savedHeader = document.querySelector('#view-saved .saved-header');
    const cardsSaved = document.getElementById('cards-saved');
    if (savedFilters && sortSection && savedHeader) {
      const controlsRow = savedHeader.querySelector('.header-controls-row') || savedHeader;
      controlsRow.appendChild(savedFilters);
      controlsRow.appendChild(sortSection);
      if (window.App && window.App.renderSavedFilters) window.App.renderSavedFilters();
    }
  } else {
    State.draftFilters = new Set(State.activeFilters);
    const browseFilters = document.getElementById('browse-filters');
    const sortSection = document.getElementById('sort-section');
    const browseHeader = document.querySelector('#view-browse .browse-header');
    if (browseFilters && sortSection && browseHeader) {
      const controlsRow = browseHeader.querySelector('.header-controls-row') || browseHeader;
      controlsRow.appendChild(browseFilters);
      controlsRow.appendChild(sortSection);
      if (window.App && window.App.renderFilters) window.App.renderFilters();
    }
  }

  overlay.classList.remove('open');
  State.filterDrawerOpen = false;
  document.body.style.overflow = '';
}
