import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { createUserProfile, getUserProfile, deleteUserData } from './firestore.js';
import { validateEmailDomain } from './utils.js';
import { icon } from './icons.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export let currentUser = null;
export let userProfile = null;

const authListeners = [];

export function onAuthChange(fn) {
  authListeners.push(fn);
}

function updateUserBtn(loggedIn) {
  const btn = document.getElementById('userBtn');
  if (!btn) return;
  btn.classList.toggle('settings-btn--active', loggedIn);
  let letter = btn.querySelector('.settings-btn-letter');
  if (loggedIn && userProfile) {
    const name = userProfile.displayName || userProfile.email || '';
    const initial = (name.charAt(0) || '?').toUpperCase();
    if (!letter) {
      letter = document.createElement('span');
      letter.className = 'settings-btn-letter';
      btn.appendChild(letter);
    }
    letter.textContent = initial;
  } else if (letter) {
    letter.remove();
  }
}

function notifyListeners(user, profile) {
  authListeners.forEach(fn => fn(user, profile));
}

let authResolve = null;
let authReject = null;

let authStateResolved = false;
let firstAuthResolve = null;
const firstAuthPromise = new Promise(r => { firstAuthResolve = r; });

export function waitForAuth() {
  if (authStateResolved) return Promise.resolve(currentUser);
  return firstAuthPromise;
}

function showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
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

export function isEmailVerified() {
  if (DEV_MODE) return true;
  return currentUser?.emailVerified === true;
}

let verifyOverlayMode = null;
let verifyOverlayListenersAttached = false;

function showVerifyOverlay(mode, email) {
  verifyOverlayMode = mode;
  const overlay = document.getElementById('loginOverlay');
  const loginCard = overlay?.querySelector('.login-card');
  if (!overlay || !loginCard) return;

  const tabs = loginCard.querySelector('.login-tabs');
  const form = document.getElementById('loginForm');
  const divider = loginCard.querySelector('.login-divider');
  const googleBtn = document.getElementById('loginGoogleBtn');
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const forgotSection = document.getElementById('forgotPasswordSection');
  const verifySection = document.getElementById('verifySection');
  const verifyTitle = document.getElementById('verifyTitle');
  const verifyText = document.getElementById('verifyText');
  const verifyEmail = document.getElementById('verifyEmailDisplay');
  const resendBtn = document.getElementById('resendVerifyBtn');
  const verifyMsg = document.getElementById('verifyMessage');
  const backBtn = document.getElementById('verifyBackBtn');

  if (tabs) tabs.classList.add('hidden');
  if (form) form.classList.add('hidden');
  if (divider) divider.classList.add('hidden');
  if (googleBtn) googleBtn.classList.add('hidden');
  if (forgotBtn) forgotBtn.classList.add('hidden');
  if (forgotSection) forgotSection.classList.add('hidden');
  if (verifySection) verifySection.classList.remove('hidden');

  if (mode === 'registered') {
    verifyTitle.innerHTML = `${icon('check-circle', 16)} Registrierung erfolgreich`;
    verifyText.textContent = 'Wir haben eine Bestätigungs-E-Mail gesendet an:';
    verifyEmail.textContent = email;
  } else if (mode === 'unverified') {
    verifyTitle.innerHTML = `${icon('alert-triangle', 16)} Bitte bestätige deine E-Mail-Adresse`;
    verifyText.textContent = 'Du hast noch keine E-Mail-Adresse bestätigt. Bitte klicke auf den Link in unserer Bestätigungs-Mail an:';
    verifyEmail.textContent = email;
  }
  if (verifyMsg) verifyMsg.textContent = '';
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (!verifyOverlayListenersAttached) {
    verifyOverlayListenersAttached = true;
    resendBtn?.addEventListener('click', async () => {
      resendBtn.disabled = true;
      resendBtn.innerHTML = `${icon('hourglass', 14)} Wird gesendet...`;
      if (verifyMsg) verifyMsg.textContent = '';
      try {
        await sendEmailVerification(auth.currentUser);
        if (verifyMsg) { verifyMsg.innerHTML = `${icon('check-circle', 14)} Bestätigungs-E-Mail erneut gesendet.`; verifyMsg.className = 'login-success'; }
      } catch (err) {
        if (verifyMsg) { verifyMsg.innerHTML = icon('x-circle', 14) + ' ' + (err.message || 'Fehler beim Senden.'); verifyMsg.className = 'login-error'; }
      } finally {
        resendBtn.disabled = false;
        resendBtn.innerHTML = `${icon('mail', 14)} Erneut senden`;
      }
    });

    backBtn?.addEventListener('click', async () => {
      try { await signOut(auth); } catch (_) {}
      verifySection.classList.add('hidden');
      if (tabs) tabs.classList.remove('hidden');
      if (form) form.classList.remove('hidden');
      if (divider) divider.classList.remove('hidden');
      if (googleBtn) googleBtn.classList.remove('hidden');
      if (forgotBtn) forgotBtn.classList.remove('hidden');
      verifyOverlayMode = null;
    });
  }
}

async function onUserLoggedIn(user) {
  currentUser = user;
  userProfile = await getUserProfile(user.uid);
  if (!userProfile) {
    await createUserProfile(user.uid, user.email, user.displayName);
    userProfile = await getUserProfile(user.uid);
  }
  notifyListeners(user, userProfile);
  updateUserBtn(true);

  if (!user.emailVerified && !DEV_MODE) {
    showVerifyOverlay('unverified', user.email);
    return;
  }

  hideLoginOverlay();
  const hadExplicitLogin = !!authResolve;
  if (authResolve) {
    authResolve(user);
    authResolve = null;
    authReject = null;
  }
  const redirectUrl = consumePendingRedirect();
  if (redirectUrl && window.navigateTo) {
    window.navigateTo(redirectUrl);
  } else if (hadExplicitLogin && window.navigateTo) {
    window.navigateTo('/account');
  }
}

function onUserLoggedOut() {
  currentUser = null;
  userProfile = null;
  verifyOverlayMode = null;
  notifyListeners(null, null);
  updateUserBtn(false);
  const path = window.location.pathname;
  if (path === '/account' || path === '/anzeige-erstellen') {
    showLoginOverlay();
  }
}

export async function refreshUserProfile() {
  if (DEV_MODE) return userProfile;
  if (currentUser) {
    userProfile = await getUserProfile(currentUser.uid);
    notifyListeners(currentUser, userProfile);
    updateUserBtn(true);
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
    badge.innerHTML = `${icon('test-tube', 12)} DEV-Modus – Lokaler API-Key wird verwendet`;
    document.body.appendChild(badge);
    currentUser = { uid: 'dev-user', email: 'dev@local.dev' };
    const mockDate = new Date('2026-01-15');
    userProfile = {
      email: 'dev@local.dev',
      subscription: 'free',
      subscriptionStatus: 'active',
      generationsUsed: 1,
      generationLimit: 3,
      currentPeriodStart: { toDate: () => mockDate },
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: { toDate: () => mockDate },
    };
    notifyListeners(currentUser, userProfile);
    updateUserBtn(true);
    return;
  }

  loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) {
      if (verifyOverlayMode) return;
      hideLoginOverlay();
      if (authReject) {
        authReject(new Error('Login abgebrochen'));
        authResolve = null;
        authReject = null;
      }
    }
  });

  document.getElementById('loginCloseBtn')?.addEventListener('click', () => {
    if (verifyOverlayMode) return;
    hideLoginOverlay();
    if (authReject) {
      authReject(new Error('Login abgebrochen'));
      authResolve = null;
      authReject = null;
    }
  });

  onAuthStateChanged(auth, async user => {
    if (!authStateResolved) {
      authStateResolved = true;
      firstAuthResolve(user);
    }
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

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function updateUserDisplayName(name) {
  if (!currentUser) throw new Error('Nicht eingeloggt');
  await updateProfile(currentUser, { displayName: name });
  await refreshUserProfile();
}

export async function updateUserEmail(newEmail) {
  if (!currentUser) throw new Error('Nicht eingeloggt');
  await updateEmail(currentUser, newEmail);
}

export async function changeUserPassword(currentPassword, newPassword) {
  if (!currentUser) throw new Error('Nicht eingeloggt');
  const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, newPassword);
}

export async function reauthenticateUser(password) {
  if (!currentUser) throw new Error('Nicht eingeloggt');
  const credential = EmailAuthProvider.credential(currentUser.email, password);
  await reauthenticateWithCredential(currentUser, credential);
}

export async function deleteAccount(password) {
  if (!currentUser) throw new Error('Nicht eingeloggt');
  const credential = EmailAuthProvider.credential(currentUser.email, password);
  await reauthenticateWithCredential(currentUser, credential);
  await deleteUserData(currentUser.uid);
  await deleteUser(currentUser);
}

let pendingRedirect = null;

export function setPendingRedirect(url) {
  pendingRedirect = url;
  try { sessionStorage.setItem('vto_pending_redirect', url); } catch (_) {}
}

export function consumePendingRedirect() {
  if (pendingRedirect) {
    const url = pendingRedirect;
    pendingRedirect = null;
    try { sessionStorage.removeItem('vto_pending_redirect'); } catch (_) {}
    return url;
  }
  try {
    const stored = sessionStorage.getItem('vto_pending_redirect');
    if (stored) {
      sessionStorage.removeItem('vto_pending_redirect');
      return stored;
    }
  } catch (_) {}
  return null;
}

window.loginWithEmail = loginWithEmail;
window.registerWithEmail = registerWithEmail;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.resetPassword = resetPassword;
window.updateUserDisplayName = updateUserDisplayName;
window.updateUserEmail = updateUserEmail;
window.changeUserPassword = changeUserPassword;
window.reauthenticateUser = reauthenticateUser;
window.deleteAccount = deleteAccount;
window.resendVerification = async function() {
  if (currentUser) {
    await sendEmailVerification(currentUser);
  }
};

// ============ Login-Overlay UI Logic ============

function initLoginUI() {
  const tabs = document.querySelectorAll('.login-tab');
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const errorEl = document.getElementById('loginError');
  const googleBtn = document.getElementById('loginGoogleBtn');
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const forgotSection = document.getElementById('forgotPasswordSection');
  const resetEmail = document.getElementById('resetEmail');
  const resetSubmitBtn = document.getElementById('resetSubmitBtn');
  const resetError = document.getElementById('resetError');
  const resetSuccess = document.getElementById('resetSuccess');
  const backToLoginBtn = document.getElementById('backToLoginBtn');

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

  forgotBtn?.addEventListener('click', () => {
    form.classList.add('hidden');
    document.querySelector('.login-tabs').classList.add('hidden');
    document.querySelector('.login-divider').classList.add('hidden');
    googleBtn.classList.add('hidden');
    forgotBtn.classList.add('hidden');
    forgotSection.classList.remove('hidden');
    resetEmail.value = emailInput.value.trim();
    resetError.textContent = '';
    resetSuccess.textContent = '';
  });

  backToLoginBtn?.addEventListener('click', () => {
    forgotSection.classList.add('hidden');
    form.classList.remove('hidden');
    document.querySelector('.login-tabs').classList.remove('hidden');
    document.querySelector('.login-divider').classList.remove('hidden');
    googleBtn.classList.remove('hidden');
    forgotBtn.classList.remove('hidden');
  });

  resetSubmitBtn?.addEventListener('click', async () => {
    const email = resetEmail.value.trim();
    if (!email) { resetError.textContent = 'Bitte E-Mail-Adresse eingeben.'; return; }
    resetSubmitBtn.disabled = true;
    resetSubmitBtn.innerHTML = `${icon('hourglass', 14)} Wird gesendet...`;
    resetError.textContent = '';
    resetSuccess.textContent = '';
    try {
      await resetPassword(email);
      resetSuccess.innerHTML = `${icon('mail', 14)} E-Mail zum Zurücksetzen gesendet. Bitte Postfach prüfen.`;
    } catch (err) {
      resetError.textContent = 'E-Mail oder Passwort ist falsch.'
    } finally {
      resetSubmitBtn.disabled = false;
      resetSubmitBtn.textContent = 'Reset-Link senden';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) { errorEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; errorEl.className = 'login-error'; return }

    const domainCheck = validateEmailDomain(email);
    if (!domainCheck.valid) {
      errorEl.textContent = domainCheck.reason;
      errorEl.className = 'login-error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `${icon('hourglass', 14)} ...`;
    errorEl.textContent = '';
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        const cred = await registerWithEmail(email, password);
        await sendEmailVerification(cred.user);
        showVerifyOverlay('registered', email);
      }
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'E-Mail bereits registriert. Bitte melde dich an.'
        : err.code === 'auth/weak-password' ? 'Passwort zu kurz (min. 6 Zeichen).'
        : err.code === 'auth/too-many-requests' ? 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.'
        : err.code === 'auth/popup-closed-by-user' ? 'Google-Anmeldung abgebrochen.'
        : err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' ? 'E-Mail oder Passwort ist falsch.'
        : err.message || 'Ein Fehler ist aufgetreten.';
      errorEl.textContent = msg;
      errorEl.className = 'login-error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
    }
  });

  googleBtn?.addEventListener('click', async () => {
    googleBtn.disabled = true;
    googleBtn.innerHTML = `${icon('hourglass', 14)} ...`;
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
