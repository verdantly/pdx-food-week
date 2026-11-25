/* ── Cloud Synchronization Module ── */
import { State, saveState, backupGuestUserData, restoreGuestUserData, getWeekRatingsMap } from './state.js';
import { showToast } from './utils.js';
import { renderBrowse, renderSaved, renderAll } from './render.js';

let syncUnsubscribe = null;
let syncDebounceTimer = null;
let isApplyingCloudUpdate = false;
let weekRatingsUnsubscribe = null;
let subscribedRatingsWeekId = null;
let rawRemoteWeekDocs = new Map();

function mergeRatingsBuckets(localRatings = {}, cloudRatings = {}) {
  const merged = {};
  const allWeeks = new Set([
    ...Object.keys(localRatings || {}),
    ...Object.keys(cloudRatings || {})
  ]);
  allWeeks.forEach(wid => {
    const cloudBucket = (cloudRatings && cloudRatings[wid]) || {};
    const localBucket = (localRatings && localRatings[wid]) || {};
    const seen = new Set();
    const out = { liked: [], fine: [], disliked: [] };
    ['liked', 'fine', 'disliked'].forEach(tier => {
      const cloudArr = Array.isArray(cloudBucket[tier]) ? cloudBucket[tier] : [];
      const localArr = Array.isArray(localBucket[tier]) ? localBucket[tier] : [];
      [...cloudArr, ...localArr].forEach(rawId => {
        const key = String(rawId);
        if (!seen.has(key)) {
          seen.add(key);
          out[tier].push(rawId);
        }
      });
    });
    merged[wid] = out;
  });
  return merged;
}

export function recomputeCommunityRatingsForWeek(weekId) {
  const wid = weekId || State.currentWeekId;
  if (!wid) return {};
  if (!State.communityRatings || typeof State.communityRatings !== 'object') {
    State.communityRatings = {};
  }

  const byUser = new Map();
  if (subscribedRatingsWeekId === wid) {
    rawRemoteWeekDocs.forEach((scores, docUid) => {
      byUser.set(docUid, scores);
    });
  }

  // Optimistic local overlay for currently signed-in user
  if (State.user && State.user.uid) {
    const localBucket = State.ratings?.[wid];
    if (localBucket && typeof localBucket === 'object') {
      const localScores = {};
      getWeekRatingsMap(wid).forEach((info, dishId) => {
        localScores[String(dishId)] = info.score;
      });
      byUser.set(State.user.uid, localScores);
    }
  }

  const agg = {};
  byUser.forEach(scores => {
    if (!scores || typeof scores !== 'object') return;
    Object.entries(scores).forEach(([rawDishId, rawScore]) => {
      const score = Number(rawScore);
      if (!Number.isFinite(score)) return;
      const dishKey = String(rawDishId);
      if (!agg[dishKey]) {
        agg[dishKey] = { sum: 0, count: 0, avg: 0 };
      }
      agg[dishKey].sum += score;
      agg[dishKey].count += 1;
    });
  });

  Object.keys(agg).forEach(dishKey => {
    const entry = agg[dishKey];
    entry.avg = Math.round((entry.sum / entry.count) * 10) / 10;
  });

  State.communityRatings[wid] = agg;
  return agg;
}

export function resetWeekRatingsCache() {
  rawRemoteWeekDocs = new Map();
  subscribedRatingsWeekId = null;
  if (weekRatingsUnsubscribe) {
    try { weekRatingsUnsubscribe(); } catch (_) { }
    weekRatingsUnsubscribe = null;
  }
}

export function onUserSignedIn(user, fromGuest = false) {
  // Capture a snapshot of guest entries right before any cloud merging happens (only if transitioning from guest)
  if (fromGuest) {
    backupGuestUserData();
  }
  if (!window.db) return;
  subscribeToCloud(user.uid, fromGuest);
}

export function onUserSignedOut() {
  if (syncUnsubscribe) {
    syncUnsubscribe();
    syncUnsubscribe = null;
  }
  clearTimeout(syncDebounceTimer);
  State.syncStatus = 'idle';
  updateSyncStatusUI();

  // Cancel crawl mode if currently active
  if (State.crawlModeActive && window.App && window.App.toggleCrawlMode) {
    window.App.toggleCrawlMode();
  }

  // Restore the guest entries that were saved before the user signed in
  restoreGuestUserData();

  // Re-render views so the UI immediately reflects the restored guest state
  renderAll();

  // Update crawl floating bar and buttons if active
  if (window.App && window.App.updateCrawlFab) {
    window.App.updateCrawlFab();
  }
  if (window.App && window.App.syncCrawlButtons) {
    window.App.syncCrawlButtons();
  }
}

export function updateSyncStatusUI() {
  const statusEls = document.querySelectorAll('.cloud-sync-status');
  statusEls.forEach(el => {
    if (State.syncStatus === 'syncing') {
      el.textContent = 'Syncing...';
      el.style.color = 'var(--pizza)';
      el.classList.add('syncing');
    } else if (State.syncStatus === 'synced') {
      el.textContent = 'Cloud Synced ✓';
      el.style.color = '#2e7d32';
      el.classList.remove('syncing');
    } else if (State.syncStatus === 'error') {
      el.textContent = 'Offline / Sync pending';
      el.style.color = 'var(--ink-50)';
      el.classList.remove('syncing');
    } else {
      el.textContent = '';
      el.classList.remove('syncing');
    }
  });
}

export function subscribeToCloud(uid, fromGuest = false) {
  if (!window.db) return;
  if (syncUnsubscribe) syncUnsubscribe();

  let initialCloudSnapshotDone = false;
  const userDocRef = window.db.collection('users').doc(uid);

  syncUnsubscribe = userDocRef.onSnapshot(async doc => {
    if (isApplyingCloudUpdate) return;

    if (!doc.exists) {
      // First time user: push local state to cloud
      await pushLocalToCloud(uid);
      initialCloudSnapshotDone = true;
      return;
    }

    const cloudData = doc.data() || {};

    if (!initialCloudSnapshotDone) {
      initialCloudSnapshotDone = true;
      if (fromGuest) {
        // User had guest entries prior to logging in: union merge with cloud, then upload combined result
        mergeCloudWithLocal(cloudData);
        await pushLocalToCloud(uid);
      } else {
        // Existing signed-in session (e.g. reload): cloud is source of truth
        applyRemoteCloudState(cloudData);
      }
    } else {
      // Live updates from another tab/device: ignore local echo of uncommitted writes
      if (doc.metadata && doc.metadata.hasPendingWrites) {
        return;
      }
      applyRemoteCloudState(cloudData);
    }

    State.syncStatus = 'synced';
    updateSyncStatusUI();
  }, err => {
    if (err && err.code === 'permission-denied') {
      console.warn('Firestore Permission Denied: Ensure Firestore Security Rules allow read/write for /users/{uid}.');
    } else {
      console.error('Firestore cloud sync error:', err);
    }
    State.syncStatus = 'error';
    updateSyncStatusUI();
  });
}

export function applyRemoteCloudState(cloudData) {
  if (!cloudData) return;
  isApplyingCloudUpdate = true;

  try {
    State.saved = new Set(cloudData.saved || []);
    State.passed = new Set(cloudData.passed || []);
    State.notes = cloudData.notes || {};
    State.ratings = (cloudData.ratings && typeof cloudData.ratings === 'object') ? cloudData.ratings : {};
    State.crawlSelection = Array.isArray(cloudData.crawlSelection) ? cloudData.crawlSelection : [];
    State.customSavedOrder = (cloudData.customSavedOrder || []).filter(id => State.saved.has(id));

    saveState();
    if (State.currentWeekId) {
      recomputeCommunityRatingsForWeek(State.currentWeekId);
    }

    if (State.activeTab === 'saved') renderSaved();
    if (State.activeTab === 'browse') renderBrowse();
    if (State.activeTab === 'map') renderAll();
    if (window.App && window.App.updateCrawlFab) window.App.updateCrawlFab();
  } finally {
    setTimeout(() => {
      isApplyingCloudUpdate = false;
    }, 100);
  }
}

export function mergeCloudWithLocal(cloudData) {
  if (!cloudData) return;
  isApplyingCloudUpdate = true;

  try {
    let changed = false;

    // Merge saved
    if (Array.isArray(cloudData.saved)) {
      const originalSize = State.saved.size;
      cloudData.saved.forEach(id => State.saved.add(id));
      if (State.saved.size !== originalSize) changed = true;
    }

    // Merge passed
    if (Array.isArray(cloudData.passed)) {
      cloudData.passed.forEach(id => State.passed.add(id));
    }

    // Merge notes & ratings
    if (cloudData.notes && typeof cloudData.notes === 'object') {
      State.notes = { ...State.notes, ...cloudData.notes };
      changed = true;
    }
    if (cloudData.ratings && typeof cloudData.ratings === 'object') {
      State.ratings = mergeRatingsBuckets(State.ratings, cloudData.ratings);
      changed = true;
    }

    // Merge crawlSelection
    if (Array.isArray(cloudData.crawlSelection) && cloudData.crawlSelection.length > 0) {
      State.crawlSelection = [...new Set([...State.crawlSelection, ...cloudData.crawlSelection])];
      changed = true;
    }

    // Merge custom order
    if (Array.isArray(cloudData.customSavedOrder) && cloudData.customSavedOrder.length > 0) {
      const mergedOrder = [...cloudData.customSavedOrder];
      State.saved.forEach(id => {
        if (!mergedOrder.includes(id)) mergedOrder.push(id);
      });
      State.customSavedOrder = mergedOrder.filter(id => State.saved.has(id));
    }

    saveState();

    if (changed) {
      if (State.activeTab === 'saved') renderSaved();
      if (State.activeTab === 'browse') renderBrowse();
    }
  } finally {
    setTimeout(() => {
      isApplyingCloudUpdate = false;
    }, 100);
  }
}

export async function pushLocalToCloud(uid) {
  if (!window.db) return;
  const targetUid = uid || (State.user && State.user.uid);
  if (!targetUid) return;

  State.syncStatus = 'syncing';
  updateSyncStatusUI();

  try {
    const payload = {
      saved: [...State.saved],
      passed: [...State.passed],
      notes: State.notes || {},
      ratings: State.ratings || {},
      crawlSelection: State.crawlSelection || [],
      customSavedOrder: State.customSavedOrder || [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await window.db.collection('users').doc(targetUid).set(payload, { merge: true });
    State.syncStatus = 'synced';
    updateSyncStatusUI();
  } catch (e) {
    console.error('Failed to sync to cloud:', e);
    State.syncStatus = 'error';
    updateSyncStatusUI();
  }
}

export function queueCloudSync() {
  if (!State.user || !window.db || isApplyingCloudUpdate) return;
  
  State.syncStatus = 'syncing';
  updateSyncStatusUI();

  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    pushLocalToCloud(State.user.uid);
  }, 1200);
}

export async function deleteCloudUserData(uid) {
  if (syncUnsubscribe) {
    syncUnsubscribe();
    syncUnsubscribe = null;
  }
  clearTimeout(syncDebounceTimer);
  State.syncStatus = 'idle';
  updateSyncStatusUI();

  if (!window.db) return;
  const targetUid = uid || (State.user && State.user.uid);
  if (!targetUid) return;

  try {
    if (window.db && typeof window.db.collection === 'function') {
      try {
        const ratingsSnap = await window.db.collection('week_user_ratings')
          .where('uid', '==', targetUid)
          .get();
        if (ratingsSnap && !ratingsSnap.empty) {
          const deletions = [];
          ratingsSnap.forEach(doc => deletions.push(doc.ref.delete()));
          await Promise.all(deletions);
        }
      } catch (e) {
        console.warn('Could not clean up week_user_ratings docs:', e);
      }
      rawRemoteWeekDocs.delete(targetUid);
      if (State.currentWeekId) {
        recomputeCommunityRatingsForWeek(State.currentWeekId);
      }
      await window.db.collection('users').doc(targetUid).delete();
    }
  } catch (e) {
    console.error('Failed to delete cloud user data:', e);
    throw e;
  }
}

export async function syncPublicWeekRatings(weekId, uid) {
  const wid = weekId || State.currentWeekId;
  if (!wid) return;

  recomputeCommunityRatingsForWeek(wid);

  const targetUid = uid || State.user?.uid;
  if (!targetUid || typeof window === 'undefined' || !window.db || typeof window.db.collection !== 'function') {
    return;
  }

  const ratingsMap = getWeekRatingsMap(wid);
  const scores = {};
  ratingsMap.forEach((info, dishId) => {
    scores[String(dishId)] = info.score;
  });

  const docRef = window.db.collection('week_user_ratings').doc(`${wid}_${targetUid}`);
  try {
    if (Object.keys(scores).length === 0) {
      rawRemoteWeekDocs.delete(targetUid);
      await docRef.delete();
    } else {
      rawRemoteWeekDocs.set(targetUid, scores);
      const payload = {
        uid: targetUid,
        weekId: wid,
        scores,
        updatedAt: (typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp)
          ? firebase.firestore.FieldValue.serverTimestamp()
          : Date.now()
      };
      await docRef.set(payload);
    }
    recomputeCommunityRatingsForWeek(wid);
  } catch (e) {
    console.warn('Failed to sync public week ratings:', e);
  }
}

export function subscribeToWeekRatings(weekId) {
  const wid = weekId || State.currentWeekId;
  if (!wid) return;

  if (subscribedRatingsWeekId === wid && weekRatingsUnsubscribe) {
    recomputeCommunityRatingsForWeek(wid);
    return;
  }

  if (weekRatingsUnsubscribe) {
    try { weekRatingsUnsubscribe(); } catch (_) { }
    weekRatingsUnsubscribe = null;
  }

  rawRemoteWeekDocs = new Map();
  subscribedRatingsWeekId = wid;
  recomputeCommunityRatingsForWeek(wid);

  if (typeof window === 'undefined' || !window.db || typeof window.db.collection !== 'function') {
    return;
  }

  try {
    weekRatingsUnsubscribe = window.db.collection('week_user_ratings')
      .where('weekId', '==', wid)
      .onSnapshot(snapshot => {
        const nextDocs = new Map();
        snapshot.forEach(doc => {
          const data = doc.data ? doc.data() : {};
          const docUid = data.uid || doc.id;
          if (data.scores && typeof data.scores === 'object') {
            nextDocs.set(docUid, data.scores);
          }
        });
        rawRemoteWeekDocs = nextDocs;
        recomputeCommunityRatingsForWeek(wid);
        try {
          if (typeof document !== 'undefined') {
            renderAll();
          }
        } catch (_) { }
      }, err => {
        console.warn('Community ratings listener error:', err);
      });
  } catch (e) {
    console.warn('Could not subscribe to week ratings:', e);
  }
}
