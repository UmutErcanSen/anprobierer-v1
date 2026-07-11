import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout } from './auth.js';
import { getUserGenerations } from './firestore.js';
import { onRouteChange, getCurrentPath, navigateTo } from './router.js';

const SUBSCRIPTION_LABELS = {
  free: { label: 'Gratis', limit: 5, color: '#71717a' },
  basic: { label: 'Basic', limit: 50, color: '#22c55e' },
  pro: { label: 'Pro', limit: -1, color: '#f59e0b' },
};

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

  const sub = SUBSCRIPTION_LABELS[profile.subscription] || SUBSCRIPTION_LABELS.free;
  if (planBadge) {
    planBadge.textContent = sub.label;
    planBadge.style.color = sub.color;
    planBadge.style.borderColor = sub.color;
    planBadge.style.background = `${sub.color}15`;
  }

  const used = profile.generationsUsed || 0;
  const max = sub.limit === -1 ? '∞' : sub.limit;
  const pct = sub.limit === -1 ? 100 : Math.min((used / sub.limit) * 100, 100);
  if (usageBar) usageBar.style.width = `${pct}%`;
  if (usageLabel) usageLabel.textContent = `${used} / ${max} Generierungen`;

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
