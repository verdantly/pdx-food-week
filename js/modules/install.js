/* ── PWA Installation Module ── */
import { State } from './state.js';

let deferredPrompt = null;

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

export function isSafari() {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|crios|crmo|android/i.test(ua);
}

let handleModalKeydown = null;

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    State.deferredInstallPrompt = e;
    updateInstallUI();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    State.deferredInstallPrompt = null;
    updateInstallUI();
    closeInstallModal();
  });

  // Attach click listener for PWA install banner actions
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn && !installBtn.dataset.listenerAttached) {
    installBtn.dataset.listenerAttached = 'true';
    installBtn.addEventListener('click', () => {
      triggerInstall();
    });
  }

  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  if (dismissBtn && !dismissBtn.dataset.listenerAttached) {
    dismissBtn.dataset.listenerAttached = 'true';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissInstallBanner();
    });
  }

  updateInstallUI();
}

export function updateInstallUI() {
  const installed = isStandalone();
  const installButtons = document.querySelectorAll('.install-app-btn, #install-app-menu-item, #compact-install-btn');
  
  installButtons.forEach(btn => {
    if (installed) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  });

  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    const dismissed = localStorage.getItem('pdxfw_dismiss_install_banner') === 'true' ||
                      localStorage.getItem('pdx_pwa_dismissed') === 'true';
    if (!installed && !dismissed && (deferredPrompt || isIOS())) {
      banner.hidden = false;
      banner.style.display = 'flex';
    } else {
      banner.hidden = true;
      banner.style.display = 'none';
    }
  }
}

export function dismissInstallBanner() {
  localStorage.setItem('pdxfw_dismiss_install_banner', 'true');
  localStorage.setItem('pdx_pwa_dismissed', 'true');
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.hidden = true;
    banner.style.display = 'none';
  }
}

export function openInstallModal() {
  const modal = document.getElementById('install-modal-overlay');
  if (!modal) return;

  // Temporarily hide floating banner if visible so it doesn't collide
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';

  const iosGuide = document.getElementById('install-guide-ios');
  const androidGuide = document.getElementById('install-guide-android');
  const nativeBtn = document.getElementById('install-native-action-btn');
  const desktopHint = document.getElementById('install-desktop-hint');

  if (isIOS()) {
    if (iosGuide) iosGuide.style.display = 'block';
    if (androidGuide) androidGuide.style.display = 'none';
    if (nativeBtn) nativeBtn.style.display = 'none';
    if (desktopHint) desktopHint.style.display = 'none';
  } else {
    if (iosGuide) iosGuide.style.display = 'none';
    if (androidGuide) androidGuide.style.display = 'block';
    if (nativeBtn) {
      nativeBtn.style.display = deferredPrompt ? 'inline-flex' : 'none';
    }
    if (desktopHint) {
      desktopHint.style.display = deferredPrompt ? 'none' : 'block';
    }
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Keyboard accessibility: close on Escape key
  if (handleModalKeydown) {
    document.removeEventListener('keydown', handleModalKeydown);
  }
  handleModalKeydown = (e) => {
    if (e.key === 'Escape') {
      closeInstallModal();
    }
  };
  document.addEventListener('keydown', handleModalKeydown);
}

export function closeInstallModal() {
  const modal = document.getElementById('install-modal-overlay');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (handleModalKeydown) {
    document.removeEventListener('keydown', handleModalKeydown);
    handleModalKeydown = null;
  }

  // Restore banner display state if still valid
  updateInstallUI();
}

export async function triggerInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      deferredPrompt = null;
      State.deferredInstallPrompt = null;
      closeInstallModal();
      updateInstallUI();
    }
  } else {
    openInstallModal();
  }
}
