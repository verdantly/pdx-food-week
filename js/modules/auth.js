/* ── Authentication Module ── */
import { State } from './state.js';
import { showToast, esc } from './utils.js';
import { onUserSignedIn, onUserSignedOut } from './sync.js';

let authListenerAttached = false;

export function initAuth() {
  if (!window.firebase || !window.firebase.auth) return;
  if (authListenerAttached) return;

  const auth = firebase.auth();
  authListenerAttached = true;

  // Check for passwordless sign-in with email link
  if (auth.isSignInWithEmailLink(window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('Please confirm your email address to complete sign in:');
    }
    if (email) {
      auth.signInWithEmailLink(email, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
          // Clean URL query parameters
          const url = new URL(window.location.href);
          url.searchParams.delete('apiKey');
          url.searchParams.delete('oobCode');
          url.searchParams.delete('mode');
          url.searchParams.delete('lang');
          url.searchParams.delete('auth');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
          showToast('Signed in successfully! 🎉');
        })
        .catch(err => {
          console.error('Error signing in with email link:', err);
          showToast('Sign-in link expired or invalid.');
        });
    }
  }

  // Listen to auth state changes
  auth.onAuthStateChanged(user => {
    const wasLoggedIn = Boolean(State.user) || Boolean(localStorage.getItem('pdxfw_logged_in_uid'));
    State.user = user;
    updateAuthUI();

    if (user) {
      const fromGuest = !wasLoggedIn;
      localStorage.setItem('pdxfw_logged_in_uid', user.uid);
      onUserSignedIn(user, fromGuest);
    } else {
      if (wasLoggedIn) {
        localStorage.removeItem('pdxfw_logged_in_uid');
        onUserSignedOut();
      }
    }
  });
}

export function updateAuthUI() {
  const user = State.user;
  const loggedInViews = document.querySelectorAll('.auth-logged-in');
  const loggedOutViews = document.querySelectorAll('.auth-logged-out');
  const userAvatarBtns = document.querySelectorAll('.user-avatar-btn');
  const modalAvatarPreviews = document.querySelectorAll('.modal-avatar-preview');
  const userNameEls = document.querySelectorAll('.auth-user-name');
  const userEmailEls = document.querySelectorAll('.auth-user-email');

  if (user) {
    loggedInViews.forEach(el => el.style.display = '');
    loggedOutViews.forEach(el => el.style.display = 'none');
    
    const initials = user.displayName 
      ? user.displayName.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
      : (user.email ? user.email[0].toUpperCase() : '👤');

    const avatarHtml = user.photoURL 
      ? `<img src="${user.photoURL}" alt="Profile" class="avatar-img" referrerpolicy="no-referrer" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'avatar-initials',textContent:'${initials}'}))" />`
      : `<span class="avatar-initials">${initials}</span>`;

    userAvatarBtns.forEach(btn => {
      btn.innerHTML = avatarHtml;
      btn.classList.add('has-avatar');
      btn.setAttribute('aria-label', `Account (${user.displayName || user.email})`);
    });

    modalAvatarPreviews.forEach(el => {
      el.innerHTML = avatarHtml;
    });

    userNameEls.forEach(el => el.textContent = user.displayName || 'Food Explorer');
    userEmailEls.forEach(el => el.textContent = user.email || '');
  } else {
    loggedInViews.forEach(el => el.style.display = 'none');
    loggedOutViews.forEach(el => el.style.display = '');

    userAvatarBtns.forEach(btn => {
      btn.classList.remove('has-avatar');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      btn.setAttribute('aria-label', 'Sign In');
    });

    modalAvatarPreviews.forEach(el => {
      el.innerHTML = '👤';
    });
  }
}

let activeTriggerBtn = null;

function getFriendlyAuthErrorMessage(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = error.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password. Please verify and try again, or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters with letters and numbers.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Access is temporarily locked for security. Please try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled. Please complete the Google popup to sign in.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this site and try again.';
    default:
      return error.message || 'Authentication error. Please try again.';
  }
}

function setInlineError(elementId, message) {
  const errEl = document.getElementById(elementId);
  if (!errEl) return;
  if (message) {
    errEl.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true" style="flex-shrink:0;"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg><span>${esc(message)}</span>`;
    errEl.classList.add('show');
  } else {
    errEl.textContent = '';
    errEl.classList.remove('show');
  }
}

function clearAllAuthErrors() {
  ['auth-main-error', 'auth-login-error', 'auth-signup-error', 'auth-forgot-error'].forEach(id => {
    setInlineError(id, '');
  });
  document.querySelectorAll('.auth-input').forEach(input => {
    input.removeAttribute('aria-invalid');
  });
}

function setBtnLoading(btnId, isLoading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>Loading...`;
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
    } else if (defaultText) {
      btn.textContent = defaultText;
    }
  }
}

export function openAccountModal() {
  const modal = document.getElementById('account-modal-overlay');
  if (!modal) return;
  
  activeTriggerBtn = document.activeElement;
  clearAllAuthErrors();
  updateAuthUI();
  showAuthSubView('main');

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Attach modal keyboard listener (Escape and Tab-trap)
  document.removeEventListener('keydown', handleModalKeydown);
  document.addEventListener('keydown', handleModalKeydown);

  // Auto-focus first interactive element
  requestAnimationFrame(() => {
    const firstInput = modal.querySelector('.btn-google-auth, input:not([type="hidden"])');
    if (firstInput) firstInput.focus();
  });
}

export function closeAccountModal() {
  const modal = document.getElementById('account-modal-overlay');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleModalKeydown);

  // Return focus to triggering button for keyboard accessibility (WCAG 2.4.3)
  if (activeTriggerBtn && typeof activeTriggerBtn.focus === 'function') {
    activeTriggerBtn.focus();
    activeTriggerBtn = null;
  }
}

function handleModalKeydown(e) {
  const modal = document.getElementById('account-modal-overlay');
  if (!modal || !modal.classList.contains('open')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeAccountModal();
    return;
  }

  // Focus trap (WCAG 2.1.2)
  if (e.key === 'Tab') {
    const focusable = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const visibleFocusable = Array.from(focusable).filter(el => el.offsetParent !== null);
    if (visibleFocusable.length === 0) return;

    const first = visibleFocusable[0];
    const last = visibleFocusable[visibleFocusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function togglePasswordVisibility(inputId, toggleBtn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    toggleBtn.innerHTML = isPassword
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
}

export async function signInWithGoogle() {
  if (!window.firebase || !window.firebase.auth) {
    showToast('Authentication unavailable.');
    return;
  }
  clearAllAuthErrors();
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebase.auth().signInWithPopup(provider);
    closeAccountModal();
    showToast('Signed in with Google! 🎉');
  } catch (e) {
    console.error('Google sign-in error:', e);
    if (e.code !== 'auth/popup-closed-by-user') {
      const msg = getFriendlyAuthErrorMessage(e);
      setInlineError('auth-main-error', msg);
      showToast(msg);
    }
  }
}

export function showAuthSubView(viewName, e) {
  if (e && e.preventDefault) e.preventDefault();
  clearAllAuthErrors();

  const views = {
    main: document.getElementById('auth-main-view'),
    login: document.getElementById('auth-login-view'),
    signup: document.getElementById('auth-signup-view'),
    forgot: document.getElementById('auth-forgot-view'),
    sent: document.getElementById('magic-link-sent-view')
  };

  Object.values(views).forEach(el => {
    if (el) el.style.display = 'none';
  });

  if (views[viewName]) {
    views[viewName].style.display = 'block';
  }

  // Carry over email between views if typed
  const sourceEmail = document.getElementById('auth-email-input')?.value ||
                      document.getElementById('login-email-input')?.value ||
                      document.getElementById('signup-email-input')?.value ||
                      document.getElementById('forgot-email-input')?.value || '';

  if (sourceEmail) {
    ['auth-email-input', 'login-email-input', 'signup-email-input', 'forgot-email-input'].forEach(id => {
      const input = document.getElementById(id);
      if (input && !input.value) input.value = sourceEmail;
    });
  }

  // Autofocus the most relevant field in the newly revealed view
  requestAnimationFrame(() => {
    if (viewName === 'login') {
      const el = document.getElementById('login-email-input')?.value
        ? document.getElementById('login-password-input')
        : document.getElementById('login-email-input');
      if (el) el.focus();
    } else if (viewName === 'signup') {
      const el = document.getElementById('signup-email-input')?.value
        ? document.getElementById('signup-password-input')
        : document.getElementById('signup-email-input');
      if (el) el.focus();
    } else if (viewName === 'forgot') {
      document.getElementById('forgot-email-input')?.focus();
    } else if (viewName === 'main') {
      document.getElementById('auth-email-input')?.focus();
    }
  });
}

export async function handleMagicLinkSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('auth-email-input');
  const email = (input?.value || '').trim();
  sendMagicLink(email);
}

export async function sendMagicLink(email) {
  clearAllAuthErrors();
  const input = document.getElementById('auth-email-input');

  if (!email || !email.includes('@') || !email.includes('.')) {
    if (input) input.setAttribute('aria-invalid', 'true');
    setInlineError('auth-main-error', 'Please enter a valid email address.');
    if (input) input.focus();
    return;
  }

  setBtnLoading('magic-link-submit-btn', true);
  const actionCodeSettings = {
    url: window.location.origin + window.location.pathname + '?auth=emailLink',
    handleCodeInApp: true
  };
  try {
    await firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    
    const sentEmailSpan = document.getElementById('magic-link-sent-email');
    if (sentEmailSpan) sentEmailSpan.textContent = email;
    showAuthSubView('sent');
    showToast('Sign-in link sent to your email! ✉️');
  } catch (e) {
    console.error('Error sending magic link:', e);
    const msg = getFriendlyAuthErrorMessage(e);
    setInlineError('auth-main-error', msg);
    showToast(msg);
  } finally {
    setBtnLoading('magic-link-submit-btn', false);
  }
}

export async function handlePasswordLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = (document.getElementById('login-email-input')?.value || '').trim();
  const password = document.getElementById('login-password-input')?.value || '';
  signInWithPassword(email, password);
}

export async function signInWithPassword(email, password) {
  clearAllAuthErrors();
  const emailInput = document.getElementById('login-email-input');
  const passwordInput = document.getElementById('login-password-input');

  if (!email || !email.includes('@')) {
    if (emailInput) {
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
    }
    setInlineError('auth-login-error', 'Please enter a valid email address.');
    return;
  }
  if (!password) {
    if (passwordInput) {
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
    }
    setInlineError('auth-login-error', 'Please enter your password.');
    return;
  }

  setBtnLoading('login-submit-btn', true);
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    closeAccountModal();
    showToast('Signed in successfully! 🎉');
  } catch (e) {
    console.error('Sign-in error:', e);
    const msg = getFriendlyAuthErrorMessage(e);
    setInlineError('auth-login-error', msg);
    if (passwordInput) {
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
    }
    showToast(msg);
  } finally {
    setBtnLoading('login-submit-btn', false);
  }
}

export async function handlePasswordSignupSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = (document.getElementById('signup-email-input')?.value || '').trim();
  const password = document.getElementById('signup-password-input')?.value || '';
  const confirmPassword = document.getElementById('signup-confirm-password-input')?.value || '';
  registerWithPassword(email, password, confirmPassword);
}

export async function registerWithPassword(email, password, confirmPassword) {
  clearAllAuthErrors();
  const emailInput = document.getElementById('signup-email-input');
  const passwordInput = document.getElementById('signup-password-input');
  const confirmInput = document.getElementById('signup-confirm-password-input');

  if (!email || !email.includes('@')) {
    if (emailInput) {
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
    }
    setInlineError('auth-signup-error', 'Please enter a valid email address.');
    return;
  }
  if (!password || password.length < 6) {
    if (passwordInput) {
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
    }
    setInlineError('auth-signup-error', 'Password must be at least 6 characters.');
    return;
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    if (confirmInput) {
      confirmInput.setAttribute('aria-invalid', 'true');
      confirmInput.focus();
    }
    setInlineError('auth-signup-error', 'Passwords do not match. Please re-enter.');
    return;
  }

  setBtnLoading('signup-submit-btn', true);
  try {
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    closeAccountModal();
    showToast('Account created and signed in! 🎉');
  } catch (e) {
    console.error('Registration error:', e);
    const msg = getFriendlyAuthErrorMessage(e);
    setInlineError('auth-signup-error', msg);
    showToast(msg);
  } finally {
    setBtnLoading('signup-submit-btn', false);
  }
}

export async function handlePasswordResetSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = (document.getElementById('forgot-email-input')?.value || '').trim();
  sendPasswordReset(email);
}

export async function sendPasswordReset(email) {
  clearAllAuthErrors();
  const emailInput = document.getElementById('forgot-email-input');

  if (!email || !email.includes('@')) {
    if (emailInput) {
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
    }
    setInlineError('auth-forgot-error', 'Please enter your email address.');
    return;
  }

  setBtnLoading('forgot-submit-btn', true);
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showToast('Password reset email sent! Check your inbox.');
    showAuthSubView('login');
  } catch (e) {
    console.error('Password reset error:', e);
    const msg = getFriendlyAuthErrorMessage(e);
    setInlineError('auth-forgot-error', msg);
    showToast(msg);
  } finally {
    setBtnLoading('forgot-submit-btn', false);
  }
}

export async function handleSignOut() {
  if (!window.firebase || !window.firebase.auth) return;
  try {
    await firebase.auth().signOut();
    closeAccountModal();
    showToast('Signed out.');
  } catch (e) {
    console.error('Sign out error:', e);
    showToast('Error signing out.');
  }
}

