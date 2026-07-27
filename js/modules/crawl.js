/* ── Crawl Builder Module ── */
import { State } from './state.js';
import { esc, haversineDistance } from './utils.js';
import { getRestaurants } from './data.js';
import { closeDetail } from './ui.js';
import { renderMap } from './map.js';

export function toggleCrawlMode() {
  State.crawlModeActive = !State.crawlModeActive;
  if (!State.crawlModeActive) {
    closeDetail();
  }
  const fab = document.getElementById('crawl-fab');
  if (fab) fab.style.display = State.crawlModeActive ? 'block' : 'none';
  
  const btn = document.getElementById('map-plan-crawl-btn');
  if (btn) {
    if (State.crawlModeActive) {
      btn.style.background = 'white';
      btn.style.color = 'var(--teal)';
      btn.style.border = '2px solid var(--teal)';
      btn.textContent = 'Cancel Crawl';
    } else {
      btn.style.background = 'var(--teal)';
      btn.style.color = 'white';
      btn.style.border = '2px solid var(--teal)';
      btn.textContent = 'Plan Crawl';
    }
  }
  
  updateCrawlFab();
  renderMap();
  if (State.crawlModeActive && window.innerWidth >= 1024) {
    generateCrawlItinerary();
  }
}

export function clearCrawl() {
  State.crawlSelection = [];
  updateCrawlFab();
  renderMap();
  if (State.crawlModeActive && window.innerWidth >= 1024) {
    generateCrawlItinerary();
  }
}

export function updateCrawlFab() {
  const textEl = document.getElementById('crawl-fab-text');
  const routeBtn = document.getElementById('crawl-generate-btn');
  if (textEl) textEl.textContent = `Select up to 8 spots (${State.crawlSelection.length}/8)`;
  if (routeBtn) routeBtn.disabled = State.crawlSelection.length < 2;
}

export function generateCrawlItinerary() {
  const spots = State.crawlSelection.map(id => getRestaurants().find(r => r.id === id)).filter(Boolean);
  
  if (spots.length < 2) {
    State.currentItinerary = spots;
    renderItinerarySheet();
    document.getElementById('detail-overlay').classList.add('open');
    document.getElementById('app').classList.add('detail-open');
    return;
  }

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
  State.currentItinerary = bestOrder;
  
  renderItinerarySheet();
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('app').classList.add('detail-open');
}

export function renderItinerarySheet() {
  const sheetEl = document.getElementById('detail-sheet-content');
  if (!sheetEl) return;
  
  const itinerary = State.currentItinerary || [];
  let totalMiles = 0;
  for (let i = 0; i < itinerary.length - 1; i++) {
    totalMiles += haversineDistance(itinerary[i].lat, itinerary[i].lng, itinerary[i+1].lat, itinerary[i+1].lng);
  }
  totalMiles *= 1.3;
  let walkMins = Math.round((totalMiles / 3.0) * 60);
  let driveMins = Math.round((totalMiles / 15.0) * 60);

  let html = `
    <button class="sheet-close-btn" onclick="App.closeDetail()" aria-label="Close detail view" style="top: 24px;">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <div class="sheet-handle"></div>
    <div class="sheet-dish" style="margin-top: 32px; margin-bottom: 4px;">Your Food Crawl</div>
  `;
  
  if (itinerary.length === 0) {
    html += `<div style="font-size: 14px; color: var(--ink-80); margin-bottom: 16px;">
      Tap on map pins to start building your itinerary.
    </div>`;
  } else {
    html += `<div style="font-size: 14px; color: var(--ink-80); margin-bottom: 16px;">
      <strong>Distance:</strong> ~${totalMiles.toFixed(1)} miles<br>
      <strong>Walk:</strong> ${walkMins} mins • <strong>Drive:</strong> ${driveMins} mins
    </div>
    <div id="itinerary-sortable-list" class="crawl-steps" style="margin-bottom: 24px;">`;

    itinerary.forEach((r, idx) => {
      html += `<div class="crawl-step" data-id="${r.id}" style="cursor: grab; display: flex; align-items: center; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 8px; box-shadow: var(--shadow);">
        <div style="margin-right: 12px; color: var(--ink-30);">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </div>
        <div class="crawl-step-num" style="margin-right: 12px;">${idx + 1}</div>
        <div class="crawl-step-details" style="flex: 1;">
          <div class="crawl-step-title" style="font-weight: 700; font-family: var(--font-display);">${esc(r.dish)}</div>
          <div class="crawl-step-meta" style="font-size: 12px; color: var(--ink-60);">${esc(r.restaurant)}</div>
        </div>
      </div>`;
    });

    html += `</div>
      <button class="btn btn-primary" onclick="App.openCrawlMapsUrl()" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 24px; padding: 12px; border-radius: 24px;" ${itinerary.length < 2 ? 'disabled' : ''}>
        <span style="font-size:18px;">Open in Google Maps</span>
      </button>
    `;
  }

  sheetEl.innerHTML = html;

  const listEl = document.getElementById('itinerary-sortable-list');
  if (listEl && window.Sortable) {
    Sortable.create(listEl, {
      animation: 150,
      handle: '.crawl-step',
      onEnd: function(evt) {
        const item = State.currentItinerary.splice(evt.oldIndex, 1)[0];
        State.currentItinerary.splice(evt.newIndex, 0, item);
        renderItinerarySheet();
      }
    });
  }
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
  closeDetail();
}
