import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout } from './auth.js';
import { getUserGenerations } from './firestore.js';
import { onRouteChange, getCurrentPath, navigateTo } from './router.js';
import { PLANS, renderPlanComparison } from './plans.js';
import { requireAuth } from './auth.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

function renderAccount(profile) {
  const emailEl = document.getElementById('accountEmail');
  const avatarEl = document.getElementById('accountAvatar');
  const memberSinceEl = document.getElementById('accountMemberSince');
  const planBadge = document.getElementById('accountPlanBadge');
  const usageBar = document.getElementById('accountUsageBar');
  const usageLabel = document.getElementById('accountUsageLabel');
  const historyList = document.getElementById('accountHistoryList');
  const logoutBtn = document.getElementById('accountLogoutBtn');
  const cards = document.getElementById('accountProfile');
  const placeholder = document.getElementById('accountPlaceholder');

  if (!profile) {
    if (cards) cards.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }

  if (cards) cards.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');

  if (emailEl) emailEl.textContent = profile.email || 'Keine E-Mail';
  if (avatarEl) avatarEl.textContent = (profile.email?.[0] || '?').toUpperCase();

  if (memberSinceEl && profile.createdAt?.toDate) {
    const d = profile.createdAt.toDate();
    memberSinceEl.textContent = `Mitglied seit ${d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
  }

  const subKey = profile.subscription || 'free';
  const sub = PLANS[subKey] || PLANS.free;

  if (planBadge) {
    planBadge.innerHTML = `${sub.emoji} ${sub.label} <span class="plan-badge-limit">· ${sub.limit === -1 ? '∞' : sub.limit + '/Monat'}</span>`;
    planBadge.style.setProperty('--plan-color', sub.color);
    planBadge.style.setProperty('--plan-color-dim', `${sub.color}18`);
  }

  const used = profile.generationsUsed || 0;
  const max = sub.limit === -1 ? '∞' : sub.limit;
  const pct = sub.limit === -1 ? 100 : Math.min((used / sub.limit) * 100, 100);
  const remaining = sub.limit === -1 ? -1 : sub.limit - used;

  if (usageLabel) usageLabel.textContent = `${used} / ${max} Generierungen`;

  if (usageBar) {
    usageBar.style.width = '0%';
    usageBar.classList.remove('account-usage-fill--critical');
    usageBar.classList.remove('account-usage-fill--low');
    if (remaining >= 0 && remaining <= 2) {
      usageBar.classList.add('account-usage-fill--critical');
    } else if (remaining >= 0 && remaining <= 5) {
      usageBar.classList.add('account-usage-fill--low');
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        usageBar.style.width = `${pct}%`;
      });
    });
  }

  if (remaining > 0 && remaining <= 2) {
    if (usageLabel) usageLabel.textContent += ` · ⚠️ nur noch ${remaining}`;
  }

  const compEl = document.getElementById('accountPlanComparison');
  if (compEl) {
    renderPlanComparison(compEl, subKey, { showUpgradeBtn: true });
  }

  if (historyList && currentUser) {
    getUserGenerations(currentUser.uid, 20).then(entries => {
      if (entries.length === 0) {
        historyList.innerHTML = '<div class="account-history-empty">Noch keine Generierungen</div>';
        return;
      }
      historyList.innerHTML = entries.map(e => {
        const date = e.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || '–';
        const info = e.mode === 'combined' ? 'Kombiniert' : `${e.itemCount || '?'} Einzelbilder`;
        return `<div class="account-history-item">
          <span class="account-history-date">${date}</span>
          <span class="account-history-info">${info} · ${e.quality || 'mittel'}</span>
        </div>`;
      }).join('');
    }).catch(() => {
      historyList.innerHTML = '<div class="account-history-empty">Fehler beim Laden</div>';
    });
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      navigateTo('/');
    };
  }
}

onAuthChange((user, profile) => {
  if (getCurrentPath() === '/account') {
    renderAccount(profile);
  }
});

onRouteChange((path) => {
  if (path === '/account') {
    refreshUserProfile().then(profile => {
      renderAccount(profile);
    });
  }
});

window.handleAccountClick = async function () {
  if (DEV_MODE || currentUser) {
    navigateTo('/account');
  } else {
    try {
      await requireAuth();
      navigateTo('/account');
    } catch {
      // user closed overlay – stay on current page
    }
  }
};
