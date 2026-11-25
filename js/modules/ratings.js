/* ── Beli-Style Dish Rating & Head-to-Head Comparison Module ── */
import {
  State,
  saveState,
  getDishKey,
  normalizeRatingDishId,
  getWeekRatingsMap,
  getUserDishRating,
  getCommunityDishRating
} from './state.js';
import {
  esc,
  showToast,
  activateModalFocusTrap,
  deactivateModalFocusTrap,
  getBeliBadgeClass,
  getTierLabel,
  renderBeliBadgeHTML
} from './utils.js';
import { getRestaurants, updateBrowseBadge } from './data.js';
import { syncPublicWeekRatings } from './sync.js';
import { renderAll } from './render.js';
import { openAccountModal } from './auth.js';

export { getBeliBadgeClass, getTierLabel, renderBeliBadgeHTML };

let ratingSession = null;

export function getRatingSession() {
  return ratingSession;
}

function ensureWeekRatingBucket(weekId) {
  if (!State.ratings || typeof State.ratings !== 'object') {
    State.ratings = {};
  }
  if (!State.ratings[weekId] || typeof State.ratings[weekId] !== 'object') {
    State.ratings[weekId] = { liked: [], fine: [], disliked: [] };
  }
  ['liked', 'fine', 'disliked'].forEach(t => {
    if (!Array.isArray(State.ratings[weekId][t])) {
      State.ratings[weekId][t] = [];
    }
  });
  return State.ratings[weekId];
}

function findDishById(dishId, weekId) {
  const targetId = normalizeRatingDishId(dishId);
  const wid = weekId || State.currentWeekId;
  const list = getRestaurants() || [];
  const currentMatch = (!wid || wid === State.currentWeekId)
    ? list.find(d => normalizeRatingDishId(d.id) === targetId)
    : null;
  if (currentMatch) return currentMatch;
  if (typeof window !== 'undefined' && Array.isArray(window.RESTAURANTS)) {
    return window.RESTAURANTS.find(
      d => normalizeRatingDishId(d.id) === targetId && (!wid || d.weekId === wid)
    ) || null;
  }
  return null;
}

function refreshUiAfterRatingChange(dishId) {
  try {
    if (typeof document !== 'undefined') {
      renderAll();
      updateBrowseBadge();
      if (typeof window !== 'undefined' && window.App && typeof window.App.refreshDetailRatingUI === 'function') {
        window.App.refreshDetailRatingUI(dishId);
      }
    }
  } catch (_) {
    // Safe fallback for headless unit tests without full DOM
  }
}

function renderRatingModal() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const contentEl = document.getElementById('beli-modal-content');
  if (!contentEl || !ratingSession) return;

  const { dish, weekId, step } = ratingSession;
  const existing = getUserDishRating(dish.id, weekId);

  let bodyHTML = '';

  if (step === 'tier') {
    bodyHTML = `
      <p class="beli-step-prompt">How was this dish?</p>
      <div class="beli-tier-options" role="group" aria-label="Rating tier">
        <button type="button" class="beli-tier-btn tier-liked" onclick="App.selectRatingTier('liked')">
          <span class="beli-tier-indicator beli-good">7.0–10</span>
          <span class="beli-tier-text">
            <strong>Liked it!</strong>
            <small>Standout dish worth recommending</small>
          </span>
          <span class="beli-tier-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" class="beli-tier-btn tier-fine" onclick="App.selectRatingTier('fine')">
          <span class="beli-tier-indicator beli-fine">4.0–6.9</span>
          <span class="beli-tier-text">
            <strong>It was fine</strong>
            <small>Solid, enjoyed parts of it</small>
          </span>
          <span class="beli-tier-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" class="beli-tier-btn tier-disliked" onclick="App.selectRatingTier('disliked')">
          <span class="beli-tier-indicator beli-bad">1.0–3.9</span>
          <span class="beli-tier-text">
            <strong>Didn't like it</strong>
            <small>Not for me this time</small>
          </span>
          <span class="beli-tier-arrow" aria-hidden="true">→</span>
        </button>
      </div>
      ${existing ? `
        <div class="beli-modal-footer-links">
          <button type="button" class="beli-text-danger-btn" onclick="App.removeDishRating(${JSON.stringify(dish.id)}, '${esc(weekId)}')">Remove existing rating</button>
        </div>
      ` : ''}
    `;
  } else if (step === 'compare') {
    const compareId = ratingSession.existingList[ratingSession.mid];
    const compareDish = findDishById(compareId, weekId) || {
      id: compareId,
      dish: `Dish #${compareId}`,
      restaurant: 'Previously tried',
      neighborhood: ''
    };
    const compareRating = getUserDishRating(compareId, weekId);
    const compareBadge = compareRating
      ? renderBeliBadgeHTML(compareRating.score, { className: 'beli-badge-sm' })
      : '';

    bodyHTML = `
      <div class="beli-compare-meta">
        <span class="beli-tier-pill ${getBeliBadgeClass(ratingSession.tier === 'liked' ? 8.5 : ratingSession.tier === 'fine' ? 5.5 : 2.5)}">${esc(getTierLabel(ratingSession.tier))}</span>
        <span class="beli-compare-progress">Comparison ${ratingSession.comparisonsDone + 1}</span>
      </div>
      <p class="beli-step-prompt beli-compare-prompt">Which did you prefer?</p>
      <div class="beli-compare-grid">
        <button type="button" class="beli-compare-card is-new" onclick="App.handleComparisonChoice('new')">
          <span class="beli-compare-tag">New Rating</span>
          <span class="beli-compare-dish">${esc(dish.dish)}</span>
          <span class="beli-compare-rest">${esc(dish.restaurant)}</span>
          ${dish.neighborhood ? `<span class="beli-compare-hood">📍 ${esc(dish.neighborhood)}</span>` : ''}
        </button>
        <div class="beli-compare-vs" aria-hidden="true">VS</div>
        <button type="button" class="beli-compare-card is-existing" onclick="App.handleComparisonChoice('existing')">
          <span class="beli-compare-tag-row">
            <span class="beli-compare-tag">Already Ranked</span>
            ${compareBadge}
          </span>
          <span class="beli-compare-dish">${esc(compareDish.dish)}</span>
          <span class="beli-compare-rest">${esc(compareDish.restaurant)}</span>
          ${compareDish.neighborhood ? `<span class="beli-compare-hood">📍 ${esc(compareDish.neighborhood)}</span>` : ''}
        </button>
      </div>
      <div class="beli-compare-secondary">
        <button type="button" class="beli-tie-btn" onclick="App.handleComparisonTie()">Too tough to call (About the same)</button>
        <button type="button" class="beli-back-btn" onclick="App.startRerateFlow()">← Change tier</button>
      </div>
    `;
  } else if (step === 'result') {
    const ratingInfo = getUserDishRating(dish.id, weekId);
    const score = ratingInfo ? ratingInfo.score : null;
    const badgeClass = score != null ? getBeliBadgeClass(score) : 'beli-fine';
    const community = getCommunityDishRating(dish.id, weekId);
    const rankLine = ratingInfo
      ? `${getTierLabel(ratingInfo.tier)} • Ranked #${ratingInfo.rankIndex + 1} of ${ratingInfo.tierTotal} in tier`
      : 'Rating saved';

    bodyHTML = `
      <div class="beli-result-wrap">
        <div class="beli-result-score-circle ${badgeClass}">${score != null ? score.toFixed(1) : '—'}</div>
        <div class="beli-result-rank">${esc(rankLine)}</div>
        <div class="beli-result-note">Saved to your list &amp; included in this week's community score.</div>
        ${community ? `
          <div class="beli-result-community">
            Community Avg: ${renderBeliBadgeHTML(community.avg, { className: 'beli-badge-sm' })}
            <span>(${community.count} ${community.count === 1 ? 'rating' : 'ratings'})</span>
          </div>
        ` : ''}
      </div>
      <div class="beli-result-actions">
        <button type="button" class="btn beli-done-btn" onclick="App.closeRatingModal()">Done</button>
        <div class="beli-result-subactions">
          <button type="button" class="beli-secondary-link" onclick="App.startRerateFlow()">Re-rank dish</button>
          <button type="button" class="beli-text-danger-btn" onclick="App.removeDishRating(${JSON.stringify(dish.id)}, '${esc(weekId)}')">Remove rating</button>
        </div>
      </div>
    `;
  }

  contentEl.innerHTML = `
    <div class="beli-modal-header">
      <div class="beli-modal-heading">
        <div class="beli-modal-restaurant">${esc(dish.restaurant || 'Food Week Dish')}</div>
        <h3 class="beli-modal-title" id="beli-modal-title">${esc(dish.dish)}</h3>
      </div>
      <button type="button" class="modal-close-btn beli-close-btn" onclick="App.closeRatingModal()" aria-label="Close rating modal">&times;</button>
    </div>
    <div class="beli-modal-body">${bodyHTML}</div>
  `;
}

export function openRatingModal(dishId, weekId) {
  if (!State.user || !State.user.uid) {
    showToast('Sign in to rate dishes you’ve tried!');
    if (typeof openAccountModal === 'function') {
      openAccountModal();
    }
    return false;
  }

  const wid = weekId || State.currentWeekId;
  const dish = findDishById(dishId, wid);
  if (!dish || !wid) {
    showToast('Dish details unavailable right now.');
    return false;
  }

  const existing = getUserDishRating(dish.id, wid);
  ratingSession = {
    dish,
    weekId: wid,
    step: existing ? 'result' : 'tier',
    tier: existing ? existing.tier : null,
    existingList: [],
    lo: 0,
    hi: 0,
    mid: 0,
    comparisonsDone: 0
  };

  if (typeof document !== 'undefined' && document.getElementById) {
    const modal = document.getElementById('beli-rating-modal');
    renderRatingModal();
    if (modal) {
      modal.classList.add('open');
      activateModalFocusTrap('beli-rating-modal', closeRatingModal);
    }
  }
  return true;
}

export function startRerateFlow() {
  if (!ratingSession) return;
  ratingSession.step = 'tier';
  ratingSession.tier = null;
  ratingSession.existingList = [];
  ratingSession.lo = 0;
  ratingSession.hi = 0;
  ratingSession.mid = 0;
  ratingSession.comparisonsDone = 0;
  renderRatingModal();
}

export function closeRatingModal() {
  ratingSession = null;
  if (typeof document !== 'undefined' && document.getElementById) {
    const modal = document.getElementById('beli-rating-modal');
    if (modal) modal.classList.remove('open');
    deactivateModalFocusTrap('beli-rating-modal');
  }
}

export function selectRatingTier(tier) {
  if (!ratingSession) return null;
  if (!['liked', 'fine', 'disliked'].includes(tier)) return null;

  const { dish, weekId } = ratingSession;
  const targetId = normalizeRatingDishId(dish.id);
  const bucket = ensureWeekRatingBucket(weekId);
  const existingInTier = (bucket[tier] || []).filter(
    id => normalizeRatingDishId(id) !== targetId
  );

  ratingSession.tier = tier;
  ratingSession.existingList = existingInTier;
  ratingSession.comparisonsDone = 0;

  if (existingInTier.length === 0) {
    return finalizeDishPlacement(tier, 0);
  }

  ratingSession.lo = 0;
  ratingSession.hi = existingInTier.length;
  ratingSession.mid = Math.floor((ratingSession.lo + ratingSession.hi) / 2);
  ratingSession.step = 'compare';
  renderRatingModal();
  return ratingSession;
}

export function handleComparisonChoice(choice) {
  if (!ratingSession || ratingSession.step !== 'compare') return null;

  if (choice === 'new') {
    ratingSession.hi = ratingSession.mid;
  } else if (choice === 'existing') {
    ratingSession.lo = ratingSession.mid + 1;
  } else {
    return null;
  }

  ratingSession.comparisonsDone += 1;

  if (ratingSession.lo >= ratingSession.hi) {
    return finalizeDishPlacement(ratingSession.tier, ratingSession.lo);
  }

  ratingSession.mid = Math.floor((ratingSession.lo + ratingSession.hi) / 2);
  renderRatingModal();
  return ratingSession;
}

export function handleComparisonTie() {
  if (!ratingSession || ratingSession.step !== 'compare') return null;
  return finalizeDishPlacement(ratingSession.tier, ratingSession.mid);
}

export function finalizeDishPlacement(tier, insertIndex, explicitDishId = null, explicitWeekId = null) {
  if (!['liked', 'fine', 'disliked'].includes(tier)) return null;

  const weekId = explicitWeekId || ratingSession?.weekId || State.currentWeekId;
  const dish = explicitDishId != null
    ? (findDishById(explicitDishId, weekId) || { id: explicitDishId })
    : ratingSession?.dish;
  if (!dish || !weekId) return null;

  const targetId = normalizeRatingDishId(dish.id);
  const bucket = ensureWeekRatingBucket(weekId);

  ['liked', 'fine', 'disliked'].forEach(t => {
    bucket[t] = (bucket[t] || []).filter(id => normalizeRatingDishId(id) !== targetId);
  });

  const targetArr = bucket[tier];
  const clampedIndex = Math.max(0, Math.min(Number(insertIndex) || 0, targetArr.length));
  targetArr.splice(clampedIndex, 0, targetId);

  // Auto-save rated dish to single Saved list
  const dishKey = getDishKey(dish.id, weekId);
  if (!State.saved.has(dishKey)) {
    State.saved.add(dishKey);
    State.passed.delete(dishKey);
    if (Array.isArray(State.customSavedOrder) && !State.customSavedOrder.includes(dishKey)) {
      State.customSavedOrder.push(dishKey);
    }
  }

  saveState();
  syncPublicWeekRatings(weekId, State.user?.uid);

  const result = getUserDishRating(targetId, weekId);

  if (ratingSession && normalizeRatingDishId(ratingSession.dish.id) === targetId && ratingSession.weekId === weekId) {
    ratingSession.tier = tier;
    ratingSession.step = 'result';
    renderRatingModal();
  }

  refreshUiAfterRatingChange(targetId);

  if (result) {
    showToast(`Rated ${result.score.toFixed(1)} (${getTierLabel(tier)})!`);
  }
  return result;
}

export function removeDishRating(dishId, weekId) {
  const wid = weekId || ratingSession?.weekId || State.currentWeekId;
  const targetId = normalizeRatingDishId(dishId ?? ratingSession?.dish?.id);
  if (!wid || targetId == null) return false;

  const bucket = State.ratings?.[wid];
  let removed = false;
  if (bucket && typeof bucket === 'object') {
    ['liked', 'fine', 'disliked'].forEach(t => {
      if (Array.isArray(bucket[t])) {
        const before = bucket[t].length;
        bucket[t] = bucket[t].filter(id => normalizeRatingDishId(id) !== targetId);
        if (bucket[t].length !== before) removed = true;
      }
    });
  }

  if (removed) {
    saveState();
    syncPublicWeekRatings(wid, State.user?.uid);
    refreshUiAfterRatingChange(targetId);
    showToast('Rating removed');
  }

  if (ratingSession && normalizeRatingDishId(ratingSession.dish.id) === targetId && ratingSession.weekId === wid) {
    closeRatingModal();
  }
  return removed;
}
