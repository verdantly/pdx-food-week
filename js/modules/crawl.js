/* ── Crawl Builder Module ── */
import { State, isDishSaved } from './state.js';
import { esc, haversineDistance, showToast } from './utils.js';
import { getRestaurants } from './data.js';
import { closeDetail } from './ui.js';
import { renderMap } from './map.js';
import { renderSaved } from './render.js';

export function toggleCrawlMode() {
  State.crawlModeActive = !State.crawlModeActive;
  if (!State.crawlModeActive) {
    closeDetail();
    closeCrawlItineraryModal();
    closeSavedPickerModal();
    closeCrawlOptionsModal();
  }
  const fab = document.getElementById('crawl-fab');
  if (fab) {
    const isMapOrSaved = State.activeTab === 'map' || State.activeTab === 'saved';
    fab.style.display = (State.crawlModeActive && isMapOrSaved) ? 'block' : 'none';
  }
  
  syncCrawlButtons();
  updateCrawlFab();
  renderMap();
  if (State.activeTab === 'saved') {
    renderSaved();
  }
}

export function syncCrawlButtons() {
  const mapBtn = document.getElementById('map-plan-crawl-btn');
  if (mapBtn) {
    if (State.crawlModeActive) {
      mapBtn.style.background = 'white';
      mapBtn.style.color = 'var(--teal)';
      mapBtn.style.border = '2px solid var(--teal)';
      mapBtn.textContent = 'Cancel Crawl';
    } else {
      mapBtn.style.background = 'var(--teal)';
      mapBtn.style.color = 'white';
      mapBtn.style.border = '2px solid var(--teal)';
      mapBtn.textContent = 'Plan Crawl';
    }
  }

  const savedBtn = document.getElementById('saved-plan-crawl-btn');
  if (savedBtn) {
    if (State.crawlModeActive) {
      savedBtn.style.background = 'white';
      savedBtn.style.color = 'var(--teal)';
      savedBtn.style.border = '2px solid var(--teal)';
      savedBtn.textContent = 'Cancel Crawl';
    } else {
      savedBtn.style.background = 'var(--teal)';
      savedBtn.style.color = 'white';
      savedBtn.style.border = '2px solid var(--teal)';
      savedBtn.textContent = 'Plan Crawl';
    }
  }
}

export function toggleSavedCrawlMode() {
  toggleCrawlMode();
  if (State.crawlModeActive) {
    showToast('Tap up to 8 saved spots to build your crawl');
  }
}

export function handleCrawlCardClick(id) {
  const index = State.crawlSelection.indexOf(id);
  if (index > -1) {
    State.crawlSelection.splice(index, 1);
  } else {
    if (State.crawlSelection.length >= 8) {
      showToast('Maximum 8 stops reached for a crawl');
      return;
    }
    State.crawlSelection.push(id);
  }
  updateCrawlFab();
  renderSaved();
  if (State.crawlSelection.length >= 2) {
    const routeBtn = document.getElementById('crawl-generate-btn');
    if (routeBtn) routeBtn.disabled = false;
  }
}

export function handleMapPlanCrawlClick() {
  if (State.crawlModeActive) {
    toggleCrawlMode();
    return;
  }

  const savedSpots = getSavedRestaurants();
  if (savedSpots.length > 0) {
    openCrawlOptionsModal();
  } else {
    startMapPinCrawlMode();
  }
}

export function openCrawlOptionsModal() {
  const modal = document.getElementById('crawl-options-modal');
  if (!modal) return;
  const count = getSavedRestaurants().length;
  const sub = document.getElementById('crawl-opt-saved-sub');
  if (sub) {
    sub.textContent = `${count} saved spot${count === 1 ? '' : 's'} available`;
  }
  modal.style.display = 'flex';
  modal.classList.add('open');
}

export function closeCrawlOptionsModal() {
  const modal = document.getElementById('crawl-options-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

export function startMapPinCrawlMode() {
  closeCrawlOptionsModal();
  if (!State.crawlModeActive) {
    toggleCrawlMode();
  }
  showToast('Tap pins on the map to add stops to your crawl');
}

export function getSavedRestaurants() {
  const friendIds = State.viewingFriendIndex !== null && State.friends[State.viewingFriendIndex]
    ? new Set(State.friends[State.viewingFriendIndex].ids)
    : null;

  return getRestaurants().filter(r => {
    if (friendIds) {
      return friendIds.has(r.id) || friendIds.has(String(r.id)) || friendIds.has(Number(r.id));
    }
    return isDishSaved(r.id, r.weekId);
  });
}

export function openSavedCrawlPicker() {
  closeCrawlOptionsModal();
  const modal = document.getElementById('crawl-saved-picker-modal');
  if (!modal) return;

  renderSavedPickerList();
  modal.style.display = 'flex';
  modal.classList.add('open');
}

export function closeSavedPickerModal() {
  const modal = document.getElementById('crawl-saved-picker-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

export function renderSavedPickerList() {
  const listEl = document.getElementById('crawl-saved-picker-list');
  const subtitleEl = document.getElementById('crawl-picker-subtitle');
  const submitBtn = document.getElementById('crawl-picker-submit-btn');
  if (!listEl) return;

  const savedSpots = getSavedRestaurants();
  const selCount = State.crawlSelection.length;
  if (subtitleEl) {
    subtitleEl.textContent = `Select up to 8 spots for your crawl (${selCount}/8)`;
  }
  if (submitBtn) {
    submitBtn.disabled = selCount < 2;
    submitBtn.textContent = selCount < 2 ? 'Select at least 2 spots' : `Review Crawl (${selCount} spots)`;
  }

  if (savedSpots.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--ink-60);">No saved spots for this week yet. Save dishes first to plan a crawl from your saved list.</div>`;
    return;
  }

  listEl.innerHTML = savedSpots.map(r => {
    const isChecked = State.crawlSelection.includes(r.id);
    const orderIdx = State.crawlSelection.indexOf(r.id);
    return `
      <div class="crawl-picker-row ${isChecked ? 'selected' : ''}" onclick="App.toggleSavedPickerItem(${r.id})">
        <div class="crawl-picker-checkbox ${isChecked ? 'checked' : ''}">
          ${isChecked ? (orderIdx + 1) : ''}
        </div>
        <div class="crawl-picker-details">
          <div class="crawl-picker-dish">${esc(r.dish)}</div>
          <div class="crawl-picker-restaurant">${esc(r.restaurant)} • ${esc(r.neighborhood || r.address || '')}</div>
        </div>
      </div>
    `;
  }).join('');
}

export function toggleSavedPickerItem(id) {
  const index = State.crawlSelection.indexOf(id);
  if (index > -1) {
    State.crawlSelection.splice(index, 1);
  } else {
    if (State.crawlSelection.length >= 8) {
      showToast('Maximum 8 stops reached for a crawl');
      return;
    }
    State.crawlSelection.push(id);
  }
  renderSavedPickerList();
  updateCrawlFab();
}

export function selectAllSavedForCrawl() {
  const savedSpots = getSavedRestaurants();
  const toSelect = savedSpots.slice(0, 8).map(r => r.id);
  State.crawlSelection = toSelect;
  renderSavedPickerList();
  updateCrawlFab();
}

export function clearAllSavedFromCrawl() {
  State.crawlSelection = [];
  renderSavedPickerList();
  updateCrawlFab();
}

export function submitSavedPickerForCrawl() {
  if (State.crawlSelection.length < 2) return;
  closeSavedPickerModal();
  if (!State.crawlModeActive) {
    State.crawlModeActive = true;
    syncCrawlButtons();
  }
  openCrawlItineraryModal();
}

export function clearCrawl() {
  State.crawlSelection = [];
  updateCrawlFab();
  renderMap();
  if (State.activeTab === 'saved') {
    renderSaved();
  }
}

export function updateCrawlFab() {
  const textEl = document.getElementById('crawl-fab-text');
  const routeBtn = document.getElementById('crawl-generate-btn');
  const count = State.crawlSelection.length;
  if (textEl) textEl.textContent = `Select up to 8 spots (${count}/8)`;
  if (routeBtn) {
    routeBtn.disabled = count < 2;
  }
}

export function calculateOptimizedOrder(spots) {
  if (spots.length <= 2) return [...spots];

  let bestOrder = null;
  let minDistance = Infinity;

  const permute = (arr, m = []) => {
    if (arr.length === 0) {
      let dist = 0;
      for (let i = 0; i < m.length - 1; i++) {
        dist += haversineDistance(m[i].lat, m[i].lng, m[i+1].lat, m[i+1].lng);
      }
      if (dist < minDistance) {
        minDistance = dist;
        bestOrder = [...m];
      }
    } else {
      for (let i = 0; i < arr.length; i++) {
        let curr = arr.slice();
        let next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  };

  permute(spots);
  return bestOrder || spots;
}

export function openCrawlItineraryModal(skipOptimize = false) {
  const modal = document.getElementById('crawl-itinerary-modal');
  if (!modal) return;

  const spots = State.crawlSelection.map(id => getRestaurants().find(r => r.id === id)).filter(Boolean);
  
  if (spots.length === 0) {
    showToast('Please select at least 2 spots first');
    return;
  }

  if (!skipOptimize && (!State.currentItinerary || State.currentItinerary.length !== spots.length || !State.currentItinerary.every(s => spots.some(x => x.id === s.id)))) {
    State.currentItinerary = calculateOptimizedOrder(spots);
  }

  renderCrawlItineraryModal();
  modal.style.display = 'flex';
  modal.classList.add('open');
}

export function closeCrawlItineraryModal() {
  const modal = document.getElementById('crawl-itinerary-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

export function renderCrawlItineraryModal() {
  const itinerary = State.currentItinerary || [];
  const countSub = document.getElementById('crawl-itinerary-count-sub');
  const statsEl = document.getElementById('crawl-itinerary-stats');
  const listEl = document.getElementById('crawl-sortable-list');
  const mapsBtn = document.getElementById('crawl-maps-btn');

  if (countSub) {
    countSub.textContent = `${itinerary.length} stop${itinerary.length === 1 ? '' : 's'} in crawl`;
  }

  if (mapsBtn) {
    mapsBtn.disabled = itinerary.length < 2;
  }

  let totalMiles = 0;
  for (let i = 0; i < itinerary.length - 1; i++) {
    totalMiles += haversineDistance(itinerary[i].lat, itinerary[i].lng, itinerary[i+1].lat, itinerary[i+1].lng);
  }
  totalMiles *= 1.3;
  let walkMins = Math.round((totalMiles / 3.0) * 60);
  let driveMins = Math.round((totalMiles / 15.0) * 60);

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="crawl-stat-box">
        <div class="crawl-stat-val">~${totalMiles.toFixed(1)} mi</div>
        <div class="crawl-stat-lbl">Est. Distance</div>
      </div>
      <div class="crawl-stat-box">
        <div class="crawl-stat-val">${walkMins} min</div>
        <div class="crawl-stat-lbl">Walk Time</div>
      </div>
      <div class="crawl-stat-box">
        <div class="crawl-stat-val">${driveMins} min</div>
        <div class="crawl-stat-lbl">Drive Time</div>
      </div>
    `;
  }

  if (listEl) {
    if (itinerary.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--ink-60);">No spots selected.</div>`;
      return;
    }

    listEl.innerHTML = itinerary.map((r, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === itinerary.length - 1;
      return `
        <div class="crawl-sortable-item" data-id="${r.id}">
          <div class="crawl-drag-handle" aria-label="Drag to reorder">
            <span class="material-symbols-outlined" style="font-size: 20px;">drag_indicator</span>
          </div>
          <div class="crawl-step-num">${idx + 1}</div>
          <div class="crawl-sortable-details">
            <div class="crawl-sortable-dish">${esc(r.dish)}</div>
            <div class="crawl-sortable-meta">${esc(r.restaurant)} • ${esc(r.neighborhood || r.address || '')}</div>
          </div>
          <div class="crawl-sortable-actions">
            <button class="btn-crawl-arrow" onclick="App.moveCrawlItem(${idx}, -1)" aria-label="Move up" ${isFirst ? 'disabled' : ''}>
              ▲
            </button>
            <button class="btn-crawl-arrow" onclick="App.moveCrawlItem(${idx}, 1)" aria-label="Move down" ${isLast ? 'disabled' : ''}>
              ▼
            </button>
            <button class="btn-crawl-remove" onclick="App.removeCrawlItem(${r.id})" aria-label="Remove stop">
              <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.Sortable) {
      if (listEl._sortable) {
        listEl._sortable.destroy();
      }
      listEl._sortable = Sortable.create(listEl, {
        animation: 150,
        handle: '.crawl-drag-handle',
        onEnd: function(evt) {
          const item = State.currentItinerary.splice(evt.oldIndex, 1)[0];
          State.currentItinerary.splice(evt.newIndex, 0, item);
          State.crawlSelection = State.currentItinerary.map(r => r.id);
          renderCrawlItineraryModal();
          updateCrawlFab();
          renderMap();
          if (State.activeTab === 'saved') renderSaved();
        }
      });
    }
  }
}

export function moveCrawlItem(index, direction) {
  const newIndex = index + direction;
  if (!State.currentItinerary || newIndex < 0 || newIndex >= State.currentItinerary.length) return;

  const item = State.currentItinerary.splice(index, 1)[0];
  State.currentItinerary.splice(newIndex, 0, item);
  State.crawlSelection = State.currentItinerary.map(r => r.id);

  renderCrawlItineraryModal();
  updateCrawlFab();
  renderMap();
  if (State.activeTab === 'saved') renderSaved();
}

export function removeCrawlItem(id) {
  State.crawlSelection = State.crawlSelection.filter(x => x !== id);
  if (State.currentItinerary) {
    State.currentItinerary = State.currentItinerary.filter(r => r.id !== id);
  }
  renderCrawlItineraryModal();
  updateCrawlFab();
  renderMap();
  if (State.activeTab === 'saved') renderSaved();
}

export function optimizeCurrentCrawl() {
  if (!State.currentItinerary || State.currentItinerary.length < 3) {
    showToast('Already optimal');
    return;
  }
  State.currentItinerary = calculateOptimizedOrder(State.currentItinerary);
  State.crawlSelection = State.currentItinerary.map(r => r.id);
  renderCrawlItineraryModal();
  renderMap();
  if (State.activeTab === 'saved') renderSaved();
  showToast('Stops reordered by shortest walking distance');
}

export function viewCrawlOnMap() {
  closeCrawlItineraryModal();
  if (window.App && window.App.switchTab) {
    window.App.switchTab('map');
  }
  renderMap();
}

export function generateCrawlItinerary() {
  openCrawlItineraryModal();
}

export function renderItinerarySheet() {
  // Backwards compatibility if called
  openCrawlItineraryModal();
}

export function openCrawlMapsUrl() {
  const itinerary = State.currentItinerary || [];
  if (itinerary.length < 2) return;
  const origin = itinerary[0];
  const dest = itinerary[itinerary.length - 1];
  let waypoints = '';
  if (itinerary.length > 2) {
    waypoints = '&waypoints=' + itinerary.slice(1, -1).map(r => `${r.lat},${r.lng}`).join('|');
  }
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}${waypoints}&travelmode=walking`;
  window.open(mapsUrl, '_blank');
}

export function closeCrawlModal(e) {
  if (e) e.preventDefault();
  closeCrawlItineraryModal();
}
