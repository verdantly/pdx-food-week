/* ── Swipe Deck Module ── */
import { State, saveState } from './state.js';
import { esc, showToast } from './utils.js';
import { getRestaurants, updateBrowseBadge } from './data.js';
import { buildTags } from './cards.js';
import { openDetail } from './ui.js';

export function buildSwipeQueue() {
  const pool = getRestaurants().filter(r => !State.saved.has(r.id) && !State.passed.has(r.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  State.swipeQueue = pool;
  State.swipeIdx = 0;
}

export function currentSwipeCard() {
  return State.swipeQueue && State.swipeIdx < State.swipeQueue.length ? State.swipeQueue[State.swipeIdx] : null;
}

export function renderSwipe() {
  const deckEl = document.querySelector('.swipe-deck');
  if (!deckEl) return;

  const emptyEl = document.getElementById('swipe-empty');
  const ctrlsEl = document.getElementById('swipe-controls');
  const counterEl = document.getElementById('swipe-counter');

  deckEl.querySelectorAll('.swipe-card').forEach(el => el.remove());

  const undoBtn = document.getElementById('swipe-btn-undo');
  const passBtn = ctrlsEl ? ctrlsEl.querySelector('.swipe-pass') : null;
  const infoBtn = ctrlsEl ? ctrlsEl.querySelector('.swipe-info') : null;
  const likeBtn = ctrlsEl ? ctrlsEl.querySelector('.swipe-like') : null;

  if (undoBtn) undoBtn.disabled = (State.swipeIdx <= 0);

  const r = currentSwipeCard();
  if (!r) {
    emptyEl.style.display = 'flex';
    if (passBtn) passBtn.disabled = true;
    if (infoBtn) infoBtn.disabled = true;
    if (likeBtn) likeBtn.disabled = true;
    counterEl.textContent = 'Nothing left';
    return;
  }

  emptyEl.style.display = 'none';
  if (passBtn) passBtn.disabled = false;
  if (infoBtn) infoBtn.disabled = false;
  if (likeBtn) likeBtn.disabled = false;

  const maxStacked = 3;
  for (let i = maxStacked - 1; i >= 0; i--) {
    const idx = State.swipeIdx + i;
    if (idx >= State.swipeQueue.length) continue;

    const item = State.swipeQueue[idx];
    const isTop = (i === 0);

    const cardEl = document.createElement('div');
    cardEl.className = `swipe-card ${isTop ? 'swipe-card-top' : 'swipe-card-bg'}`;
    cardEl.dataset.id = item.id;
    cardEl.style.zIndex = 10 - i;

    if (isTop) {
      cardEl.id = 'swipe-card';
    } else {
      if (window.innerWidth >= 768) {
        cardEl.style.transform = `translate(${i * 60}px, ${i * 12}px) rotate(${i * 4}deg) scale(${1 - i * 0.05})`;
      } else {
        cardEl.style.transform = `scale(${1 - i * 0.05}) translateY(${i * 12}px)`;
      }
      cardEl.style.opacity = i === 1 ? '0.6' : '0.25';
      cardEl.style.pointerEvents = 'none';
    }

    const imageBlock = item.image
      ? `<img src="${esc(item.image)}" alt="Photo of ${esc(item.dish)}" loading="eager" onerror="this.parentElement.style.display='none'">`
      : `<div class="swipe-card-emoji">${esc(item.emoji)}</div>`;

    const isNew = item.isNew && !State.viewedNew.has(item.id);

    cardEl.innerHTML = `
      <div class="swipe-card-image">${imageBlock}</div>
      <div class="swipe-card-body">
        <div class="swipe-card-dish">${esc(item.dish)}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
        <div class="swipe-card-restaurant">${esc(item.restaurant)}</div>
        <div class="swipe-card-neighborhood">📍 ${esc(State.currentWeekId === 'slushie-2026' ? item.address : (item.neighborhood || item.address))}</div>
        <div class="swipe-card-desc">${esc(item.desc)}</div>
        <div class="swipe-card-tags">${buildTags(item)}</div>
      </div>
    `;

    deckEl.insertBefore(cardEl, deckEl.firstChild);
  }

  attachSwipeGestures();

  const remaining = State.swipeQueue.length - State.swipeIdx;
  counterEl.textContent = `${remaining} to go`;
}

export function swipe(dir, fromGesture = false) {
  if (State.swipeAnimating) return;
  
  if (!fromGesture && navigator.vibrate) {
    navigator.vibrate(dir === 'right' ? 50 : [30, 50, 30]);
  }

  const cardEl = document.getElementById('swipe-card');
  const r = currentSwipeCard();
  if (!r) return;

  if (dir === 'right') {
    State.saved.add(r.id);
    State.passed.delete(r.id);
    showToast('★ Saved!');
  } else {
    State.passed.add(r.id);
    State.saved.delete(r.id);
  }

  if (r.isNew && !State.viewedNew.has(r.id)) {
    State.viewedNew.add(r.id);
  }
  saveState();
  updateBrowseBadge();

  State.swipeIdx++;
  State.swipeAnimating = true;

  cardEl.style.transition = 'transform 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  const punchX = dir === 'right' ? 30 : -30;
  const punchRot = dir === 'right' ? 6 : -6;
  cardEl.style.transform = `translate(${punchX}px, 6px) rotate(${punchRot}deg) scale(1.03)`;

  setTimeout(() => {
    cardEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease-out';
    const tx = dir === 'right' ? window.innerWidth : -window.innerWidth;
    const rot = dir === 'right' ? 18 : -18;
    cardEl.style.transform = `translate(${tx}px, 40px) rotate(${rot}deg) scale(0.95)`;
    cardEl.style.opacity = '0';
  }, 100);

  setTimeout(() => {
    State.swipeAnimating = false;
    renderSwipe();
    if (window.App && window.App.renderBrowse) window.App.renderBrowse();
    if (window.App && window.App.renderSaved) window.App.renderSaved();
    if (window.App && window.App.renderFriends) window.App.renderFriends();
  }, 450);
}

export function undoSwipe() {
  if (State.swipeIdx <= 0 || !State.swipeQueue || State.swipeAnimating) return;
  State.swipeIdx--;
  const r = State.swipeQueue[State.swipeIdx];
  State.saved.delete(r.id);
  State.passed.delete(r.id);
  saveState();

  renderSwipe();

  const cardEl = document.getElementById('swipe-card');
  if (cardEl) {
    cardEl.style.transition = 'none';
    cardEl.style.transform = 'translate(-40px, 20px) rotate(-8deg)';
    cardEl.style.opacity = '0';
    cardEl.offsetHeight;
    cardEl.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
    cardEl.style.transform = 'translate(0, 0) rotate(0deg)';
    cardEl.style.opacity = '1';
  }

  if (window.App && window.App.renderBrowse) window.App.renderBrowse();
  if (window.App && window.App.renderSaved) window.App.renderSaved();
  if (window.App && window.App.renderFriends) window.App.renderFriends();
  showToast('Undo successful');
}

export function skipSwipe() {
  if (!State.swipeQueue || State.swipeIdx >= State.swipeQueue.length || State.swipeAnimating) return;
  const r = State.swipeQueue[State.swipeIdx];

  if (State.swipeQueue.length - State.swipeIdx > 1) {
    State.swipeQueue.push(r);
  }
  State.swipeIdx++;
  State.swipeAnimating = true;

  const cardEl = document.getElementById('swipe-card');
  if (cardEl) {
    cardEl.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
    cardEl.style.transform = `translateY(${window.innerHeight}px)`;
    cardEl.style.opacity = '0';
  }

  setTimeout(() => {
    State.swipeAnimating = false;
    renderSwipe();
  }, 300);
}

export function resetSwipe() {
  State.passed.clear();
  saveState();
  buildSwipeQueue();
  renderSwipe();
  showToast('Reshuffled');
}

export function swipeOpenDetail() {
  const r = currentSwipeCard();
  if (r) openDetail(r.id);
}

export function attachSwipeGestures() {
  const cardEl = document.getElementById('swipe-card');
  if (!cardEl) return;
  let startX = 0, startY = 0, isDown = false, pointerId = null;
  let hasVibrated = false;
  let isHorizontalSwipe = false;

  cardEl.addEventListener('pointerdown', e => {
    if (!currentSwipeCard()) return;
    isDown = true;
    hasVibrated = false;
    isHorizontalSwipe = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    cardEl.style.transition = '';
    try { cardEl.setPointerCapture(e.pointerId); } catch (err) { }
  });

  cardEl.addEventListener('pointermove', e => {
    if (!isDown || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    if (!isHorizontalSwipe) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isHorizontalSwipe = true;
      } else if (Math.abs(dy) > 10) {
        return;
      } else {
        return;
      }
    }

    const rot = dx * 0.06;
    cardEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;

    const threshold = 100;
    if (!hasVibrated && Math.abs(dx) > threshold) {
      hasVibrated = true;
      if (navigator.vibrate) navigator.vibrate(dx > 0 ? 50 : [30, 50, 30]);
    } else if (hasVibrated && Math.abs(dx) <= threshold) {
      hasVibrated = false;
    }

    const btnLike = document.querySelector('.swipe-like');
    const btnPass = document.querySelector('.swipe-pass');
    if (btnLike && btnPass) {
      const intensity = Math.min(1, Math.abs(dx) / 120);
      if (dx > 0) {
        btnLike.style.transform = `scale(${1 + intensity * 0.2})`;
        btnLike.style.borderColor = `rgba(40, 106, 95, ${0.2 + intensity * 0.8})`;
        btnLike.style.background = `rgba(40, 106, 95, ${intensity * 0.1})`;
        
        btnPass.style.transform = `scale(${1 - intensity * 0.1})`;
        btnPass.style.opacity = 1 - intensity * 0.5;
      } else {
        btnPass.style.transform = `scale(${1 + intensity * 0.2})`;
        btnPass.style.borderColor = `rgba(140, 52, 32, ${0.2 + intensity * 0.8})`;
        btnPass.style.background = `rgba(140, 52, 32, ${intensity * 0.1})`;

        btnLike.style.transform = `scale(${1 - intensity * 0.1})`;
        btnLike.style.opacity = 1 - intensity * 0.5;
      }
    }
  });

  const snapBack = () => {
    cardEl.style.transition = 'transform 0.2s ease';
    cardEl.style.transform = '';
    const btnLike = document.querySelector('.swipe-like');
    const btnPass = document.querySelector('.swipe-pass');
    if (btnLike && btnPass) {
      btnLike.style.transform = ''; btnLike.style.borderColor = ''; btnLike.style.background = ''; btnLike.style.opacity = '';
      btnPass.style.transform = ''; btnPass.style.borderColor = ''; btnPass.style.background = ''; btnPass.style.opacity = '';
    }
  };

  cardEl.addEventListener('pointerup', e => {
    if (!isDown || e.pointerId !== pointerId) return;
    isDown = false;
    isHorizontalSwipe = false;
    const dx = e.clientX - startX;
    const threshold = 100;
    if (dx > threshold) swipe('right', true);
    else if (dx < -threshold) swipe('left', true);
    else snapBack();
  });

  cardEl.addEventListener('pointercancel', () => {
    if (!isDown) return;
    isDown = false;
    isHorizontalSwipe = false;
    snapBack();
  });
}
