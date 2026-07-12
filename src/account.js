import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout, updateUserDisplayName, updateUserEmail, changeUserPassword, deleteAccount, reauthenticateUser } from './auth.js';
import { getUserGenerations } from './firestore.js';
import { onRouteChange, getCurrentPath, navigateTo } from './router.js';
import { PLANS, renderPlanComparison } from './plans.js';
import { showToast } from './utils.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

const MOCK_HISTORY = [
  { mode: 'combined', quality: 'hoch', itemCount: 3, date: '2026-07-10' },
  { mode: 'single', quality: 'mittel', itemCount: 2, date: '2026-07-08' },
  { mode: 'single', quality: 'hoch', itemCount: 1, date: '2026-07-05' },
  { mode: 'combined', quality: 'mittel', itemCount: 2, date: '2026-06-28' },
  { mode: 'single', quality: 'niedrig', itemCount: 1, date: '2026-06-20' },
];

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
    if (DEV_MODE) {
      historyList.innerHTML = MOCK_HISTORY.map(e => `
        <div class="account-history-item">
          <span class="account-history-date">${e.date}</span>
          <span class="account-history-info">${e.mode === 'combined' ? 'Kombiniert' : e.itemCount + ' Einzelbilder'} · ${e.quality}</span>
        </div>
      `).join('');
    } else {
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
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      navigateTo('/');
    };
  }

  const nameInput = document.getElementById('accountDisplayName');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const nameMessage = document.getElementById('nameMessage');
  if (nameInput && profile) {
    nameInput.value = profile.displayName || '';
  }
  if (saveNameBtn) {
    saveNameBtn.onclick = async () => {
      const name = nameInput.value.trim();
      if (!name) { nameMessage.textContent = 'Bitte einen Namen eingeben.'; nameMessage.className = 'account-settings-message error'; return; }
      saveNameBtn.disabled = true;
      try {
        await updateUserDisplayName(name);
        nameMessage.textContent = '✅ Name aktualisiert.'; nameMessage.className = 'account-settings-message success';
      } catch (err) {
        nameMessage.textContent = '❌ ' + (err.message || 'Fehler beim Speichern.'); nameMessage.className = 'account-settings-message error';
      } finally {
        saveNameBtn.disabled = false;
      }
    };
  }

  const emailInput = document.getElementById('accountNewEmail');
  const changeEmailBtn = document.getElementById('changeEmailBtn');
  const emailMessage = document.getElementById('emailMessage');
  if (changeEmailBtn) {
    changeEmailBtn.onclick = async () => {
      const newEmail = emailInput.value.trim();
      if (!newEmail || !newEmail.includes('@')) { emailMessage.textContent = 'Bitte gültige E-Mail eingeben.'; emailMessage.className = 'account-settings-message error'; return; }
      if (!confirm(`E-Mail-Adresse zu "${newEmail}" ändern? Eine Bestätigungs-Mail wird gesendet.`)) return;
      changeEmailBtn.disabled = true;
      try {
        await updateUserEmail(newEmail);
        emailMessage.textContent = '✅ E-Mail geändert. Bitte neue Adresse bestätigen.'; emailMessage.className = 'account-settings-message success';
        await refreshUserProfile();
      } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
          emailMessage.textContent = '⚠️ Bitte zuerst abmelden und erneut einloggen, dann E-Mail ändern.'; emailMessage.className = 'account-settings-message error';
        } else {
          emailMessage.textContent = '❌ ' + (err.message || 'Fehler beim Ändern.'); emailMessage.className = 'account-settings-message error';
        }
      } finally {
        changeEmailBtn.disabled = false;
      }
    };
  }

  const currentPasswordInput = document.getElementById('accountCurrentPassword');
  const newPasswordInput = document.getElementById('accountNewPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const passwordMessage = document.getElementById('passwordMessage');
  if (changePasswordBtn) {
    changePasswordBtn.onclick = async () => {
      const current = currentPasswordInput.value;
      const newPw = newPasswordInput.value;
      if (!current || !newPw) { passwordMessage.textContent = 'Bitte beide Felder ausfüllen.'; passwordMessage.className = 'account-settings-message error'; return; }
      if (newPw.length < 6) { passwordMessage.textContent = 'Neues Passwort muss min. 6 Zeichen lang sein.'; passwordMessage.className = 'account-settings-message error'; return; }
      changePasswordBtn.disabled = true;
      try {
        await changeUserPassword(current, newPw);
        passwordMessage.textContent = '✅ Passwort geändert.'; passwordMessage.className = 'account-settings-message success';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
      } catch (err) {
        passwordMessage.textContent = '❌ ' + (err.code === 'auth/wrong-password' ? 'Aktuelles Passwort ist falsch.' : err.message || 'Fehler beim Ändern.'); passwordMessage.className = 'account-settings-message error';
      } finally {
        changePasswordBtn.disabled = false;
      }
    };
  }

  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  const deleteModal = document.getElementById('deleteAccountModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteConfirmEmail = document.getElementById('deleteConfirmEmail');
  const deleteConfirmPassword = document.getElementById('deleteConfirmPassword');
  const deleteAccountError = document.getElementById('deleteAccountError');

  if (deleteAccountBtn) {
    deleteAccountBtn.onclick = () => {
      deleteModal.classList.add('visible');
      document.body.style.overflow = 'hidden';
      deleteConfirmEmail.value = profile?.email || '';
      deleteAccountError.textContent = '';
    };
  }
  if (cancelDeleteBtn) {
    cancelDeleteBtn.onclick = () => {
      deleteModal.classList.remove('visible');
      document.body.style.overflow = '';
    };
  }
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {
        deleteModal.classList.remove('visible');
        document.body.style.overflow = '';
      }
    });
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = async () => {
      const email = deleteConfirmEmail.value.trim();
      const password = deleteConfirmPassword.value;
      if (!email || !password) { deleteAccountError.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
      if (email !== profile?.email) { deleteAccountError.textContent = 'E-Mail stimmt nicht überein.'; return; }
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = '⏳ Wird gelöscht...';
      try {
        await deleteAccount(password);
        deleteModal.classList.remove('visible');
        document.body.style.overflow = '';
        showToast('Konto erfolgreich gelöscht.', 'success');
        navigateTo('/');
      } catch (err) {
        deleteAccountError.textContent = '❌ ' + (err.code === 'auth/wrong-password' ? 'Passwort ist falsch.' : err.message || 'Fehler beim Löschen.');
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Endgültig löschen';
      }
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
