/* ── Card HTML Generation ── */
import { State, isDishSaved } from './state.js';
import { esc, highlightMatch, haversineDistance } from './utils.js';
import { isVeganFriendly, isVegetarianFriendly } from './data.js';

export function hasVeganOptionInDesc(r) {
  if (r.veganOption) return true;
  const txt = `${r.dish} ${r.desc}`.toLowerCase();
  return txt.includes('vegan option') ||
    txt.includes('can be made vegan') ||
    txt.includes('vegan available');
}

export function buildTags(r) {
  const weekMeta = typeof window !== 'undefined' && typeof window.getWeekMeta === 'function'
    ? window.getWeekMeta(State.currentWeekId)
    : null;

  if (weekMeta && weekMeta.hideTags) {
    return '';
  }

  const t = [];

  // Meat / Vegetarian / Vegan badges
  if (r.type === 'meat') {
    t.push('<span class="tag tag-meat">Meat</span>');
    if (isVeganFriendly(r)) {
      t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
    } else if (isVegetarianFriendly(r)) {
      t.push('<span class="tag tag-veg" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Veg option</span>');
    }
  } else if (r.type === 'vegetarian') {
    t.push('<span class="tag tag-veg">Vegetarian</span>');
    if (isVeganFriendly(r)) {
      t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
    }
  } else if (r.type === 'vegan') {
    if (hasVeganOptionInDesc(r)) {
      t.push('<span class="tag tag-vegan" style="border: 1px dashed currentColor; background: transparent; font-weight: 500;">Vegan option</span>');
    } else {
      t.push('<span class="tag tag-vegan">Vegan</span>');
    }
  }

  // Gluten-free
  if (r.glutenFree) {
    t.push('<span class="tag tag-gf">GF available</span>');
  }

  // Spicy
  if (r.spicy) {
    t.push('<span class="tag tag-spicy" style="background:#FAE8E0;color:#8B3015;">🌶️ Spicy</span>');
  }

  // Pizza-specific slices/pies if applicable
  if (r.wholePie !== undefined) {
    if (r.wholePie) t.push('<span class="tag tag-pie">Whole pie $25</span>');
    else t.push('<span class="tag tag-slice">By the slice</span>');
  }

  return t.join('');
}

export function cardHTML(r, overlap, isSavedTab = false, index = -1, totalCount = -1) {
  const isSaved = isDishSaved(r.id, r.weekId);
  const isSelected = State.crawlSelection.includes(r.id);
  let cls = ['dish-card', isSaved ? 'bookmarked' : '', overlap ? 'overlap-card' : ''].filter(Boolean).join(' ');
  if (State.crawlModeActive && isSavedTab && isSelected) cls += ' crawl-selected';
  const q = isSavedTab ? State.savedSearchQuery : State.searchQuery;
  const thumb = r.image
    ? `<div class="card-emoji card-thumb"><img src="${esc(r.image)}" alt="Photo of ${esc(r.dish)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
    : `<div class="card-emoji">${esc(r.emoji)}</div>`;

  const sortType = isSavedTab ? State.activeSavedSort : State.activeSort;
  const dist = (sortType === 'distance' && State.userLat !== null && State.userLng !== null)
    ? ` <span style="font-size: 13px; font-weight: normal; color: var(--ink-60);">(${haversineDistance(State.userLat, State.userLng, r.lat, r.lng).toFixed(1)} mi)</span>`
    : '';

  const isNew = r.isNew && !State.viewedNew.has(r.id);

  let dragHandleHtml = '';
  if (isSavedTab && State.activeSavedSort === 'custom') {
    const isFirst = index === 0;
    const isLast = index === totalCount - 1;
    dragHandleHtml = `
      <div class="drag-reorder-buttons" style="display: flex; flex-direction: column; gap: 2px; margin-right: 8px;" onclick="event.stopPropagation();">
        <button class="reorder-btn reorder-up" onclick="event.stopPropagation(); App.moveSavedItem(${r.id}, -1)" aria-label="Move up" ${isFirst ? 'disabled' : ''}>
          ▲
        </button>
        <button class="reorder-btn reorder-down" onclick="event.stopPropagation(); App.moveSavedItem(${r.id}, 1)" aria-label="Move down" ${isLast ? 'disabled' : ''}>
          ▼
        </button>
      </div>
    `;
  }

  const weekMeta = typeof window !== 'undefined' && typeof window.getWeekMeta === 'function'
    ? window.getWeekMeta(State.currentWeekId)
    : null;
  const locationText = (weekMeta && weekMeta.preferStreetAddress) ? r.address : (r.neighborhood || r.address);

  return `
    <div class="${cls}" data-id="${r.id}" onclick="App.openDetail(${r.id})" ${isSavedTab && State.activeSavedSort === 'custom' ? 'draggable="true"' : ''}>
      ${dragHandleHtml}
      ${thumb}
      <div class="card-body">
        <div class="card-dish">${highlightMatch(r.dish, q)}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
        <div class="card-restaurant">${highlightMatch(r.restaurant, q)}${dist}</div>
        <div class="card-neighborhood">📍 ${highlightMatch(locationText, q)}</div>
        <div class="card-desc">${esc(r.desc)}</div>
        <div class="card-tags">${buildTags(r)}</div>
      </div>
      <button class="bookmark-btn ${isSaved ? 'saved' : ''}"
        onclick="event.stopPropagation(); App.toggleSave(${r.id})"
        aria-label="${isSaved ? 'Remove from saved' : 'Save this dish'}">
        <svg class="save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="save-text">${isSaved ? 'Saved' : 'Save'}</span>
      </button>
    </div>`;
}
