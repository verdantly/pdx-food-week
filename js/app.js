/* ── PDX Food Week App (ES Module Entrypoint) ── */
import { State, loadState, saveState, checkWeekVisited, WEEK_FILE_MAP } from './modules/state.js';
import { esc, debounce, showToast } from './modules/utils.js';
import { getRestaurants, updateBrowseBadge, dismissNewBanner } from './modules/data.js';
import {
  openDetail, closeDetail, shareDish, toggleSave, setRating, setNote, handleNoteInput,
  openPhotoZoom, closePhotoZoom, showMetricDetails, closeMetricModal, getActiveFriends, getCurrentContextList
} from './modules/ui.js';
import {
  toggleFilter, setSort, toggleDistanceSort, useMyLocation, applyZipCode,
  toggleSavedFilter, clearAllSavedFilters, setSavedSort, toggleSavedDistanceSort,
  applySavedZipCode, moveSavedItem, clearAllFilters, openFilterDrawer,
  applyFilterDrawer, closeFilterDrawer, renderSavedFilters
} from './modules/filters.js';
import { renderMap, refreshMapLayout, handleCrawlPinClick } from './modules/map.js';
import { buildSwipeQueue, renderSwipe, swipe, undoSwipe, skipSwipe, resetSwipe, swipeOpenDetail, attachSwipeGestures } from './modules/swipe.js';
import {
  exportSavedToClipboard, exportSavedKML, renderFriends, generateShareLink,
  copyTextFromElement, shareNative, addFriend, renameFriend, removeFriend,
  viewFriendList, exitFriendView, mergeFriendList
} from './modules/friends.js';
import {
  toggleCrawlMode, clearCrawl, updateCrawlFab, generateCrawlItinerary,
  renderItinerarySheet, openCrawlMapsUrl, closeCrawlModal
} from './modules/crawl.js';
import { renderBrowse, renderSaved, renderFilters, renderHeader, applyWeekTheme, renderAll } from './modules/render.js';
import {
  initInstallPrompt, triggerInstall, openInstallModal, closeInstallModal,
  dismissInstallBanner, updateInstallUI
} from './modules/install.js';
import {
  initAuth, openAccountModal, closeAccountModal, signInWithGoogle,
  sendMagicLink, signInWithPassword, registerWithPassword, sendPasswordReset,
  handleSignOut, updateAuthUI
} from './modules/auth.js';
import { pushLocalToCloud, queueCloudSync } from './modules/sync.js';

// Firebase init reference
if (window.firebase) {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyD4aVF_dVWxrZ6F_GNQuZa1eBLOWdL0xXc",
      authDomain: "pdx-food-week.firebaseapp.com",
      projectId: "pdx-food-week",
      storageBucket: "pdx-food-week.firebasestorage.app",
      messagingSenderId: "641950496269",
      appId: "1:641950496269:web:05be564e86427f24d08744",
      measurementId: "G-78YTW9CPLJ"
    };
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();
    if (firebase.analytics) {
      window.analytics = firebase.analytics();
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

function hideCompactDropdowns() {
  const compactMenuDropdown = document.getElementById('compact-menu-dropdown');
  const compactSearchDropdown = document.getElementById('compact-search-dropdown');
  if (compactMenuDropdown) compactMenuDropdown.style.display = 'none';
  if (compactSearchDropdown) compactSearchDropdown.style.display = 'none';
}

function switchTab(name, fromPopState = false) {
  if (State.filterDrawerOpen) {
    closeFilterDrawer();
  }
  hideCompactDropdowns();
  State.activeTab = name;
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
  if (name === 'swipe' || name === 'share' || name === 'landing') {
    closeDetail(true);
  } else if (name !== 'map') {
    const sheetContent = document.getElementById('detail-sheet-content');
    if (sheetContent && sheetContent.innerHTML.includes('Your Food Crawl')) {
      closeDetail(true);
    }
  }
  if (name === 'map') {
    renderMap();
    requestAnimationFrame(refreshMapLayout);
  }
  if (name === 'swipe') {
    if (!State.swipeQueue) buildSwipeQueue();
    renderSwipe();
  }

  document.body.classList.toggle('is-landing', name === 'landing');

  const appContainer = document.getElementById('app');
  const fabButton = document.getElementById('mobile-filter-fab');
  if (appContainer) appContainer.classList.remove('compact-header');
  if (fabButton) {
    if (name === 'browse' || (name === 'saved' && State.saved.size > 0)) {
      fabButton.classList.add('show-fab');
      fabButton.classList.remove('hide-fab-scroll');
    } else {
      fabButton.classList.remove('show-fab');
    }
  }
  
  const crawlFab = document.getElementById('crawl-fab');
  if (crawlFab) {
    crawlFab.style.display = (name === 'map' && State.crawlModeActive) ? 'block' : 'none';
  }
  
  if (window.App && window.App.updateMobileFabBadge) window.App.updateMobileFabBadge();
  State.lastScrollTop = 0;

  if (!fromPopState) {
    const url = new URL(window.location);
    if (name === 'browse') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', name);
    }
    
    const newState = { ...history.state, tab: name };
    delete newState.dishOpenedHere;
    if (appContainer && appContainer.classList.contains('detail-open')) {
      history.replaceState(newState, '', url);
    } else {
      history.pushState(newState, '', url);
    }
  }
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

function loadWeekData(weekId, callback) {
  if (State.loadedWeeks.has(weekId)) {
    if (callback) callback();
    return;
  }

  const script = document.createElement('script');
  script.src = `data/${WEEK_FILE_MAP[weekId]}?v=2`;
  script.onload = () => {
    State.loadedWeeks.add(weekId);
    
    const uniqueWeeks = [];
    const seen = new Set();
    for (const w of (window.FOOD_WEEKS || [])) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        uniqueWeeks.push(w);
      }
    }
    window.FOOD_WEEKS = uniqueWeeks;
    
    if (callback) callback();
  };
  script.onerror = () => {
    showToast('Error loading data for this week');
    State.currentWeekId = null;
    applyWeekTheme(null);
    document.body.classList.add('is-landing');
    switchTab('landing', true);
    renderLanding();
    if (callback) callback();
  };
  document.body.appendChild(script);
}

function switchWeek(weekId, fromPopState = false) {
  if (!window.FOOD_WEEKS || !window.FOOD_WEEKS.some(w => w.id === weekId)) return;

  if (State.currentWeekId) {
    State.weekFilters[State.currentWeekId] = {
      activeFilters: Array.from(State.activeFilters),
      searchQuery: State.searchQuery,
      activeSort: State.activeSort
    };
  }

  State.currentWeekId = weekId;
  checkWeekVisited(State.currentWeekId);

  const savedWeekState = State.weekFilters[weekId];
  if (savedWeekState) {
    State.activeFilters = new Set(savedWeekState.activeFilters);
    State.searchQuery = savedWeekState.searchQuery || '';
    State.activeSort = savedWeekState.activeSort || 'restaurant';
  } else {
    State.activeFilters.clear();
    State.searchQuery = '';
    State.activeSort = 'restaurant';
  }

  saveState();

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = State.searchQuery;

  State.activeSavedFilters.clear();
  State.savedSearchQuery = '';
  const savedSearchInput = document.getElementById('saved-search-input');
  if (savedSearchInput) {
    savedSearchInput.value = '';
    const savedSearchClearBtn = document.getElementById('saved-search-clear-btn');
    if (savedSearchClearBtn) savedSearchClearBtn.style.display = 'none';
  }

  State.mapSearchQuery = '';
  const mapSearchInput = document.getElementById('map-search-input');
  if (mapSearchInput) {
    mapSearchInput.value = '';
    const mapSearchClearBtn = document.getElementById('map-search-clear-btn');
    if (mapSearchClearBtn) mapSearchClearBtn.style.display = 'none';
  }
  const mapStatsRow = document.getElementById('map-stats-row');
  if (mapStatsRow) mapStatsRow.style.display = 'none';

  State.activeSort = 'restaurant';
  document.querySelectorAll('#sort-row button.filter-chip, #sort-section button.filter-chip').forEach(btn => {
    if (btn.textContent.includes('Restaurant')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  State.activeSavedSort = 'restaurant';
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

  State.swipeQueue = null;

  refreshMapLayout();

  const week = window.FOOD_WEEKS.find(w => w.id === State.currentWeekId);
  applyWeekTheme(week);
  renderHeader();
  renderFilters();
  renderSavedFilters();

  if (!fromPopState) {
    const url = new URL(window.location);
    url.searchParams.set('week', weekId);
    url.searchParams.delete('tab');
    history.pushState({ ...history.state, week: weekId, tab: 'browse' }, '', url);
  }
  document.body.classList.remove('is-landing');

  switchTab('browse', true);
  renderShimmer();
  
  const loadDataAndRender = () => {
    renderAll();
    updateBrowseBadge();
    showToast(`Switched to ${week.name}!`);
  };

  loadWeekData(weekId, () => {
    setTimeout(loadDataAndRender, 450);
  });
}

function renderLanding() {
  applyWeekTheme(null);
  const grid = document.getElementById('landing-grid');
  if (!grid || !window.FOOD_WEEKS) return;

  const now = new Date();
  let currentWeeks = [];
  let nextWeek = null;
  let minDiff = Infinity;

  window.FOOD_WEEKS.forEach(w => {
    if (w.startDate) {
      const [sy, sm, sd] = w.startDate.split('-');
      const start = new Date(sy, sm - 1, sd, 0, 0, 0);
      let end = new Date(sy, sm - 1, sd, 23, 59, 59);

      if (w.endDate) {
        const [ey, em, ed] = w.endDate.split('-');
        end = new Date(ey, em - 1, ed, 23, 59, 59);
      } else if (w.dates) {
        const weekMatch = w.dates.match(/([a-zA-Z]+)\s+\d+\s*[-–]\s*(\d+),\s+(\d{4})/);
        const monthMatch = w.dates.match(/([a-zA-Z]+)\s+(\d{4})/);
        if (weekMatch) {
          end = new Date(`${weekMatch[1]} ${weekMatch[2]}, ${weekMatch[3]} 23:59:59`);
        } else if (monthMatch) {
          end = new Date(`${monthMatch[1]} 1, ${monthMatch[2]} 23:59:59`);
          end.setMonth(end.getMonth() + 1);
          end.setDate(0);
        } else {
          end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        }
      } else {
        end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      }

      if (now >= start && now <= end) {
        currentWeeks.push(w);
      } else if (now < start) {
        const diff = start - now;
        if (diff < minDiff) {
          minDiff = diff;
          nextWeek = w;
        }
      }
    }
  });

  const sortedWeeks = [...window.FOOD_WEEKS].sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
    const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
    return dateB - dateA;
  });

  grid.innerHTML = sortedWeeks.map(w => {
    let badgeHTML = '';
    const isActive = currentWeeks.some(cw => cw.id === w.id);
    const isNext = nextWeek && w.id === nextWeek.id;

    if (isActive) {
      badgeHTML = '<div class="landing-status-badge active"><span class="badge-dot-live"></span> Active Now</div>';
    } else if (isNext) {
      badgeHTML = '<div class="landing-status-badge next">Up Next</div>';
    }

    const priceText = (w.pricePills && w.pricePills.length > 0)
      ? esc(w.pricePills[0])
      : (w.priceSlice ? `${esc(w.priceSlice)} slice` : '');

    const actualCount = (window.RESTAURANTS || []).filter(r => r.weekId === w.id).length;
    const totalLocations = actualCount > 0 ? actualCount : w.totalLocations;
    const countText = totalLocations ? `${totalLocations} spots` : '';

    const metaParts = [priceText, countText].filter(Boolean).join(' • ');
    const metaHTML = metaParts ? `<p class="landing-card-subinfo">${metaParts}</p>` : '';

    const themeColor = w.color || 'var(--pizza)';

    return `
      <a href="?week=${w.id}" class="landing-card ${isActive ? 'is-active-food-week' : ''}" style="--week-brand: ${themeColor};" onclick="event.preventDefault(); App.switchWeek('${w.id}');">
        ${badgeHTML}
        <div class="landing-emoji">${w.emoji || '🍽️'}</div>
        <h3>${esc(w.name)}</h3>
        <p class="landing-card-dates">${esc(w.dates)}</p>
        ${metaHTML}
      </a>
    `;
  }).join('');
}

function setupMobileScrollListener() {
  const viewBrowse = document.getElementById('view-browse');
  const viewSaved = document.getElementById('view-saved');
  if (!viewBrowse || !viewSaved) return;

  const onScroll = () => {
    if (window.innerWidth > 768) {
      document.getElementById('app').classList.remove('compact-header');
      const fab = document.getElementById('mobile-filter-fab');
      if (fab) fab.classList.remove('show-fab');
      return;
    }

    if (State.activeTab !== 'browse' && State.activeTab !== 'saved') return;

    const currentView = State.activeTab === 'browse' ? viewBrowse : viewSaved;
    const st = currentView ? currentView.scrollTop : (window.scrollY || 0);
    const appContainer = document.getElementById('app');
    const fabButton = document.getElementById('mobile-filter-fab');

    if (State.activeTab === 'saved' && State.saved.size === 0) {
      if (fabButton) fabButton.classList.remove('show-fab');
      return;
    }

    let scrollHeight, clientHeight;
    if (currentView.scrollHeight > currentView.clientHeight) {
      scrollHeight = currentView.scrollHeight;
      clientHeight = currentView.clientHeight;
    } else {
      scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      clientHeight = window.innerHeight;
    }
    
    const isScrollable = scrollHeight > clientHeight + 10;
    const isNearBottom = isScrollable && st > 50 && (st + clientHeight >= scrollHeight - 40);

    if (fabButton) {
      if (isNearBottom) {
        fabButton.classList.add('hide-fab-scroll');
      } else {
        fabButton.classList.remove('hide-fab-scroll');
      }
    }

    const delta = st - State.lastScrollTop;

    if (st <= 60) {
      appContainer.classList.remove('compact-header');
    } else if (delta > 20 && st > 150) {
      appContainer.classList.add('compact-header');
    } else if (delta < -30) {
      appContainer.classList.remove('compact-header');
    }
    State.lastScrollTop = st <= 0 ? 0 : st;
  };

  viewBrowse.addEventListener('scroll', onScroll, { passive: true });
  viewSaved.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
}

function setupSavedDragEvents() {
  const cards = document.querySelectorAll('#cards-saved .dish-card');
  let draggedCardId = null;
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      if (State.activeSavedSort !== 'custom') return;
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
      if (State.activeSavedSort !== 'custom' || draggedCardId === null) return;
      const targetId = Number(card.getAttribute('data-id'));
      if (targetId === draggedCardId) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
  });
}

function init() {
  loadState();
  initInstallPrompt();
  initAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const urlWeekId = urlParams.get('week');

  window.addEventListener('popstate', e => {
    closePhotoZoom();
    closeFilterDrawer();
    closeMetricModal();

    if (e.state && e.state.detailDishId !== undefined) {
      openDetail(e.state.detailDishId, true);
    } else if (State.selectedDish) {
      closeDetail(true);
    }

    const currentUrlParams = new URLSearchParams(window.location.search);
    const targetWeekId = currentUrlParams.get('week');

    if (!targetWeekId) {
      document.body.classList.add('is-landing');
      State.currentWeekId = null;
      renderLanding();
      switchTab('landing', true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (targetWeekId !== State.currentWeekId) {
      switchWeek(targetWeekId, true);
    } else {
      let tab = (e.state && e.state.tab) || currentUrlParams.get('tab') || 'browse';
      if (tab === 'friends') tab = 'share';
      if (State.activeTab !== tab) {
        switchTab(tab, true);
      }
    }
  });

  const detailOverlay = document.getElementById('detail-overlay');
  if (detailOverlay) {
    detailOverlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeDetail();
    });
  }

  const detailSheet = document.getElementById('detail-sheet-content');
  if (detailSheet) {
    let sheetStartY = 0;
    let sheetCurrentY = 0;
    let sheetIsDragging = false;
    let sheetAtTop = false;

    detailSheet.addEventListener('touchstart', e => {
      if (window.innerWidth > 768) return;
      sheetStartY = e.touches[0].clientY;
      sheetAtTop = detailSheet.scrollTop <= 2;
      sheetIsDragging = true;
      detailSheet.style.transition = 'none';
    }, { passive: false });

    detailSheet.addEventListener('touchmove', e => {
      if (!sheetIsDragging || !sheetAtTop || window.innerWidth > 768) return;
      sheetCurrentY = e.touches[0].clientY;
      const deltaY = sheetCurrentY - sheetStartY;
      if (deltaY > 0) {
        if (e.cancelable) e.preventDefault();
        detailSheet.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: false });

    detailSheet.addEventListener('touchend', e => {
      if (!sheetIsDragging || window.innerWidth > 768) return;
      sheetIsDragging = false;
      detailSheet.style.transition = '';
      const deltaY = sheetCurrentY - sheetStartY;
      if (sheetAtTop && deltaY > 80) {
        closeDetail();
        setTimeout(() => { detailSheet.style.transform = ''; }, 300);
      } else {
        detailSheet.style.transform = '';
      }
    });
  }

  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchInput && searchClearBtn) {
    const debouncedSearch = debounce(e => {
      State.searchQuery = e.target.value;
      searchClearBtn.style.display = State.searchQuery ? 'flex' : 'none';
      renderBrowse();
      renderFilters();
    }, 150);
    searchInput.addEventListener('input', debouncedSearch);
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      State.searchQuery = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      renderBrowse();
      renderFilters();
    });
  }

  const savedSearchInput = document.getElementById('saved-search-input');
  const savedSearchClearBtn = document.getElementById('saved-search-clear-btn');
  if (savedSearchInput && savedSearchClearBtn) {
    const debouncedSavedSearch = debounce(e => {
      State.savedSearchQuery = e.target.value;
      savedSearchClearBtn.style.display = State.savedSearchQuery ? 'flex' : 'none';
      renderSaved();
    }, 150);
    savedSearchInput.addEventListener('input', debouncedSavedSearch);
    savedSearchClearBtn.addEventListener('click', () => {
      savedSearchInput.value = '';
      State.savedSearchQuery = '';
      savedSearchClearBtn.style.display = 'none';
      savedSearchInput.focus();
      renderSaved();
    });
  }

  const mapSearchInput = document.getElementById('map-search-input');
  const mapSearchClearBtn = document.getElementById('map-search-clear-btn');
  if (mapSearchInput && mapSearchClearBtn) {
    const debouncedMapSearch = debounce(e => {
      State.mapSearchQuery = e.target.value;
      mapSearchClearBtn.style.display = State.mapSearchQuery ? 'flex' : 'none';
      renderMap();
    }, 150);
    mapSearchInput.addEventListener('input', debouncedMapSearch);
    mapSearchClearBtn.addEventListener('click', () => {
      mapSearchInput.value = '';
      State.mapSearchQuery = '';
      mapSearchClearBtn.style.display = 'none';
      mapSearchInput.focus();
      renderMap();
    });
  }

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
        compactSearchInput.value = (State.activeTab === 'saved') ? State.savedSearchQuery : (State.activeTab === 'map' ? State.mapSearchQuery : State.searchQuery);
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
      
      if (State.activeTab === 'browse') {
        State.searchQuery = val;
        const mainSearchInput = document.getElementById('search-input');
        if (mainSearchInput) mainSearchInput.value = val;
        renderBrowse();
      } else if (State.activeTab === 'saved') {
        State.savedSearchQuery = val;
        const mainSavedSearchInput = document.getElementById('saved-search-input');
        if (mainSavedSearchInput) mainSavedSearchInput.value = val;
        renderSaved();
      } else if (State.activeTab === 'map') {
        State.mapSearchQuery = val;
        const mainMapSearchInput = document.getElementById('map-search-input');
        if (mainMapSearchInput) mainMapSearchInput.value = val;
        renderMap();
      }
    });

    compactSearchClearBtn.addEventListener('click', () => {
      compactSearchInput.value = '';
      compactSearchClearBtn.style.display = 'none';
      if (State.activeTab === 'browse') {
        State.searchQuery = '';
        const mainSearchInput = document.getElementById('search-input');
        if (mainSearchInput) mainSearchInput.value = '';
        renderBrowse();
      } else if (State.activeTab === 'saved') {
        State.savedSearchQuery = '';
        const mainSavedSearchInput = document.getElementById('saved-search-input');
        if (mainSavedSearchInput) mainSavedSearchInput.value = '';
        renderSaved();
      } else if (State.activeTab === 'map') {
        State.mapSearchQuery = '';
        const mainMapSearchInput = document.getElementById('map-search-input');
        if (mainMapSearchInput) mainMapSearchInput.value = '';
        renderMap();
      }
      compactSearchInput.focus();
    });
  }

  document.addEventListener('click', e => {
    const isCompactClick = e.target.closest('.compact-app-bar') || e.target.closest('.compact-dropdown');
    if (!isCompactClick && compactSearchDropdown && compactMenuDropdown) {
      compactSearchDropdown.style.display = 'none';
      compactMenuDropdown.style.display = 'none';
    }
  });

  const shareListId = urlParams.get('list');
  const shareFallback = urlParams.get('fallback');
  if (shareListId || shareFallback) {
    setTimeout(async () => {
      const input = document.getElementById('friend-code-input');
      if (input) input.value = window.location.href;
      await addFriend();
      window.history.replaceState({}, document.title, window.location.pathname + '?week=' + State.currentWeekId);
      if (State.activeTab !== 'share') switchTab('share');
    }, 500);
  }

  const friendInput = document.getElementById('friend-code-input');
  if (friendInput) {
    friendInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') addFriend();
    });
  }

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

  attachSwipeGestures();
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('detail-overlay');
    if (overlay && overlay.classList.contains('open')) {
      if (e.target && /INPUT|TEXTAREA/i.test(e.target.tagName)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
      } else if (e.key === 'ArrowLeft') {
        const list = getCurrentContextList();
        const idx = State.selectedDish ? list.findIndex(x => x.id === State.selectedDish.id) : -1;
        const prevId = idx > 0 ? list[idx - 1].id : null;
        if (prevId) {
          e.preventDefault();
          openDetail(prevId);
        }
      } else if (e.key === 'ArrowRight') {
        const list = getCurrentContextList();
        const idx = State.selectedDish ? list.findIndex(x => x.id === State.selectedDish.id) : -1;
        const nextId = idx !== -1 && idx < list.length - 1 ? list[idx + 1].id : null;
        if (nextId) {
          e.preventDefault();
          openDetail(nextId);
        }
      }
      return;
    }

    if (State.activeTab !== 'swipe') return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); swipe('right'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); swipe('left'); }
  });

function updateSearchPlaceholders() {
  const isDesktop = window.innerWidth >= 768;
  const placeholder = isDesktop
    ? 'Search restaurants, dishes, neighborhoods...'
    : 'Search restaurants, dishes, areas...';

  ['search-input', 'saved-search-input', 'map-search-input', 'compact-search-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.placeholder = placeholder;
  });
}

  window.addEventListener('resize', () => {
    if (State.activeTab === 'swipe') renderSwipe();
    if (window.innerWidth > 768 && State.filterDrawerOpen) {
      closeFilterDrawer();
    }
    updateSearchPlaceholders();
  });

  const mql = window.matchMedia('(min-width: 768px)');
  if (mql.addEventListener) {
    mql.addEventListener('change', updateSearchPlaceholders);
  } else if (mql.addListener) {
    mql.addListener(updateSearchPlaceholders);
  }
  updateSearchPlaceholders();

  setupMobileScrollListener();

  const isValidWeek = urlWeekId && window.FOOD_WEEKS && window.FOOD_WEEKS.some(w => w.id === urlWeekId);

  if (!isValidWeek) {
    State.currentWeekId = null;
    applyWeekTheme(null);
    document.body.classList.add('is-landing');
    history.replaceState({ week: null, tab: 'landing' }, '', window.location.pathname);
    switchTab('landing', true);
    renderLanding();
    return;
  }

  State.currentWeekId = urlWeekId;
  checkWeekVisited(State.currentWeekId);
  document.body.classList.remove('is-landing');

  const week = (window.FOOD_WEEKS || []).find(w => w.id === State.currentWeekId);
  applyWeekTheme(week);
  renderHeader();
  renderFilters();

  let initialTab = urlParams.get('tab');
  if (initialTab === 'friends') initialTab = 'share';
  if (initialTab && ['browse', 'swipe', 'saved', 'share', 'map'].includes(initialTab)) {
    switchTab(initialTab, true);
  } else {
    switchTab('browse', true);
  }
  
  loadWeekData(State.currentWeekId, () => {
    renderAll();
    updateBrowseBadge();
    const initialDishId = urlParams.get('dish');
    if (initialDishId) {
      openDetail(parseInt(initialDishId, 10), true);
    }
  });
}

// Assemble the App object for window.App
const App = {
  init,
  switchTab,
  toggleFilter,
  setSort,
  toggleSave,
  openDetail,
  closeDetail,
  shareDish,
  addFriend,
  renameFriend,
  removeFriend,
  viewFriendList,
  exitFriendView,
  mergeFriendList,
  swipe,
  undoSwipe,
  resetSwipe,
  swipeOpenDetail,
  skipSwipe,
  switchWeek,
  exportSavedToClipboard,
  exportSavedKML,
  showMetricDetails,
  closeMetricModal,
  setRating,
  setNote,
  toggleDistanceSort,
  applyZipCode,
  useMyLocation,
  generateShareLink,
  copyTextFromElement,
  shareNative,
  dismissNewBanner,
  openFilterDrawer,
  applyFilterDrawer,
  closeFilterDrawer,
  handleNoteInput,
  toggleSavedFilter,
  setSavedSort,
  toggleSavedDistanceSort,
  applySavedZipCode,
  moveSavedItem,
  goToLanding: (e) => {
    if (e) e.preventDefault();
    if (!State.currentWeekId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const url = new URL(window.location);
    url.searchParams.delete('week');
    url.searchParams.delete('tab');
    url.searchParams.delete('dish');
    history.pushState({}, '', url);
    State.currentWeekId = null;
    applyWeekTheme(null);
    document.body.classList.add('is-landing');
    switchTab('landing', true);
    renderLanding();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  clearAllFilters,
  clearAllSavedFilters,
  openPhotoZoom,
  closePhotoZoom,
  toggleCrawlMode,
  generateCrawlItinerary,
  closeCrawlModal,
  renderItinerarySheet,
  openCrawlMapsUrl,
  handleCrawlPinClick,
  clearCrawl,
  updateCrawlFab,
  renderBrowse,
  renderSaved,
  renderFilters,
  renderSavedFilters,
  renderFriends,
  renderAll,
  setupSavedDragEvents,
  getActiveFriends,
  hideCompactDropdowns,
  triggerInstall,
  openInstallModal,
  closeInstallModal,
  dismissInstallBanner,
  updateInstallUI,
  openAccountModal,
  closeAccountModal,
  signInWithGoogle,
  sendMagicLink,
  signInWithPassword,
  registerWithPassword,
  sendPasswordReset,
  handleSignOut,
  updateAuthUI,
  pushLocalToCloud,
  queueCloudSync
};

window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}
