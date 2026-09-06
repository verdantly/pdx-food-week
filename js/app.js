/* ── PDX Food Week App (ES Module Entrypoint) ── */
import { State, loadState, saveState, checkWeekVisited, getWeekFile, migrateWeekSavedState } from './modules/state.js';
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
  renderItinerarySheet, openCrawlMapsUrl, closeCrawlModal,
  toggleSavedCrawlMode, handleCrawlCardClick, handleMapPlanCrawlClick,
  openCrawlOptionsModal, closeCrawlOptionsModal, startMapPinCrawlMode,
  openSavedCrawlPicker, closeSavedPickerModal, toggleSavedPickerItem,
  selectAllSavedForCrawl, clearAllSavedFromCrawl, submitSavedPickerForCrawl,
  openCrawlItineraryModal, closeCrawlItineraryModal, moveCrawlItem,
  removeCrawlItem, optimizeCurrentCrawl, viewCrawlOnMap
} from './modules/crawl.js';
import { renderBrowse, renderSaved, renderFilters, renderHeader, applyWeekTheme, renderAll, renderWeekSwitchers } from './modules/render.js';

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
    crawlFab.style.display = ((name === 'map' || name === 'saved') && State.crawlModeActive) ? 'block' : 'none';
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

async function checkMetadataUpdate() {
  try {
    const res = await fetch(`js/meta.js?t=${Date.now()}`, { cache: 'no-cache' });
    if (!res || !res.ok) return;
    const text = await res.text();
    
    // Evaluate fresh meta in a safe sandbox or context to extract window.FOOD_WEEKS
    const match = text.match(/window\.FOOD_WEEKS\s*=\s*(\[[\s\S]*?\]);\s*window\.getWeekMeta/);
    if (!match) return;

    let freshWeeks;
    try {
      freshWeeks = (new Function(`return ${match[1]}`))();
    } catch (e) {
      return;
    }

    if (!Array.isArray(freshWeeks) || freshWeeks.length === 0) return;

    const currentIds = (window.FOOD_WEEKS || []).map(w => w.id).join(',');
    const freshIds = freshWeeks.map(w => w.id).join(',');

    if (currentIds !== freshIds) {
      console.log('[checkMetadataUpdate] New food weeks detected. Hydrating UI...');
      window.FOOD_WEEKS = freshWeeks;
      renderWeekSwitchers();
      if (!State.currentWeekId) {
        renderLanding();
      } else {
        showToast('New food weeks added to PDX Food Week!');
      }
    }
  } catch (err) {
    // Silently ignore network failures (e.g. offline)
  }
}

async function loadWeekData(weekId, callback) {
  const dataFile = getWeekFile(weekId);
  if (!weekId || !dataFile) {
    console.warn(`[loadWeekData] Unknown or missing dataFile for weekId: "${weekId}"`);
    showToast('Error loading data for this week');
    State.currentWeekId = null;
    applyWeekTheme(null);
    document.body.classList.add('is-landing');
    switchTab('landing', true);
    renderLanding();
    if (callback) callback();
    return;
  }

  if (State.loadedWeeks.has(weekId)) {
    migrateWeekSavedState(weekId);
    if (callback) callback();
    return;
  }

  const finalizeLoad = () => {
    State.loadedWeeks.add(weekId);
    migrateWeekSavedState(weekId);

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

  const handleError = () => {
    showToast('Error loading data for this week');
    State.currentWeekId = null;
    applyWeekTheme(null);
    document.body.classList.add('is-landing');
    switchTab('landing', true);
    renderLanding();
    if (callback) callback();
  };

  // Modern fetch with fallback to script injection
  try {
    const res = await fetch(`data/${dataFile}?v=2`);
    if (res && res.ok) {
      const code = await res.text();
      const fn = new Function(code);
      fn.call(window);
      finalizeLoad();
      return;
    }
  } catch (fetchErr) {
    // Fall back to script injection (e.g. for file:// or offline fallback)
  }

  const script = document.createElement('script');
  script.src = `data/${dataFile}?v=2`;
  script.onload = finalizeLoad;
  script.onerror = handleError;
  document.body.appendChild(script);
}

function switchWeek(weekId, fromPopState = false) {
  if (!window.FOOD_WEEKS || !window.FOOD_WEEKS.some(w => w.id === weekId)) return;

  if (State.currentWeekId) {
    State.weekFilters[State.currentWeekId] = {
      activeFilters: Array.from(State.activeFilters),
      activeSort: State.activeSort
    };
  }

  State.currentWeekId = weekId;
  checkWeekVisited(State.currentWeekId);

  const savedWeekState = State.weekFilters[weekId];
  if (savedWeekState) {
    State.activeFilters = new Set(savedWeekState.activeFilters || []);
    State.activeSort = savedWeekState.activeSort || 'restaurant';
  } else {
    State.activeFilters.clear();
    State.activeSort = 'restaurant';
  }
  // Search query should not persist across week switches
  State.searchQuery = '';
  State.savedSearchQuery = '';
  State.mapSearchQuery = '';

  saveState();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchClearBtn) searchClearBtn.style.display = 'none';
  }
  const compactSearchInput = document.getElementById('compact-search-input');
  if (compactSearchInput) {
    compactSearchInput.value = '';
    const compactSearchClearBtn = document.getElementById('compact-search-clear-btn');
    if (compactSearchClearBtn) compactSearchClearBtn.style.display = 'none';
  }

  // Reset dropdown selects so they never stay stuck on the selected week
  document.querySelectorAll('.week-switcher-select').forEach(sel => {
    sel.selectedIndex = 0;
  });

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
  renderWeekSwitchers();
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

let landingCarouselState = {
  currentIndex: 0,
  timer: null,
  spots: [],
  weekId: null
};

function initLandingCarousel(spots, weekId) {
  landingCarouselState.spots = spots || [];
  landingCarouselState.weekId = weekId;
  landingCarouselState.currentIndex = 0;
  if (landingCarouselState.timer) {
    clearInterval(landingCarouselState.timer);
    landingCarouselState.timer = null;
  }
  updateLandingCarouselDOM();
  startLandingCarouselTimer();
}

function startLandingCarouselTimer() {
  if (landingCarouselState.timer) clearInterval(landingCarouselState.timer);
  if (landingCarouselState.spots.length <= 1) return;
  landingCarouselState.timer = setInterval(() => {
    moveLandingCarousel(1);
  }, 5000);
}

function stopLandingCarouselTimer() {
  if (landingCarouselState.timer) {
    clearInterval(landingCarouselState.timer);
    landingCarouselState.timer = null;
  }
}

function moveLandingCarousel(delta) {
  const count = landingCarouselState.spots.length;
  if (count <= 1) return;
  landingCarouselState.currentIndex = (landingCarouselState.currentIndex + delta + count) % count;
  updateLandingCarouselDOM();
}

function setLandingCarouselIndex(index) {
  const count = landingCarouselState.spots.length;
  if (index < 0 || index >= count) return;
  landingCarouselState.currentIndex = index;
  updateLandingCarouselDOM();
  startLandingCarouselTimer();
}

function updateLandingCarouselDOM() {
  const track = document.getElementById('landing-carousel-track');
  const dots = document.querySelectorAll('.landing-carousel-dot');
  if (!track || !landingCarouselState.spots.length) return;

  const currentIdx = landingCarouselState.currentIndex;
  track.style.transform = `translateX(-${currentIdx * 100}%)`;

  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentIdx);
    dot.setAttribute('aria-current', idx === currentIdx ? 'true' : 'false');
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

  // Determine featured week: currently active, or next upcoming, or first sorted week
  let featuredWeek = currentWeeks[0] || nextWeek || sortedWeeks[0];
  const otherWeeks = sortedWeeks.filter(w => w.id !== featuredWeek.id);

  const isFeaturedActive = currentWeeks.some(cw => cw.id === featuredWeek.id);
  const isFeaturedNext = !isFeaturedActive && nextWeek && featuredWeek.id === nextWeek.id;

  let featuredBadgeHTML = '';
  if (isFeaturedActive) {
    featuredBadgeHTML = '<div class="landing-status-badge active"><span class="badge-dot-live"></span> Active Now</div>';
  } else if (isFeaturedNext) {
    featuredBadgeHTML = '<div class="landing-status-badge next">Up Next</div>';
  }

  const featuredPriceText = (featuredWeek.pricePills && featuredWeek.pricePills.length > 0)
    ? esc(featuredWeek.pricePills[0])
    : (featuredWeek.priceSlice ? `${esc(featuredWeek.priceSlice)} slice` : '');

  const featuredActualCount = (window.RESTAURANTS || []).filter(r => r.weekId === featuredWeek.id).length;
  const featuredTotalLocations = featuredActualCount > 0 ? featuredActualCount : featuredWeek.totalLocations;
  const featuredCountText = featuredTotalLocations ? `${featuredTotalLocations} spots` : '';
  const featuredMetaParts = [featuredPriceText, featuredCountText].filter(Boolean).join(' • ');

  const featuredThemeColor = featuredWeek.color || 'var(--pizza)';

  // Render other weeks list items
  const otherWeeksHTML = otherWeeks.map(w => {
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
    const metaHTML = metaParts ? `<span class="landing-card-subinfo">${metaParts}</span>` : '';
    const themeColor = w.color || 'var(--pizza)';

    return `
      <a href="?week=${w.id}" class="landing-card ${isActive ? 'is-active-food-week' : ''}" style="--week-brand: ${themeColor};" onclick="event.preventDefault(); App.switchWeek('${w.id}');">
        <div class="landing-emoji">${w.emoji || '🍽️'}</div>
        <div class="landing-card-main">
          <div class="landing-card-title-row">
            <h3>${esc(w.name)}</h3>
          </div>
          <div class="landing-card-dates-row">
            <span class="landing-card-dates">${esc(w.dates)}</span>
          </div>
          ${metaHTML ? `<div class="landing-card-meta-row">${metaHTML}</div>` : ''}
        </div>
        ${badgeHTML}
        <div class="landing-card-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </a>
    `;
  }).join('');

  // Assemble full 3-column / 4-row landing grid
  grid.innerHTML = `
    <!-- Visually Unified Featured Week Showcase (Columns 1 & 2, Rows 1-4 on desktop) -->
    <div class="landing-featured-showcase ${isFeaturedActive ? 'is-active-food-week' : ''}" style="--week-brand: ${featuredThemeColor};" onmouseenter="App.stopLandingCarouselTimer()" onmouseleave="App.startLandingCarouselTimer()">
      <div class="featured-showcase-header">
        <a href="?week=${featuredWeek.id}" class="featured-showcase-title-link" onclick="event.preventDefault(); App.switchWeek('${featuredWeek.id}');">
          <div class="featured-card-info">
            <div class="landing-card-title-row">
              <h3 class="featured-title">${esc(featuredWeek.name)}</h3>
            </div>
            <div class="landing-card-dates-row">
              <span class="landing-card-dates">${esc(featuredWeek.dates)}</span>
            </div>
            ${featuredMetaParts ? `<div class="landing-card-meta-row"><span class="landing-card-subinfo">${featuredMetaParts}</span></div>` : ''}
          </div>
        </a>
        <div class="featured-showcase-header-right">
          ${featuredBadgeHTML}
        </div>
      </div>

      <!-- Carousel Viewport with Large Photos and Overlay Navigation Arrows -->
      <div class="landing-carousel-viewport" id="landing-carousel-viewport">
        <button type="button" class="landing-carousel-arrow-overlay prev" onclick="event.stopPropagation(); App.moveLandingCarousel(-1)" aria-label="Previous special">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" class="landing-carousel-arrow-overlay next" onclick="event.stopPropagation(); App.moveLandingCarousel(1)" aria-label="Next special">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <div class="landing-carousel-track" id="landing-carousel-track">
          <!-- Populated with random spots -->
          <div class="landing-carousel-loading">Loading specials...</div>
        </div>
      </div>
      <div class="landing-carousel-dots" id="landing-carousel-dots"></div>
    </div>

    <!-- Right Column: Other Food Weeks List (Rows 1-4, Column 3 on desktop) -->
    <div class="landing-others-column">
      <div class="landing-others-list">
        ${otherWeeksHTML}
      </div>
    </div>
  `;

  // Attach touch gestures for mobile carousel swipe
  attachLandingCarouselTouch();

  // Load spots for featured week if needed
  ensureFeaturedSpotsLoaded(featuredWeek.id);
}

function attachLandingCarouselTouch() {
  const viewport = document.getElementById('landing-carousel-viewport');
  if (!viewport) return;

  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  viewport.addEventListener('touchstart', (e) => {
    if (!e.touches || !e.touches[0]) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
    stopLandingCarouselTimer();
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    if (!isSwiping || !e.changedTouches || !e.changedTouches[0]) return;
    isSwiping = false;
    const diffX = e.changedTouches[0].clientX - startX;
    const diffY = e.changedTouches[0].clientY - startY;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        moveLandingCarousel(1);
      } else {
        moveLandingCarousel(-1);
      }
    }
    startLandingCarouselTimer();
  }, { passive: true });
}

function ensureFeaturedSpotsLoaded(weekId) {
  const existingSpots = (window.RESTAURANTS || []).filter(r => r.weekId === weekId);
  if (existingSpots.length > 0) {
    populateLandingCarousel(existingSpots, weekId);
    return;
  }

  loadWeekData(weekId, () => {
    const loadedSpots = (window.RESTAURANTS || []).filter(r => r.weekId === weekId);
    populateLandingCarousel(loadedSpots, weekId);
  });
}

function populateLandingCarousel(spots, weekId) {
  const track = document.getElementById('landing-carousel-track');
  const dotsContainer = document.getElementById('landing-carousel-dots');
  if (!track || !dotsContainer) return;

  if (!spots || spots.length === 0) {
    track.innerHTML = `<div class="landing-carousel-empty">Specials coming soon!</div>`;
    dotsContainer.innerHTML = '';
    return;
  }

  // Pick up to 8 randomized spots
  const shuffled = [...spots].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 8);

  track.innerHTML = selected.map(r => {
    const thumb = r.image
      ? `<div class="card-emoji card-thumb"><img src="${esc(r.image)}" alt="Photo of ${esc(r.dish)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
      : `<div class="card-emoji">${esc(r.emoji || '🍽️')}</div>`;

    const locationText = r.neighborhood || r.address || '';
    const descText = r.desc || r.whatsOnIt || '';

    return `
      <div class="landing-carousel-slide">
        <a href="?week=${weekId}&dish=${r.id}" class="dish-card landing-spot-card" onclick="event.preventDefault(); App.switchWeek('${weekId}'); setTimeout(() => App.openDetail(${r.id}), 500);">
          <div class="landing-spot-media">
            ${thumb}
          </div>
          <div class="card-body">
            <div class="card-dish">${esc(r.dish)}</div>
            <div class="card-restaurant">${esc(r.restaurant)}</div>
            ${locationText ? `<div class="card-neighborhood">📍 ${esc(locationText)}</div>` : ''}
            ${descText ? `<div class="card-desc">${esc(descText)}</div>` : ''}
          </div>
        </a>
      </div>
    `;
  }).join('');

  dotsContainer.innerHTML = selected.map((_, idx) => `
    <button type="button" class="landing-carousel-dot ${idx === 0 ? 'active' : ''}" onclick="App.setLandingCarouselIndex(${idx})" aria-label="Go to special ${idx + 1}"></button>
  `).join('');

  initLandingCarousel(selected, weekId);
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
      renderBrowse();
      renderFilters();
    }, 150);
    searchInput.addEventListener('input', e => {
      searchClearBtn.style.display = e.target.value ? 'flex' : 'none';
      debouncedSearch(e);
    });
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
      renderSaved();
    }, 150);
    savedSearchInput.addEventListener('input', e => {
      savedSearchClearBtn.style.display = e.target.value ? 'flex' : 'none';
      debouncedSavedSearch(e);
    });
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
      renderMap();
    }, 150);
    mapSearchInput.addEventListener('input', e => {
      mapSearchClearBtn.style.display = e.target.value ? 'flex' : 'none';
      debouncedMapSearch(e);
    });
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
  setupMobileScrollListener();
  renderWeekSwitchers();

  // Background SWR check for newly published food weeks
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkMetadataUpdate();
    }
  });
  window.addEventListener('focus', () => {
    checkMetadataUpdate();
  });
  checkMetadataUpdate();

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
  toggleSavedCrawlMode,
  handleCrawlCardClick,
  handleMapPlanCrawlClick,
  openCrawlOptionsModal,
  closeCrawlOptionsModal,
  startMapPinCrawlMode,
  openSavedCrawlPicker,
  closeSavedPickerModal,
  toggleSavedPickerItem,
  selectAllSavedForCrawl,
  clearAllSavedFromCrawl,
  submitSavedPickerForCrawl,
  openCrawlItineraryModal,
  closeCrawlItineraryModal,
  moveCrawlItem,
  removeCrawlItem,
  optimizeCurrentCrawl,
  viewCrawlOnMap,
  renderBrowse,
  renderSaved,
  renderFilters,
  renderSavedFilters,
  renderFriends,
  renderAll,
  renderWeekSwitchers,
  setupSavedDragEvents,
  getActiveFriends,
  hideCompactDropdowns,
  checkMetadataUpdate,
  moveLandingCarousel,
  setLandingCarouselIndex,
  startLandingCarouselTimer,
  stopLandingCarouselTimer
};

window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}
