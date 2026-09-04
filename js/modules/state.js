/* ── Centralized App State ── */

export const State = {
  activeTab: 'browse',
  activeFilters: new Set(),
  draftFilters: new Set(),
  activeSort: 'restaurant',
  searchQuery: '',
  activeSavedFilters: new Set(),
  draftSavedFilters: new Set(),
  savedSearchQuery: '',
  mapSearchQuery: '',
  activeSavedSort: 'restaurant',
  customSavedOrder: [],
  filterDrawerOpen: false,
  saved: new Set(),
  passed: new Set(),
  loadedWeeks: new Set(),
  crawlModeActive: false,
  crawlSelection: [],
  friends: [],
  viewedNew: new Set(),
  notes: {},
  selectedDish: null,
  currentWeekId: null,
  weekFilters: {},
  swipeQueue: null,
  swipeIdx: 0,
  swipeAnimating: false,
  userLat: null,
  userLng: null,
  lastActiveElement: null,
  viewingFriendIndex: null,
  lastScrollTop: 0
};

export function getWeekFile(weekId) {
  if (typeof window !== 'undefined' && typeof window.getWeekFile === 'function') {
    return window.getWeekFile(weekId);
  }
  const week = (typeof window !== 'undefined' && window.FOOD_WEEKS ? window.FOOD_WEEKS : []).find(w => w.id === weekId);
  return week ? week.dataFile : undefined;
}

export function getWeekFilters(weekId) {
  if (typeof window !== 'undefined' && typeof window.getWeekFilters === 'function') {
    return window.getWeekFilters(weekId);
  }
  const week = (typeof window !== 'undefined' && window.FOOD_WEEKS ? window.FOOD_WEEKS : []).find(w => w.id === weekId);
  return week && week.filters ? week.filters : [];
}

// Backwards-compatibility proxies for any consumers expecting object maps
export const WEEK_FILE_MAP = new Proxy({}, {
  get(_, prop) {
    if (typeof prop === 'string') {
      return getWeekFile(prop);
    }
    return undefined;
  },
  has(_, prop) {
    return Boolean(getWeekFile(prop));
  },
  ownKeys(_) {
    const list = typeof window !== 'undefined' && window.FOOD_WEEKS ? window.FOOD_WEEKS : [];
    return list.map(w => w.id);
  },
  getOwnPropertyDescriptor(_, prop) {
    return {
      value: getWeekFile(prop),
      writable: false,
      enumerable: true,
      configurable: true
    };
  }
});

export const WEEK_FILTERS = new Proxy({}, {
  get(_, prop) {
    if (typeof prop === 'string') {
      return getWeekFilters(prop);
    }
    return [];
  },
  has(_, prop) {
    return Boolean(getWeekFile(prop));
  },
  ownKeys(_) {
    const list = typeof window !== 'undefined' && window.FOOD_WEEKS ? window.FOOD_WEEKS : [];
    return list.map(w => w.id);
  },
  getOwnPropertyDescriptor(_, prop) {
    return {
      value: getWeekFilters(prop),
      writable: false,
      enumerable: true,
      configurable: true
    };
  }
});

const STORAGE_KEY_SAVED = 'pdxfw_saved_v1';
const STORAGE_KEY_PASSED = 'pdxfw_passed_v1';
const STORAGE_KEY_FRIENDS = 'pdxfw_friends_v1';
const STORAGE_KEY_WEEK = 'pdxfw_current_week_v1';
const STORAGE_KEY_NOTES = 'pdxfw_notes_v1';
const STORAGE_KEY_VIEWED_NEW = 'pdxfw_viewed_new_v1';
const STORAGE_KEY_SAVED_SORT = 'pdxfw_saved_sort_v1';
const STORAGE_KEY_CUSTOM_ORDER = 'pdxfw_custom_order_v1';
const STORAGE_KEY_WEEK_FILTERS = 'pdxfw_week_filters_v1';
const STORAGE_KEY_VISITED = 'pdxfw_visited_v1';

export function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY_SAVED);
    if (s) State.saved = new Set(JSON.parse(s));
    const p = localStorage.getItem(STORAGE_KEY_PASSED);
    if (p) State.passed = new Set(JSON.parse(p));
    const f = localStorage.getItem(STORAGE_KEY_FRIENDS);
    if (f) State.friends = JSON.parse(f);
    const w = localStorage.getItem(STORAGE_KEY_WEEK);
    if (w) State.currentWeekId = w;
    const n = localStorage.getItem(STORAGE_KEY_NOTES);
    if (n) State.notes = JSON.parse(n);
    const vn = localStorage.getItem(STORAGE_KEY_VIEWED_NEW);
    if (vn) State.viewedNew = new Set(JSON.parse(vn));
    const ss = localStorage.getItem(STORAGE_KEY_SAVED_SORT);
    if (ss) State.activeSavedSort = ss;
    const wf = localStorage.getItem(STORAGE_KEY_WEEK_FILTERS);
    if (wf) State.weekFilters = JSON.parse(wf);
    const co = localStorage.getItem(STORAGE_KEY_CUSTOM_ORDER);
    if (co) {
      State.customSavedOrder = JSON.parse(co);
    } else {
      State.customSavedOrder = [...State.saved];
    }
    // Keep customSavedOrder in sync with saved items
    for (const id of State.saved) {
      if (!State.customSavedOrder.includes(id)) {
        State.customSavedOrder.push(id);
      }
    }
    State.customSavedOrder = State.customSavedOrder.filter(id => State.saved.has(id));

    localStorage.removeItem(STORAGE_KEY_VISITED); // Clean up legacy global visited key
  } catch (e) { }
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...State.saved]));
    localStorage.setItem(STORAGE_KEY_PASSED, JSON.stringify([...State.passed]));
    localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(State.friends));
    localStorage.setItem(STORAGE_KEY_WEEK, State.currentWeekId);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(State.notes));
    localStorage.setItem(STORAGE_KEY_VIEWED_NEW, JSON.stringify([...State.viewedNew]));
    localStorage.setItem(STORAGE_KEY_SAVED_SORT, State.activeSavedSort);
    localStorage.setItem(STORAGE_KEY_CUSTOM_ORDER, JSON.stringify(State.customSavedOrder));
    localStorage.setItem(STORAGE_KEY_WEEK_FILTERS, JSON.stringify(State.weekFilters));
  } catch (e) { }
}

export function checkWeekVisited(weekId) {
  if (!weekId) return;
  const visitedKey = 'pdxfw_visited_v1_' + weekId;
  if (!localStorage.getItem(visitedKey)) {
    const activeRestaurants = (window.RESTAURANTS || []).filter(r => r.weekId === weekId);
    activeRestaurants.filter(r => r.isNew).forEach(r => State.viewedNew.add(r.id));
    localStorage.setItem(visitedKey, 'true');
    saveState();
  }
}
