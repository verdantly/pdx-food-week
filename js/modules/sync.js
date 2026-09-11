/* ── Cloud Synchronization Module ── */
import { State, saveState, backupGuestUserData, restoreGuestUserData } from './state.js';
import { showToast } from './utils.js';
import { renderBrowse, renderSaved, renderAll } from './render.js';

let syncUnsubscribe = null;
let syncDebounceTimer = null;
let isApplyingCloudUpdate = false;

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
    State.crawlSelection = Array.isArray(cloudData.crawlSelection) ? cloudData.crawlSelection : [];
    State.customSavedOrder = (cloudData.customSavedOrder || []).filter(id => State.saved.has(id));

    saveState();

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
