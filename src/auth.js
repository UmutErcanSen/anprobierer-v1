import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { createUserProfile, getUserProfile } from './firestore.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export let currentUser = null;
export let userProfile = null;

const authListeners = [];

export function onAuthChange(fn) {
  authListeners.push(fn);
}

const PLAN_COLORS = {
  free: '#71717a',
  basic: '#22c55e',
  pro: '#f59e0b',
};

function updateUserDot(plan) {
  const btn = document.getElementById('userBtn');
  if (!btn) return;
  let dot = btn.querySelector('.settings-btn-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'settings-btn-dot';
    btn.appendChild(dot);
  }
  const color = PLAN_COLORS[plan] || '#71717a';
  dot.style.setProperty('--plan-color', color);
}

function notifyListeners(user, profile) {
  authListeners.forEach(fn => fn(user, profile));
}

let authResolve = null;
let authReject = null;

function showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
}

export function requireAuth() {
  return new Promise((resolve, reject) => {
    if (currentUser) {
      resolve(currentUser);
      return;
    }
    authResolve = resolve;
    authReject = reject;
    showLoginOverlay();
  });
}

async function onUserLoggedIn(user) {
  currentUser = user;
  userProfile = await getUserProfile(user.uid);
  if (!userProfile) {
    await createUserProfile(user.uid, user.email, user.displayName);
    userProfile = await getUserProfile(user.uid);
  }
  notifyListeners(user, userProfile);
  updateUserDot(userProfile?.subscription || 'free');
  hideLoginOverlay();
  if (authResolve) {
    authResolve(user);
    authResolve = null;
    authReject = null;
  }
}

function onUserLoggedOut() {
  currentUser = null;
  userProfile = null;
  notifyListeners(null, null);
  const btn = document.getElementById('userBtn');
  const dot = btn?.querySelector('.settings-btn-dot');
  if (dot) dot.remove();
}

export async function refreshUserProfile() {
  if (DEV_MODE) return userProfile;
  if (currentUser) {
    userProfile = await getUserProfile(currentUser.uid);
    notifyListeners(currentUser, userProfile);
  }
  return userProfile;
}

export function initAuthGuard() {
  const appContainer = document.getElementById('appContainer');
  const loginOverlay = document.getElementById('loginOverlay');
  if (!appContainer || !loginOverlay) return;

  if (DEV_MODE) {
    loginOverlay.style.display = 'none';
    const badge = document.createElement('div');
    badge.id = 'devBadge';
    badge.textContent = '🧪 DEV-Modus – Lokaler API-Key wird verwendet';
    document.body.appendChild(badge);
    currentUser = { uid: 'dev-user', email: 'dev@local.dev' };
    const mockDate = new Date('2026-01-15');
    userProfile = {
      email: 'dev@local.dev',
      subscription: 'free',
      generationsUsed: 3,
      generationLimit: 5,
      createdAt: { toDate: () => mockDate },
    };
    notifyListeners(currentUser, userProfile);
    updateUserDot('free');
    return;
  }

  loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) {
      hideLoginOverlay();
      if (authReject) {
        authReject(new Error('Login abgebrochen'));
        authResolve = null;
        authReject = null;
      }
    }
  });

  onAuthStateChanged(auth, async user => {
    if (user) {
      await onUserLoggedIn(user);
    } else {
      onUserLoggedOut();
    }
  });
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function logout() {
  return signOut(auth);
}

window.loginWithEmail = loginWithEmail;
window.registerWithEmail = registerWithEmail;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

// ============ Login-Overlay UI Logic ============

function initLoginUI() {
  const tabs = document.querySelectorAll('.login-tab');
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const errorEl = document.getElementById('loginError');
  const googleBtn = document.getElementById('loginGoogleBtn');

  if (!form) return;

  let mode = 'login';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.tab;
      submitBtn.textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
      errorEl.textContent = '';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) { errorEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return }
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ ...';
    errorEl.textContent = '';
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' ? 'Benutzer nicht gefunden.'
        : err.code === 'auth/wrong-password' ? 'Falsches Passwort.'
        : err.code === 'auth/email-already-in-use' ? 'E-Mail bereits registriert.'
        : err.code === 'auth/weak-password' ? 'Passwort zu kurz (min. 6 Zeichen).'
        : err.code === 'auth/invalid-credential' ? 'Ungültige Anmeldedaten.'
        : err.code === 'auth/popup-closed-by-user' ? 'Google-Anmeldung abgebrochen.'
        : err.message || 'Ein Fehler ist aufgetreten.';
      errorEl.textContent = msg;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
    }
  });

  googleBtn?.addEventListener('click', async () => {
    googleBtn.disabled = true;
    googleBtn.textContent = '⏳ ...';
    errorEl.textContent = '';
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        errorEl.textContent = err.message || 'Google-Anmeldung fehlgeschlagen.';
      }
    } finally {
      googleBtn.disabled = false;
      googleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Mit Google fortfahren';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoginUI);
} else {
  initLoginUI();
}
