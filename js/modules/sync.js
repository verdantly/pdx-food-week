/* ── Cloud Synchronization Module ── */
import { State, saveState } from './state.js';
import { showToast } from './utils.js';
import { renderBrowse, renderSaved } from './render.js';

let syncUnsubscribe = null;
let syncDebounceTimer = null;
let isApplyingCloudUpdate = false;

export function onUserSignedIn(user) {
  if (!window.db) return;
  subscribeToCloud(user.uid);
}

export function onUserSignedOut() {
  if (syncUnsubscribe) {
    syncUnsubscribe();
    syncUnsubscribe = null;
  }
  State.syncStatus = 'idle';
  updateSyncStatusUI();
}

export function updateSyncStatusUI() {
  const statusEls = document.querySelectorAll('.cloud-sync-status');
  statusEls.forEach(el => {
    if (State.syncStatus === 'syncing') {
      el.textContent = 'Syncing...';
      el.classList.add('syncing');
    } else if (State.syncStatus === 'synced') {
      el.textContent = 'Cloud Synced ✓';
      el.classList.remove('syncing');
    } else if (State.syncStatus === 'error') {
      el.textContent = 'Sync offline';
      el.classList.remove('syncing');
    } else {
      el.textContent = '';
      el.classList.remove('syncing');
    }
  });
}

export function subscribeToCloud(uid) {
  if (!window.db) return;
  if (syncUnsubscribe) syncUnsubscribe();

  const userDocRef = window.db.collection('users').doc(uid);

  syncUnsubscribe = userDocRef.onSnapshot(async doc => {
    if (isApplyingCloudUpdate) return;

    if (!doc.exists) {
      // First time user: initial push of local state to cloud
      await pushLocalToCloud(uid);
      return;
    }

    const cloudData = doc.data();
    mergeCloudWithLocal(cloudData);
    State.syncStatus = 'synced';
    updateSyncStatusUI();
  }, err => {
    console.error('Firestore cloud sync error:', err);
    State.syncStatus = 'error';
    updateSyncStatusUI();
  });
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
