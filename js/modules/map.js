/* ── Leaflet Map Module ── */
import { State } from './state.js';
import { esc, showToast } from './utils.js';
import { getRestaurants } from './data.js';
import { openDetail } from './ui.js';

let leafletMap = null;
let leafletMarkers = null;
let markerClusterGroup = null;
let selectedMapId = null;

export function pinIcon(isSaved, isSelected, isCrawlSelected = false, isCrawlActive = false) {
  const cls = ['pdx-pin', isSaved ? 'saved' : '', isSelected ? 'selected' : '', isCrawlSelected ? 'crawl-selected' : '', (isCrawlActive && !isCrawlSelected) ? 'crawl-unselected' : '']
    .filter(Boolean).join(' ');
  const size = (isSaved || isCrawlSelected) ? 22 : 18;
  return L.divIcon({
    className: '',
    html: `<div class="${cls}">
             ${isCrawlSelected ? '<span class="material-symbols-outlined" style="color:white; font-size:14px; line-height:22px; display:block; text-align:center;">check</span>' : ''}
           </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function renderMap() {
  const host = document.getElementById('map-canvas');
  if (typeof L === 'undefined') {
    host.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:16px">🗺️</div>
        Map couldn't load — check your connection or a blocker extension.
      </div>`;
    return;
  }
  const allRestaurants = getRestaurants();
  const query = (State.mapSearchQuery || '').trim().toLowerCase();
  const matchedRestaurants = query ? allRestaurants.filter(r => {
    return (r.dish || '').toLowerCase().includes(query) ||
           (r.restaurant || '').toLowerCase().includes(query) ||
           (r.neighborhood || '').toLowerCase().includes(query) ||
           (r.address || '').toLowerCase().includes(query) ||
           (r.desc || '').toLowerCase().includes(query);
  }) : allRestaurants;
  const points = matchedRestaurants.filter(r => isFinite(r.lat) && isFinite(r.lng));

  const statsRow = document.getElementById('map-stats-row');
  const statCount = document.getElementById('map-stat-count');
  if (statsRow && statCount) {
    if (query) {
      statsRow.style.display = 'flex';
      statCount.textContent = points.length;
    } else {
      statsRow.style.display = 'none';
    }
  }

  if (!leafletMap) {
    leafletMap = L.map(host, {
      zoomControl: true,
      scrollWheelZoom: true,
      tap: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(leafletMap);

    leafletMarkers = new Map();
    markerClusterGroup = L.markerClusterGroup({
      disableClusteringAtZoom: 16,
      maxClusterRadius: 40
    });
    leafletMap.addLayer(markerClusterGroup);

    leafletMap.on('popupopen', e => {
      const link = e.popup.getElement().querySelector('a[data-popup-id]');
      if (link) link.addEventListener('click', ev => {
        ev.preventDefault();
        openDetail(parseInt(link.dataset.popupId, 10));
      });
    });
    
    leafletMap.setView([45.523064, -122.676483], 12);
  }

  if (markerClusterGroup) {
    markerClusterGroup.clearLayers();
  }
  leafletMarkers = new Map();

  if (points.length > 0) {
    for (const r of points) {
      const isCrawlSelected = State.crawlSelection.includes(r.id);
      const m = L.marker([r.lat, r.lng], {
        icon: pinIcon(State.saved.has(r.id), r.id === selectedMapId, isCrawlSelected, State.crawlModeActive),
        title: `${r.dish} — ${r.restaurant}`,
        riseOnHover: true,
      });
      
      let popupHtml = `<div class="popup-dish">${esc(r.dish)}</div><div class="popup-restaurant">${esc(r.restaurant)}</div>`;
      
      if (State.crawlModeActive) {
        popupHtml += `<div style="margin-top: 10px; text-align: center;">
          <button class="btn btn-primary" onclick="App.handleCrawlPinClick(${r.id})" style="padding: 6px 12px; font-size: 13px; margin-bottom: 0; width: 100%;">
            ${isCrawlSelected ? 'Remove from Crawl' : 'Add to Crawl'}
          </button>
        </div>`;
      }
      
      m.bindPopup(popupHtml);
      
      m.on('click', () => {
        if (!State.crawlModeActive) {
          showMapSelected(r);
        }
      });
      leafletMarkers.set(r.id, m);
      markerClusterGroup.addLayer(m);
    }

    if (query) {
      try {
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
        if (bounds.isValid()) {
          leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
      } catch (e) {}
    }
  }
}

export function handleCrawlPinClick(id) {
  const idx = State.crawlSelection.indexOf(id);
  if (idx > -1) {
    State.crawlSelection.splice(idx, 1);
  } else {
    if (State.crawlSelection.length >= 8) {
      showToast('Max 8 spots for an itinerary');
      return;
    }
    State.crawlSelection.push(id);
  }
  if (window.App && window.App.updateCrawlFab) window.App.updateCrawlFab();
  renderMap();
  
  if (window.innerWidth >= 1024 || document.getElementById('detail-overlay').classList.contains('open')) {
    if (window.App && window.App.generateCrawlItinerary) window.App.generateCrawlItinerary();
  }
}

export function refreshMapLayout() {
  if (leafletMap) leafletMap.invalidateSize();
}

export function showMapSelected(r) {
  selectedMapId = r.id;
  if (leafletMarkers) {
    for (const [id, m] of leafletMarkers) {
      m.setIcon(pinIcon(State.saved.has(id), id === r.id));
    }
  }
  
  openDetail(r.id);
  leafletMap.panTo([r.lat, r.lng], { animate: true });
}
