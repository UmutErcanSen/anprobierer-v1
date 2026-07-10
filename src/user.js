import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout } from './auth.js';
import { getUserGenerations } from './firestore.js';

const SUBSCRIPTION_LABELS = {
  free: { label: 'Gratis', limit: 5, color: '#71717a' },
  basic: { label: 'Basic', limit: 50, color: '#22c55e' },
  pro: { label: 'Pro', limit: -1, color: '#f59e0b' },
};

function renderProfile(profile) {
  const emailEl = document.getElementById('userEmail');
  const planEl = document.getElementById('userPlan');
  const planBadge = document.getElementById('userPlanBadge');
  const usageBar = document.getElementById('userUsageBar');
  const usageLabel = document.getElementById('userUsageLabel');
  const historyList = document.getElementById('userHistoryList');
  const logoutBtn = document.getElementById('userLogoutBtn');

  if (!profile) {
    if (emailEl) emailEl.textContent = 'Nicht angemeldet';
    if (planEl) planEl.textContent = '–';
    return;
  }

  if (emailEl) emailEl.textContent = profile.email || 'Keine E-Mail';
  const sub = SUBSCRIPTION_LABELS[profile.subscription] || SUBSCRIPTION_LABELS.free;
  if (planBadge) {
    planBadge.textContent = sub.label;
    planBadge.style.color = sub.color;
  }

  const used = profile.generationsUsed || 0;
  const max = sub.limit === -1 ? '∞' : sub.limit;
  const pct = sub.limit === -1 ? 0 : Math.min((used / sub.limit) * 100, 100);
  if (usageBar) usageBar.style.width = `${pct}%`;
  if (usageLabel) usageLabel.textContent = `${used} / ${max} Generierungen`;

  // History
  if (historyList && currentUser) {
    getUserGenerations(currentUser.uid, 10).then(entries => {
      if (entries.length === 0) {
        historyList.innerHTML = '<div class="user-history-empty">Noch keine Generierungen</div>';
        return;
      }
      historyList.innerHTML = entries.map(e => {
        const date = e.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || '–';
        return `<div class="user-history-item">
          <span class="user-history-date">${date}</span>
          <span class="user-history-info">${e.mode === 'combined' ? 'Kombiniert' : `${e.itemCount} Einzelbilder`} · ${e.quality || 'mittel'}</span>
        </div>`;
      }).join('');
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      closeUserModal();
    };
  }
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.remove('visible');
}

onAuthChange((user, profile) => {
  if (profile) renderProfile(profile);
});

export function openUserModal() {
  const modal = document.getElementById('userModal');
  const placeholder = document.getElementById('userPlaceholder');
  if (!modal) return;
  if (placeholder) placeholder.style.display = 'none';

  refreshUserProfile().then(profile => {
    if (!profile) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = '<p class="user-hint">Bitte einloggen, um dein Profil zu sehen.</p>';
      }
      return;
    }
    renderProfile(profile);
  });

  modal.classList.add('visible');
}

window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
