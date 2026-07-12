import { requireAuth, currentUser, setPendingRedirect, waitForAuth } from './auth.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export const ROUTES = {
  HOME: '/',
  ACCOUNT: '/account',
};

function isRouteProtected(path) {
  return path === ROUTES.ACCOUNT;
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

function showRoute(path) {
  const homeEl = document.getElementById('route-home');
  const accountEl = document.getElementById('route-account');
  if (homeEl) homeEl.classList.toggle('hidden', path !== ROUTES.HOME);
  if (accountEl) accountEl.classList.toggle('hidden', path !== ROUTES.ACCOUNT);
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
  if (!DEV_MODE && isRouteProtected(path) && !currentUser) {
    currentPath = ROUTES.HOME;
    window.history.replaceState({ path: currentPath }, '', currentPath);
    showRoute(currentPath);
    notify(currentPath);
    return;
  }
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
    if (!currentUser) {
      currentPath = ROUTES.HOME;
      window.history.replaceState({ path: currentPath }, '', currentPath);
    }
  }
  showRoute(currentPath);
}

initRouter();

window.navigateTo = navigateTo;
