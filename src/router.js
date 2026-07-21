import { requireAuth, currentUser, setPendingRedirect, waitForAuth } from './auth.js';
import { PRIVACY, IMPRINT, renderLegalContent } from './legal-content.js';
import { renderIconElements } from './icons.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export const ROUTES = {
  HOME: '/',
  CREATE: '/anzeige-erstellen',
  ACCOUNT: '/account',
  PREISE: '/preise',
  PRIVACY: '/datenschutz',
  IMPRINT: '/impressum',
  NOT_FOUND: '/404',
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

const loader = document.getElementById('routeLoader');
let loaderTimer = null;

function showLoader() {
  if (!loader) return;
  loader.classList.add('active');
  if (loaderTimer) clearTimeout(loaderTimer);
  loaderTimer = setTimeout(() => loader.classList.remove('active'), 800);
}

function hideLoader() {
  if (!loader) return;
  loader.classList.remove('active');
  if (loaderTimer) clearTimeout(loaderTimer);
}

function focusAppContainer() {
  const el = document.getElementById('appContainer');
  if (el) {
    el.focus({ preventScroll: true });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  }
}

function showRoute(path) {
  document.documentElement.removeAttribute('id');
  const isValid = Object.values(ROUTES).includes(path);
  if (!isValid) path = ROUTES.NOT_FOUND;
  document.title = ROUTE_TITLES[path] || 'Seite nicht gefunden – Virtual Try-On';
  const homeEl = document.getElementById('route-home');
  const createEl = document.getElementById('route-create');
  const accountEl = document.getElementById('route-account');
  const preiseEl = document.getElementById('route-preise');
  const privacyEl = document.getElementById('route-datenschutz');
  const imprintEl = document.getElementById('route-impressum');
  const notFoundEl = document.getElementById('route-404');
  if (homeEl) homeEl.classList.toggle('hidden', path !== ROUTES.HOME);
  if (createEl) createEl.classList.toggle('hidden', path !== ROUTES.CREATE);
  if (accountEl) accountEl.classList.toggle('hidden', path !== ROUTES.ACCOUNT);
  if (preiseEl) preiseEl.classList.toggle('hidden', path !== ROUTES.PREISE);
  if (privacyEl) privacyEl.classList.toggle('hidden', path !== ROUTES.PRIVACY);
  if (imprintEl) imprintEl.classList.toggle('hidden', path !== ROUTES.IMPRINT);
  if (notFoundEl) notFoundEl.classList.toggle('hidden', path !== ROUTES.NOT_FOUND);
  if (path === ROUTES.PRIVACY) {
    const container = document.getElementById('privacyContent');
    if (container) renderLegalContent(container, PRIVACY);
  }
  if (path === ROUTES.IMPRINT) {
    const container = document.getElementById('imprintContent');
    if (container) renderLegalContent(container, IMPRINT);
  }
  renderIconElements();
  hideLoader();
  focusAppContainer();
}

export async function navigateTo(path) {
  if (path === currentPath) return;
  showLoader();
  if (!DEV_MODE && isRouteProtected(path) && !currentUser) {
    try {
      setPendingRedirect(path);
      await requireAuth();
    } catch {
      hideLoader();
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
  const validPaths = Object.values(ROUTES);
  currentPath = validPaths.includes(path) ? path : ROUTES.NOT_FOUND;
  showRoute(currentPath);
  notify(currentPath);
}

async function initRouter() {
  window.addEventListener('popstate', handlePopState);
  const validPaths = Object.values(ROUTES);
  if (!validPaths.includes(currentPath)) {
    currentPath = ROUTES.NOT_FOUND;
    window.history.replaceState({ path: currentPath }, '', currentPath);
  }
  if (!DEV_MODE && isRouteProtected(currentPath)) {
    await waitForAuth();
  }
  showRoute(currentPath);
}

initRouter();

window.navigateTo = navigateTo;
