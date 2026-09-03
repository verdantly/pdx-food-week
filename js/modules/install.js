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
    const dismissed = localStorage.getItem('pdxfw_dismiss_install_banner') === 'true';
    if (!installed && !dismissed && (deferredPrompt || isIOS())) {
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }
}

export function dismissInstallBanner() {
  localStorage.setItem('pdxfw_dismiss_install_banner', 'true');
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
}

export function openInstallModal() {
  const modal = document.getElementById('install-modal-overlay');
  if (!modal) return;

  const iosGuide = document.getElementById('install-guide-ios');
  const androidGuide = document.getElementById('install-guide-android');
  const nativeBtn = document.getElementById('install-native-action-btn');

  if (isIOS()) {
    if (iosGuide) iosGuide.style.display = 'block';
    if (androidGuide) androidGuide.style.display = 'none';
    if (nativeBtn) nativeBtn.style.display = 'none';
  } else {
    if (iosGuide) iosGuide.style.display = 'none';
    if (androidGuide) androidGuide.style.display = 'block';
    if (nativeBtn) {
      nativeBtn.style.display = deferredPrompt ? 'inline-flex' : 'none';
    }
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeInstallModal() {
  const modal = document.getElementById('install-modal-overlay');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
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
