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

export function getDishKey(id, weekId = State.currentWeekId) {
  if (id == null) return '';
  const strId = String(id);
  if (strId.includes('_')) return strId;
  return weekId ? `${weekId}_${strId}` : strId;
}

export function isDishSaved(id, weekId = State.currentWeekId) {
  if (id == null) return false;
  const key = getDishKey(id, weekId);
  return State.saved.has(key) || State.saved.has(id) || State.saved.has(Number(id));
}

export function toggleDishSaved(id, weekId = State.currentWeekId) {
  const key = getDishKey(id, weekId);
  const currentlySaved = isDishSaved(id, weekId);
  if (currentlySaved) {
    State.saved.delete(key);
    State.saved.delete(id);
    State.saved.delete(Number(id));
    State.customSavedOrder = State.customSavedOrder.filter(x => x !== key && x !== id && x !== Number(id));
  } else {
    State.saved.add(key);
    if (!State.customSavedOrder.includes(key)) {
      State.customSavedOrder.push(key);
    }
  }
  saveState();
  return !currentlySaved;
}

export function isDishPassed(id, weekId = State.currentWeekId) {
  if (id == null) return false;
  const key = getDishKey(id, weekId);
  return State.passed.has(key) || State.passed.has(id) || State.passed.has(Number(id));
}

export function passDish(id, weekId = State.currentWeekId) {
  const key = getDishKey(id, weekId);
  State.passed.add(key);
  State.saved.delete(key);
  State.saved.delete(id);
  State.saved.delete(Number(id));
  State.customSavedOrder = State.customSavedOrder.filter(x => x !== key && x !== id && x !== Number(id));
  saveState();
}

export function unpassDish(id, weekId = State.currentWeekId) {
  const key = getDishKey(id, weekId);
  State.passed.delete(key);
  State.passed.delete(id);
  State.passed.delete(Number(id));
  saveState();
}

export function migrateWeekSavedState(weekId) {
  if (!weekId) return;
  const restaurants = (window.RESTAURANTS || []).filter(r => r.weekId === weekId);
  let changed = false;
  for (const r of restaurants) {
    const key = `${weekId}_${r.id}`;
    if (State.saved.has(r.id) || State.saved.has(Number(r.id))) {
      State.saved.delete(r.id);
      State.saved.delete(Number(r.id));
      State.saved.add(key);
      changed = true;
    }
    if (State.passed.has(r.id) || State.passed.has(Number(r.id))) {
      State.passed.delete(r.id);
      State.passed.delete(Number(r.id));
      State.passed.add(key);
      changed = true;
    }
    if (State.notes && State.notes[r.id] && !State.notes[key]) {
      State.notes[key] = State.notes[r.id];
      delete State.notes[r.id];
      changed = true;
    }
  }
  if (changed) {
    saveState();
  }
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
