import { requireAuth, currentUser, setPendingRedirect, waitForAuth } from './auth.js';
import { PRIVACY, IMPRINT, renderLegalContent } from './legal-content.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export const ROUTES = {
  HOME: '/',
  CREATE: '/anzeige-erstellen',
  ACCOUNT: '/account',
  PREISE: '/preise',
  PRIVACY: '/datenschutz',
  IMPRINT: '/impressum',
};

function isRouteProtected(path) {
  return path === ROUTES.ACCOUNT || path === ROUTES.CREATE;
}

let currentPath = window.location.pathname || '/';

const listeners = [];

export function onRouteChange(fn) {
  listeners.push(fn);
}

function notify(path) {
  listeners.forEach(fn => fn(path));
}

export function getCurrentPath() {
  return currentPath;
}

const ROUTE_TITLES = {
  [ROUTES.HOME]: 'Virtual Try-On',
  [ROUTES.CREATE]: 'Anzeige erstellen – Virtual Try-On',
  [ROUTES.ACCOUNT]: 'Mein Konto – Virtual Try-On',
  [ROUTES.PREISE]: 'Preise – Virtual Try-On',
  [ROUTES.PRIVACY]: 'Datenschutzerklärung – Virtual Try-On',
  [ROUTES.IMPRINT]: 'Impressum – Virtual Try-On',
};

function showRoute(path) {
  document.documentElement.removeAttribute('id');
  document.title = ROUTE_TITLES[path] || 'Virtual Try-On';
  const homeEl = document.getElementById('route-home');
  const createEl = document.getElementById('route-create');
  const accountEl = document.getElementById('route-account');
  const preiseEl = document.getElementById('route-preise');
  const privacyEl = document.getElementById('route-datenschutz');
  const imprintEl = document.getElementById('route-impressum');
  if (homeEl) homeEl.classList.toggle('hidden', path !== ROUTES.HOME);
  if (createEl) createEl.classList.toggle('hidden', path !== ROUTES.CREATE);
  if (accountEl) accountEl.classList.toggle('hidden', path !== ROUTES.ACCOUNT);
  if (preiseEl) preiseEl.classList.toggle('hidden', path !== ROUTES.PREISE);
  if (privacyEl) privacyEl.classList.toggle('hidden', path !== ROUTES.PRIVACY);
  if (imprintEl) imprintEl.classList.toggle('hidden', path !== ROUTES.IMPRINT);
  if (path === ROUTES.PRIVACY) {
    const container = document.getElementById('privacyContent');
    if (container) renderLegalContent(container, PRIVACY);
  }
  if (path === ROUTES.IMPRINT) {
    const container = document.getElementById('imprintContent');
    if (container) renderLegalContent(container, IMPRINT);
  }
}

export async function navigateTo(path) {
  if (path === currentPath) return;
  if (!DEV_MODE && isRouteProtected(path) && !currentUser) {
    try {
      setPendingRedirect(path);
      await requireAuth();
    } catch {
      return;
    }
  }
  window.history.pushState({ path }, '', path);
  currentPath = path;
  showRoute(path);
  notify(path);
}

function handlePopState(e) {
  const path = e.state?.path || window.location.pathname || '/';
  currentPath = path;
  showRoute(path);
  notify(path);
}

async function initRouter() {
  window.addEventListener('popstate', handlePopState);
  const validPaths = Object.values(ROUTES);
  if (!validPaths.includes(currentPath)) {
    currentPath = ROUTES.HOME;
    window.history.replaceState({ path: currentPath }, '', currentPath);
  }
  if (!DEV_MODE && isRouteProtected(currentPath)) {
    await waitForAuth();
  }
  showRoute(currentPath);
}

initRouter();

window.navigateTo = navigateTo;
