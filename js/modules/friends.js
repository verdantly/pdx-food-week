/* ── Friends & Sharing Module ── */
import { State, saveState, isDishSaved, getDishKey } from './state.js';
import { esc, showToast } from './utils.js';
import { getRestaurants, getSaved } from './data.js';
import { cardHTML } from './cards.js';

export function encodeShareCode() {
  const currentWeekSaved = getRestaurants().filter(r => isDishSaved(r.id, r.weekId)).map(r => r.id);
  const ids = currentWeekSaved.join(',');
  return 'PDX26-' + btoa(ids).replace(/=/g, '');
}

export function decodeShareCode(code) {
  try {
    if (!code.startsWith('PDX26-')) return null;
    const raw = atob(code.replace('PDX26-', ''));
    const ids = raw.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    return ids.length > 0 ? ids : null;
  } catch (e) {
    return null;
  }
}

export function exportSavedToClipboard() {
  const items = getSaved();
  if (items.length === 0) {
    showToast('Nothing to export!');
    return;
  }
  const text = items.map(r => `• ${r.restaurant} - ${r.dish}\n  📍 ${r.address}`).join('\n\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('List copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showToast('Failed to copy text');
  });
}

export function exportSavedKML() {
  const items = getSaved();
  if (items.length === 0) {
    showToast('Nothing to export!');
    return;
  }

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>PDX Food Week - Saved Spots</name>`;

  items.forEach(r => {
    if (r.lat && r.lng) {
      kml += `
    <Placemark>
      <name>${esc(r.restaurant)}</name>
      <description><![CDATA[
        <h3>${esc(r.dish)}</h3>
        <p>${esc(r.desc || r.address)}</p>
      ]]></description>
      <Point>
        <coordinates>${r.lng},${r.lat},0</coordinates>
      </Point>
    </Placemark>`;
    }
  });

  kml += `
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pdx_food_week_saved.kml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported KML file!');
}

export function renderFriends() {
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.disabled = (State.saved.size === 0);
  }

  if (State.saved.size === 0) {
    const resultsDiv = document.getElementById('share-results');
    if (resultsDiv) {
      resultsDiv.style.display = 'none';
    }
  }

  const activeFriends = window.App && window.App.getActiveFriends ? window.App.getActiveFriends() : [];

  let emptyMessage = `<p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">No friends added yet.</p>`;
  if (State.friends.length > 0 && activeFriends.length === 0) {
    emptyMessage = `<p style="font-family: var(--font-display); font-size: 20px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">No shared lists for this week.</p>`;
  }

  const fl = document.getElementById('friends-list');
  if (fl) {
    fl.innerHTML = activeFriends.length === 0
      ? `<div class="no-results" style="padding:24px 0">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--pizza-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          ${emptyMessage}
        </div>`
      : activeFriends.map((f) => `
          <div class="friend-item">
            <div class="friend-avatar">${f.name.charAt(0).toUpperCase()}</div>
            <div class="friend-info">
              <div class="friend-name">${esc(f.name)}</div>
              <div class="friend-count">${f.weekIds.length} location${f.weekIds.length === 1 ? '' : 's'} saved</div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="friend-remove" onclick="App.viewFriendList(${f.originalIndex})" style="background: var(--pizza-light); color: var(--pizza-dark); border-color: var(--pizza-dark);">View</button>
              <button class="friend-remove" onclick="App.renameFriend(${f.originalIndex})">✏️ Edit</button>
              <button class="friend-remove" onclick="App.removeFriend(${f.originalIndex})">Remove</button>
            </div>
          </div>`).join('');
  }

  const overlapSection = document.getElementById('overlap-section');
  if (!overlapSection) return;

  if (activeFriends.length === 0) {
    overlapSection.style.display = 'none';
    return;
  }
  overlapSection.style.display = 'block';

  const myIds = [...State.saved];
  const allSets = [myIds, ...activeFriends.map(f => f.weekIds)];
  const overlap = getRestaurants().filter(r => allSets.every(set => set.includes(r.id)));
  const overlapContainer = document.getElementById('overlap-container');

  if (overlapContainer) {
    overlapContainer.className = 'cards-list';
    if (overlap.length === 0) {
      overlapContainer.innerHTML = `<div class="no-results" style="padding:20px 0">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--pizza-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p style="font-family: var(--font-display); font-size: 18px; color: var(--ink); margin-bottom: 4px; font-weight: 700;">No overlap yet</p>
        <p style="color: var(--ink-60);">Save more spots and add more friends!</p>
      </div>`;
    } else {
      overlapContainer.innerHTML = overlap.map(r => cardHTML(r, true)).join('');
    }
  }
}

function timeoutPromise(promise, ms, errorMsg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg || "Timeout"));
    }, ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function generateShareLink() {
  const currentWeekSaved = getRestaurants().filter(r => isDishSaved(r.id, r.weekId)).map(r => r.id);
  if (currentWeekSaved.length === 0) {
    showToast('⚠️ Save some spots first!');
    return;
  }

  const btn = document.getElementById('copy-btn');
  const nameInput = document.getElementById('my-name-input');
  const myName = nameInput ? nameInput.value.trim() : '';

  btn.textContent = 'Generating...';
  btn.disabled = true;

  const shortId = Math.random().toString(36).substring(2, 7);
  let firebaseSuccess = false;

  const db = window.db || null;
  if (db) {
    try {
      const writePromise = db.collection('shared_lists').doc(shortId).set({
        ids: currentWeekSaved,
        name: myName,
        weekId: State.currentWeekId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await timeoutPromise(writePromise, 5000, "Firestore write timeout");
      firebaseSuccess = true;
    } catch (e) {
      console.error("Firebase Firestore save failed!", e);
    }
  }

  try {
    const encodedBackup = encodeShareCode();
    const baseUrl = window.location.origin + window.location.pathname;
    let url;

    if (firebaseSuccess) {
      url = `${baseUrl}?week=${State.currentWeekId}&list=${shortId}`;
    } else {
      url = `${baseUrl}?week=${State.currentWeekId}&fallback=${encodedBackup}`;
    }

    const magicDisplay = document.getElementById('magic-link-display');
    if (magicDisplay) magicDisplay.value = url;

    const codeDisplay = document.getElementById('manual-code-display');
    if (codeDisplay) codeDisplay.value = encodedBackup;

    const resultsDiv = document.getElementById('share-results');
    if (resultsDiv) resultsDiv.style.display = 'flex';

    const shareNativeBtn = document.getElementById('share-native-btn');
    if (shareNativeBtn) shareNativeBtn.style.display = navigator.share ? 'block' : 'none';

    let copiedSuccessfully = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        copiedSuccessfully = true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(ta);
        if (successful) copiedSuccessfully = true;
      }
    } catch (e) {
      console.warn("Auto-copy failed:", e);
    }

    if (copiedSuccessfully) {
      btn.textContent = 'Generated & Copied!';
      btn.classList.add('copied');
      showToast('✅ Magic Link Copied!');
    } else {
      btn.textContent = 'Generated!';
      showToast('✅ Magic Link generated! Copy it below.');
    }
  } catch (err) {
    console.error("Error in generateShareLink:", err);
    showToast('⚠️ Error generating share details');
  } finally {
    setTimeout(() => {
      btn.textContent = 'Generate Magic Link';
      btn.classList.remove('copied');
      btn.disabled = false;
    }, 2000);
  }
}

export async function copyTextFromElement(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input || !btn) return;

  const text = input.value;
  if (!text) return;

  try {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(ta);
      if (successful) copied = true;
    }

    if (copied) {
      const origText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      showToast('✅ Copied to clipboard!');

      setTimeout(() => {
        btn.textContent = origText;
        btn.classList.remove('copied');
      }, 2000);
    } else {
      showToast('⚠️ Copy failed, please copy manually');
    }
  } catch (e) {
    console.error("Failed to copy", e);
    showToast('⚠️ Copy failed, please copy manually');
  }
}

export async function shareNative() {
  const magicDisplay = document.getElementById('magic-link-display');
  const url = magicDisplay ? magicDisplay.value : '';
  if (!url) return;

  try {
    await navigator.share({
      title: 'PDX Food Week List',
      text: 'Import my saved spots for PDX Food Week!',
      url: url
    });
    showToast('✅ List shared!');
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error("Native share failed", e);
      showToast('⚠️ Native sharing failed, please copy the link.');
    }
  }
}

export async function addFriend() {
  const input = document.getElementById('friend-code-input');
  const rawVal = input.value.trim();
  if (!rawVal) return;

  let listId = null;
  let fallbackCode = null;
  try {
    if (rawVal.startsWith('http')) {
      const urlParams = new URL(rawVal).searchParams;
      listId = urlParams.get('list');
      fallbackCode = urlParams.get('fallback');
    } else {
      if (rawVal.length <= 10 && !rawVal.startsWith('PDX')) listId = rawVal;
      else fallbackCode = rawVal;
    }
  } catch (e) { }

  let ids = null;
  let friendName = `Friend ${State.friends.length + 1}`;

  const db = window.db || null;
  if (listId && db) {
    try {
      const fetchPromise = db.collection('shared_lists').doc(listId).get();
      const doc = await timeoutPromise(fetchPromise, 5000, "Firestore fetch timeout");
      if (doc && doc.exists) {
        const data = doc.data();
        ids = data.ids || [];
        if (data.name) friendName = data.name;
      }
    } catch (e) {
      console.error("Failed to fetch shared list", e);
    }
  }

  if (!ids && fallbackCode) {
    ids = decodeShareCode(fallbackCode);
  }

  if (!ids) {
    showToast('⚠️ Invalid link or code');
    return;
  }

  State.friends.push({ name: friendName, ids, code: fallbackCode || listId });
  saveState();
  input.value = '';
  renderFriends();
  showToast(`Added ${friendName}!`);
}

export function renameFriend(i) {
  const currentName = State.friends[i].name;
  const newName = prompt("Enter a new name for this friend:", currentName);
  if (newName && newName.trim() !== "" && newName !== currentName) {
    State.friends[i].name = newName.trim();
    saveState();
    renderFriends();
    showToast('Name updated');
  }
}

export function removeFriend(i) {
  State.friends.splice(i, 1);
  saveState();
  renderFriends();
  showToast('Friend removed');
}

export function viewFriendList(i) {
  State.viewingFriendIndex = i;
  if (window.App && window.App.renderSavedFilters) window.App.renderSavedFilters();
  if (window.App && window.App.renderSaved) window.App.renderSaved();
  if (window.App && window.App.switchTab) window.App.switchTab('saved');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function exitFriendView() {
  State.viewingFriendIndex = null;
  if (window.App && window.App.renderSavedFilters) window.App.renderSavedFilters();
  if (window.App && window.App.renderSaved) window.App.renderSaved();
}

export function mergeFriendList() {
  if (State.viewingFriendIndex === null || !State.friends[State.viewingFriendIndex]) return;
  const friend = State.friends[State.viewingFriendIndex];
  let addedCount = 0;
  
  friend.ids.forEach(id => {
    if (!isDishSaved(id, State.currentWeekId)) {
      const key = getDishKey(id, State.currentWeekId);
      State.saved.add(key);
      State.passed.delete(key);
      State.passed.delete(id);
      State.passed.delete(Number(id));
      if (!State.customSavedOrder.includes(key)) {
        State.customSavedOrder.push(key);
      }
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    saveState();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
    showToast(`✅ Merged ${addedCount} new spots into your list!`);
  } else {
    showToast('No new spots to merge.');
  }
}
