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
    State.user = user;
    updateAuthUI();
    if (user) {
      onUserSignedIn(user);
    } else {
      onUserSignedOut();
    }
  });
}

export function updateAuthUI() {
  const user = State.user;
  const loggedInViews = document.querySelectorAll('.auth-logged-in');
  const loggedOutViews = document.querySelectorAll('.auth-logged-out');
  const userAvatarBtns = document.querySelectorAll('.user-avatar-btn');
  const userNameEls = document.querySelectorAll('.auth-user-name');
  const userEmailEls = document.querySelectorAll('.auth-user-email');

  if (user) {
    loggedInViews.forEach(el => el.style.display = '');
    loggedOutViews.forEach(el => el.style.display = 'none');
    
    const initials = user.displayName 
      ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : (user.email ? user.email[0].toUpperCase() : '👤');

    userAvatarBtns.forEach(btn => {
      btn.innerHTML = user.photoURL 
        ? `<img src="${user.photoURL}" alt="Profile" class="avatar-img" />`
        : `<span class="avatar-initials">${initials}</span>`;
      btn.setAttribute('aria-label', `Account (${user.displayName || user.email})`);
    });

    userNameEls.forEach(el => el.textContent = user.displayName || 'Food Explorer');
    userEmailEls.forEach(el => el.textContent = user.email || '');
  } else {
    loggedInViews.forEach(el => el.style.display = 'none');
    loggedOutViews.forEach(el => el.style.display = '');

    userAvatarBtns.forEach(btn => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      btn.setAttribute('aria-label', 'Sign In');
    });
  }
}

export function openAccountModal() {
  const modal = document.getElementById('account-modal-overlay');
  if (!modal) return;
  updateAuthUI();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeAccountModal() {
  const modal = document.getElementById('account-modal-overlay');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export async function signInWithGoogle() {
  if (!window.firebase || !window.firebase.auth) {
    showToast('Authentication unavailable.');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebase.auth().signInWithPopup(provider);
    closeAccountModal();
    showToast('Signed in with Google! 🎉');
  } catch (e) {
    console.error('Google sign-in error:', e);
    if (e.code !== 'auth/popup-closed-by-user') {
      showToast(e.message || 'Google sign-in failed');
    }
  }
}

export async function sendMagicLink(email) {
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address.');
    return;
  }
  const actionCodeSettings = {
    url: window.location.origin + window.location.pathname + '?auth=emailLink',
    handleCodeInApp: true
  };
  try {
    await firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    
    const sentView = document.getElementById('magic-link-sent-view');
    const formView = document.getElementById('magic-link-form-view');
    const sentEmailSpan = document.getElementById('magic-link-sent-email');
    if (sentEmailSpan) sentEmailSpan.textContent = email;
    if (sentView && formView) {
      formView.style.display = 'none';
      sentView.style.display = 'block';
    }
    showToast('Sign-in link sent to your email! ✉️');
  } catch (e) {
    console.error('Error sending magic link:', e);
    showToast(e.message || 'Failed to send sign-in link.');
  }
}

export async function signInWithPassword(email, password) {
  if (!email || !password) {
    showToast('Please enter both email and password.');
    return;
  }
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    closeAccountModal();
    showToast('Signed in successfully! 🎉');
  } catch (e) {
    console.error('Sign-in error:', e);
    showToast(e.message || 'Sign in failed');
  }
}

export async function registerWithPassword(email, password) {
  if (!email || !password) {
    showToast('Please enter both email and password.');
    return;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters.');
    return;
  }
  try {
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    closeAccountModal();
    showToast('Account created and signed in! 🎉');
  } catch (e) {
    console.error('Registration error:', e);
    showToast(e.message || 'Registration failed');
  }
}

export async function sendPasswordReset(email) {
  if (!email || !email.includes('@')) {
    showToast('Please enter your email address.');
    return;
  }
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showToast('Password reset email sent! Check your inbox.');
  } catch (e) {
    console.error('Password reset error:', e);
    showToast(e.message || 'Failed to send reset email.');
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
