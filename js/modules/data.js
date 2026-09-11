/* ── Data Helpers & Queries ── */
import { State, isDishSaved, getDishKey } from './state.js';
import { haversineDistance } from './utils.js';

export function getRestaurants() {
  return (window.RESTAURANTS || []).filter(r => r.weekId === State.currentWeekId);
}

export function updateBrowseBadge() {
  const browseTab = document.querySelector('.nav-tab[data-tab="browse"]');
  if (!browseTab) return;
  const badge = browseTab.querySelector('.badge-dot');
  if (!badge) return;

  const banner = document.getElementById('new-listings-banner');

  if (!State.currentWeekId) {
    badge.classList.remove('show');
    if (banner) banner.style.display = 'none';
    return;
  }

  const activeWeekRestaurants = getRestaurants();
  const newItems = activeWeekRestaurants.filter(r => r.isNew);
  const unviewedNewItems = newItems.filter(r => !State.viewedNew.has(r.id));
  const hasUnviewedNew = unviewedNewItems.length > 0;

  badge.classList.toggle('show', hasUnviewedNew);

  if (banner) {
    const isDismissed = localStorage.getItem(`pdxfw_dismissed_banner_${State.currentWeekId}`) === 'true';
    if (hasUnviewedNew && !isDismissed) {
      const week = (window.FOOD_WEEKS || []).find(w => w.id === State.currentWeekId);
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

export function dismissNewBanner() {
  if (State.currentWeekId) {
    localStorage.setItem(`pdxfw_dismissed_banner_${State.currentWeekId}`, 'true');
    updateBrowseBadge();
  }
}

export function isVeganFriendly(r) {
  if (!r) return false;
  if (r.type === 'vegan' || r.veganOption) return true;
  const txt = `${r.dish || ''} ${r.desc || ''} ${r.whatsOnIt || ''} ${r.whatTheySay || ''}`.toLowerCase();
  return txt.includes('vegan option') ||
    txt.includes('can be made vegan') ||
    txt.includes('vegan available') ||
    txt.includes('optionally vegan') ||
    txt.includes('vegan version') ||
    txt.includes('request vegan');
}

export function isVegetarianFriendly(r) {
  if (!r) return false;
  if (r.type === 'vegan' || r.type === 'vegetarian' || r.vegOption) return true;
  const txt = `${r.dish || ''} ${r.desc || ''} ${r.whatsOnIt || ''} ${r.whatTheySay || ''}`.toLowerCase();
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

export function getFiltered() {
  let filtered = getRestaurants().filter(r => {
    if (State.activeFilters.has('meat') && r.type !== 'meat') return false;
    if (State.activeFilters.has('vegetarian') && !isVegetarianFriendly(r)) return false;
    if (State.activeFilters.has('vegan') && !isVeganFriendly(r)) return false;
    if (State.activeFilters.has('gf') && !r.glutenFree) return false;
    if (State.activeFilters.has('pie') && !r.wholePie) return false;
    if (State.activeFilters.has('spicy') && !r.spicy) return false;
    if (State.activeFilters.has('new') && (!r.isNew || State.viewedNew.has(r.id))) return false;
    if (State.searchQuery) {
      const q = State.searchQuery.toLowerCase();
      if (!(r.dish || '').toLowerCase().includes(q) &&
        !(r.restaurant || '').toLowerCase().includes(q) &&
        !(r.neighborhood || '').toLowerCase().includes(q) &&
        !(r.address || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (State.activeSort === 'dish') {
    filtered.sort((a, b) => (a.dish || '').localeCompare(b.dish || ''));
  } else if (State.activeSort === 'restaurant') {
    filtered.sort((a, b) => (a.restaurant || '').localeCompare(b.restaurant || ''));
  } else if (State.activeSort === 'distance' && State.userLat !== null && State.userLng !== null) {
    filtered.sort((a, b) => {
      const d1 = isFinite(a.lat) && isFinite(a.lng) ? haversineDistance(State.userLat, State.userLng, a.lat, a.lng) : Infinity;
      const d2 = isFinite(b.lat) && isFinite(b.lng) ? haversineDistance(State.userLat, State.userLng, b.lat, b.lng) : Infinity;
      return d1 - d2;
    });
  } else {
    filtered.sort((a, b) => a.id - b.id);
  }

  return filtered;
}

export function getSaved() {
  const isViewingFriend = State.viewingFriendIndex !== null && State.friends[State.viewingFriendIndex];
  const friendIds = isViewingFriend ? new Set(State.friends[State.viewingFriendIndex].ids) : null;
  let savedItems = getRestaurants().filter(r => {
    if (friendIds) {
      return friendIds.has(r.id) || friendIds.has(String(r.id)) || friendIds.has(Number(r.id));
    }
    return isDishSaved(r.id, r.weekId);
  });

  savedItems = savedItems.filter(r => {
    if (State.activeSavedFilters.has('meat') && r.type !== 'meat') return false;
    if (State.activeSavedFilters.has('vegetarian') && !isVegetarianFriendly(r)) return false;
    if (State.activeSavedFilters.has('vegan') && !isVeganFriendly(r)) return false;
    if (State.activeSavedFilters.has('gf') && !r.glutenFree) return false;
    if (State.activeSavedFilters.has('pie') && !r.wholePie) return false;
    if (State.activeSavedFilters.has('spicy') && !r.spicy) return false;
    if (State.activeSavedFilters.has('new') && (!r.isNew || State.viewedNew.has(r.id))) return false;
    if (State.savedSearchQuery) {
      const q = State.savedSearchQuery.toLowerCase();
      if (!(r.dish || '').toLowerCase().includes(q) &&
        !(r.restaurant || '').toLowerCase().includes(q) &&
        !(r.neighborhood || '').toLowerCase().includes(q) &&
        !(r.address || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (State.activeSavedSort === 'dish') {
    savedItems.sort((a, b) => (a.dish || '').localeCompare(b.dish || ''));
  } else if (State.activeSavedSort === 'restaurant') {
    savedItems.sort((a, b) => (a.restaurant || '').localeCompare(b.restaurant || ''));
  } else if (State.activeSavedSort === 'distance' && State.userLat !== null && State.userLng !== null) {
    savedItems.sort((a, b) => {
      const d1 = isFinite(a.lat) && isFinite(a.lng) ? haversineDistance(State.userLat, State.userLng, a.lat, a.lng) : Infinity;
      const d2 = isFinite(b.lat) && isFinite(b.lng) ? haversineDistance(State.userLat, State.userLng, b.lat, b.lng) : Infinity;
      return d1 - d2;
    });
  } else if (State.activeSavedSort === 'custom') {
    savedItems.sort((a, b) => {
      const keyA = getDishKey(a.id, a.weekId);
      const keyB = getDishKey(b.id, b.weekId);
      let idxA = State.customSavedOrder.indexOf(keyA);
      if (idxA === -1) idxA = State.customSavedOrder.indexOf(a.id);
      let idxB = State.customSavedOrder.indexOf(keyB);
      if (idxB === -1) idxB = State.customSavedOrder.indexOf(b.id);
      if (idxA === -1) idxA = 999999;
      if (idxB === -1) idxB = 999999;
      if (idxA === idxB) {
        return a.id - b.id;
      }
      return idxA - idxB;
    });
  } else {
    savedItems.sort((a, b) => a.id - b.id);
  }

  return savedItems;
}
