import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout, updateUserEmail, changeUserPassword, deleteAccount, reauthenticateUser } from './auth.js';
import { getUserGenerations, deleteGeneration } from './firestore.js';
import { onRouteChange, getCurrentPath, navigateTo } from './router.js';
import { PLANS } from './plans.js';
import { showToast } from './utils.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

const MOCK_HISTORY = [
  { id: 'm1',  mode: 'combined', quality: 'hoch',    itemCount: 3, imageCount: 2, clothingType: 'T-Shirt', notes: 'T-Shirt + Jeans für Sommerlook', date: '2026-07-12' },
  { id: 'm2',  mode: 'single',   quality: 'mittel',  itemCount: 2, imageCount: 2, clothingType: 'Kleid',   notes: 'Kleid für Hochzeit',             date: '2026-07-11' },
  { id: 'm3',  mode: 'combined', quality: 'hoch',    itemCount: 1, imageCount: 1, clothingType: 'Bluse',   notes: 'Bluse für Bewerbungsfoto',        date: '2026-07-10' },
  { id: 'm4',  mode: 'single',   quality: 'niedrig', itemCount: 4, imageCount: 3, clothingType: 'Outfit',  notes: 'Komplettes Outfit',               date: '2026-07-08' },
  { id: 'm5',  mode: 'combined', quality: 'hoch',    itemCount: 2, imageCount: 2, clothingType: 'Hose',    notes: '',                               date: '2026-07-05' },
  { id: 'm6',  mode: 'single',   quality: 'mittel',  itemCount: 1, imageCount: 1, clothingType: 'Jacke',   notes: 'Schnelltest',                    date: '2026-06-28' },
  { id: 'm7',  mode: 'combined', quality: 'hoch',    itemCount: 3, imageCount: 2, clothingType: 'Jacke',   notes: 'Winterjacke für Vinted',         date: '2026-06-20' },
  { id: 'm8',  mode: 'single',   quality: 'niedrig', itemCount: 2, imageCount: 1, clothingType: 'Schuhe',  notes: '',                               date: '2026-06-15' },
  { id: 'm9',  mode: 'combined', quality: 'mittel',  itemCount: 5, imageCount: 4, clothingType: 'Outfit',  notes: 'Ganzer Schrank',                 date: '2026-06-10' },
  { id: 'm10', mode: 'single',   quality: 'hoch',    itemCount: 1, imageCount: 1, clothingType: 'Bluse',   notes: 'Vintage Designerstück',          date: '2026-06-05' },
];

function renderAccount(profile) {
  const emailEl = document.getElementById('accountEmail');
  const emailDisplayEl = document.getElementById('accountEmailDisplay');
  const avatarEl = document.getElementById('accountAvatar');
  const memberSinceEl = document.getElementById('accountMemberSince');
  const planBadge = document.getElementById('accountPlanBadge');
  const donutFill = document.getElementById('accountDonutFill');
  const donutCount = document.getElementById('accountDonutCount');
  const donutMax = document.getElementById('accountDonutMax');
  const donutLabel = document.getElementById('accountDonutLabel');
  const historyList = document.getElementById('accountHistoryList');
  const logoutBtn = document.getElementById('accountLogoutBtn');
  const cards = document.getElementById('accountProfile');
  const placeholder = document.getElementById('accountPlaceholder');
  const skeleton = document.getElementById('accountSkeleton');

  if (!profile) {
    if (skeleton) skeleton.classList.add('hidden');
    if (cards) cards.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }

  if (skeleton) skeleton.classList.add('hidden');
  if (cards) cards.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');

  if (emailEl) emailEl.textContent = profile.email || 'Keine E-Mail';
  if (emailDisplayEl) emailDisplayEl.textContent = profile.email || 'Keine E-Mail';
  if (avatarEl) avatarEl.textContent = (profile.email?.[0] || '?').toUpperCase();

  if (memberSinceEl && profile.createdAt?.toDate) {
    const d = profile.createdAt.toDate();
    memberSinceEl.textContent = `Mitglied seit ${d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
  }

  const subKey = profile.subscription || 'free';
  const sub = PLANS[subKey] || PLANS.free;

  if (planBadge) {
    planBadge.innerHTML = `${sub.label} <span class="plan-badge-limit">· ${sub.limit === -1 ? '∞' : sub.limit + '/Monat'}</span>`;
    planBadge.style.setProperty('--plan-color', sub.color);
    planBadge.style.setProperty('--plan-color-dim', `${sub.color}18`);
  }

  const used = profile.generationsUsed || 0;
  const max = sub.limit === -1 ? '∞' : sub.limit;
  const pct = sub.limit === -1 ? 100 : Math.min((used / sub.limit) * 100, 100);
  const remaining = sub.limit === -1 ? -1 : sub.limit - used;

  if (donutCount) donutCount.textContent = used;
  if (donutMax) donutMax.textContent = max;

  if (donutLabel) {
    donutLabel.textContent = remaining === -1
      ? `Unbegrenzte Generierungen`
      : `Noch ${remaining} Generierungen`;
  }

  if (donutFill) {
    const circumference = 314.159;
    const offset = circumference * (1 - pct / 100);
    donutFill.classList.remove('account-donut-fill--critical', 'account-donut-fill--low');
    if (remaining >= 0 && remaining <= 2) {
      donutFill.classList.add('account-donut-fill--critical');
    } else if (remaining >= 0 && remaining <= 5) {
      donutFill.classList.add('account-donut-fill--low');
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        donutFill.style.strokeDashoffset = offset;
      });
    });
  }

  const historyStats = document.getElementById('accountHistoryStats');
  if (historyList && currentUser) {
    let allEntries = [];
    let activeFilters = { mode: 'all', clothing: 'all', time: 'all', search: '' };

    const renderStats = (entries) => {
      const now = new Date();
      const total = entries.length;
      const thisMonth = entries.filter(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.date + 'T00:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      const combined = entries.filter(e => e.mode === 'combined').length;
      const single = entries.filter(e => e.mode === 'single').length;

      const statTotal = document.getElementById('statTotal');
      const statMonth = document.getElementById('statMonth');
      const statCombined = document.getElementById('statCombined');
      const statSingle = document.getElementById('statSingle');
      if (statTotal) statTotal.textContent = total;
      if (statMonth) statMonth.textContent = thisMonth;
      if (statCombined) statCombined.textContent = combined;
      if (statSingle) statSingle.textContent = single;
    };

    const renderClothingFilters = (entries) => {
      const sel = document.getElementById('filterClothing');
      if (!sel) return;
      const prev = sel.value;
      const types = [...new Set(entries.map(e => e.clothingType).filter(Boolean))].sort();
      sel.innerHTML = `<option value="all">Alle</option>` +
        types.map(t => `<option value="${t}">${t}</option>`).join('');
      sel.value = types.includes(prev) ? prev : 'all';
    };

    const filterEntries = (entries) => {
      return entries.filter(e => {
        if (activeFilters.mode !== 'all' && e.mode !== activeFilters.mode) return false;
        if (activeFilters.clothing !== 'all' && e.clothingType !== activeFilters.clothing) return false;
        if (activeFilters.search) {
          const q = activeFilters.search.toLowerCase();
          const notes = (e.notes || '').toLowerCase();
          const type = (e.clothingType || '').toLowerCase();
          if (!notes.includes(q) && !type.includes(q)) return false;
        }
        if (activeFilters.time !== 'all') {
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.date + 'T00:00:00');
          const diffDays = (new Date() - d) / (1000 * 60 * 60 * 24);
          if (activeFilters.time === 'week' && diffDays > 7) return false;
          if (activeFilters.time === 'month' && (diffDays <= 7 || diffDays > 30)) return false;
          if (activeFilters.time === 'older' && diffDays <= 30) return false;
        }
        return true;
      });
    };

    const renderHistoryCards = (entries) => {
      const filtered = filterEntries(entries);
      const historyCount = document.getElementById('accountHistoryCount');
      if (historyCount) {
        historyCount.textContent = filtered.length === entries.length
          ? `${entries.length} Anzeige${entries.length !== 1 ? 'n' : ''}`
          : `${filtered.length} von ${entries.length} Anzeigen`;
      }

      if (filtered.length === 0) {
        historyList.innerHTML = `
          <div class="account-history-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h6M8 16h4"/></svg>
            <span>${entries.length === 0 ? 'Noch keine Anzeigen erstellt' : 'Keine Ergebnisse für diese Filter'}</span>
            ${entries.length === 0 ? '<button class="btn btn-sm btn-primary" onclick="navigateTo(\'/anzeige-erstellen\')">Jetzt erste Anzeige erstellen</button>' : ''}
          </div>`;
        return;
      }

      historyList.innerHTML = filtered.map(e => {
        const rawDate = e.createdAt?.toDate?.() || (e.date ? new Date(e.date + 'T00:00:00') : null);
        const date = rawDate
          ? `${String(rawDate.getDate()).padStart(2,'0')}/${String(rawDate.getMonth()+1).padStart(2,'0')}/${rawDate.getFullYear()}`
          : '–';
        const modeLabel = e.mode === 'combined' ? 'Kombiniert' : 'Einzelbilder';
        const modeClass = e.mode === 'combined' ? 'combined' : 'single';
        const qualityDot = `account-history-quality-dot--${e.quality || 'mittel'}`;
        const notes = e.notes || '';
        const hasNotes = notes.length > 0;
        const infoParts = [];
        if (e.clothingType) infoParts.push(e.clothingType);
        if (e.itemCount) infoParts.push(`${e.itemCount} Kleidungsstück${e.itemCount > 1 ? 'e' : ''}`);
        if (e.imageCount) infoParts.push(`${e.imageCount} Bild${e.imageCount > 1 ? 'er' : ''}`);
        const infoText = infoParts.join(' · ');

        return `<div class="account-history-card account-history-card--${modeClass}">
          <div class="account-history-top">
            <span class="account-history-badge account-history-badge--${modeClass}">${modeLabel}</span>
            <span class="account-history-quality-dot ${qualityDot}"></span>
            <span class="account-history-meta">
              <span>${date}</span>
            </span>
          </div>
          ${infoText ? `<div class="account-history-info">${infoText}</div>` : ''}
          ${hasNotes ? `<div class="account-history-notes">„${notes}"</div>` : ''}
          <div class="account-history-actions">
            <button class="account-history-delete" data-id="${e.id}" title="Eintrag löschen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Löschen
            </button>
          </div>
        </div>`;
      }).join('');

      historyList.querySelectorAll('.account-history-delete').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const id = btn.dataset.id;
          if (!confirm('Diesen Eintrag unwiderruflich löschen?')) return;
          try {
            if (!DEV_MODE) await deleteGeneration(currentUser.uid, id);
            allEntries = allEntries.filter(e => e.id !== id);
            renderStats(allEntries);
            renderClothingFilters(allEntries);
            renderHistoryCards(allEntries);
            showToast('Eintrag gelöscht.', 'success');
          } catch (_) {
            showToast('Fehler beim Löschen.', 'error');
          }
        });
      });
    };

    const applyFilters = () => renderHistoryCards(allEntries);

    const searchInput = document.getElementById('historySearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        applyFilters();
      });
    }

    document.getElementById('filterMode').addEventListener('change', (e) => {
      activeFilters.mode = e.target.value;
      applyFilters();
    });

    document.getElementById('filterClothing').addEventListener('change', (e) => {
      activeFilters.clothing = e.target.value;
      applyFilters();
    });

    document.getElementById('filterTime').addEventListener('change', (e) => {
      activeFilters.time = e.target.value;
      applyFilters();
    });

    const loadEntries = (entries) => {
      allEntries = entries;
      renderStats(entries);
      renderClothingFilters(entries);
      renderHistoryCards(entries);
    };

    if (DEV_MODE) {
      loadEntries(MOCK_HISTORY);
    } else {
      getUserGenerations(currentUser.uid, 50).then(entries => {
        loadEntries(entries.length > 0 ? entries : MOCK_HISTORY);
      }).catch(() => {
        loadEntries(MOCK_HISTORY);
      });
    }
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      navigateTo('/');
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

  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.innerHTML = isPassword
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  });

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

  const exportDataBtn = document.getElementById('exportDataBtn');
  const exportModal = document.getElementById('dataExportModal');
  const cancelExportBtn = document.getElementById('cancelExportBtn');
  const confirmExportBtn = document.getElementById('confirmExportBtn');
  const dataExportPreview = document.getElementById('dataExportPreview');

  if (exportDataBtn) {
    exportDataBtn.onclick = async () => {
      exportModal.classList.add('visible');
      document.body.style.overflow = 'hidden';
      dataExportPreview.innerHTML = '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>';

      const subKey = profile?.subscription || 'free';
      const sub = PLANS[subKey] || PLANS.free;
      let generations = [];
      try {
        generations = DEV_MODE
          ? MOCK_HISTORY
          : await getUserGenerations(currentUser.uid, 100);
      } catch (_) {}

      let html = '';

      html += '<div class="data-export-section">';
      html += '<h4>Profil</h4>';
      html += `<div class="data-export-item"><span class="data-export-label">E-Mail</span><span class="data-export-value">${profile?.email || '–'}</span></div>`;
      html += `<div class="data-export-item"><span class="data-export-label">Anzeigename</span><span class="data-export-value">${profile?.displayName || '–'}</span></div>`;
      html += `<div class="data-export-item"><span class="data-export-label">Abo</span><span class="data-export-value">${sub.label}</span></div>`;
      if (profile?.createdAt?.toDate) {
        const d = profile.createdAt.toDate();
        html += `<div class="data-export-item"><span class="data-export-label">Registriert am</span><span class="data-export-value">${d.toLocaleDateString('de-DE')}</span></div>`;
      }
      html += '</div>';

      html += '<div class="data-export-section">';
      html += '<h4>Nutzung</h4>';
      const used = profile?.generationsUsed || 0;
      const max = sub.limit === -1 ? '∞' : sub.limit;
      html += `<div class="data-export-item"><span class="data-export-label">Generierungen</span><span class="data-export-value">${used} / ${max}</span></div>`;
      html += '</div>';

      html += '<div class="data-export-section">';
      html += '<h4>Generierungsverlauf</h4>';
      if (generations.length === 0) {
        html += '<div class="data-export-empty">Noch keine Generierungen vorhanden.</div>';
      } else {
        generations.forEach(e => {
          const date = e.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || e.date || '–';
          const info = e.mode === 'combined' ? 'Kombiniert' : `${e.itemCount || '?'} Einzelbilder`;
          html += `<div class="data-export-item"><span class="data-export-label">${date}</span><span class="data-export-value">${info} · ${e.quality || 'mittel'}</span></div>`;
        });
      }
      html += '</div>';

      dataExportPreview.innerHTML = html;
    };
  }
  if (cancelExportBtn) {
    cancelExportBtn.onclick = () => {
      exportModal.classList.remove('visible');
      document.body.style.overflow = '';
    };
  }
  if (exportModal) {
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        exportModal.classList.remove('visible');
        document.body.style.overflow = '';
      }
    });
  }
  if (confirmExportBtn) {
    confirmExportBtn.onclick = async () => {
      const subKey = profile?.subscription || 'free';
      const sub = PLANS[subKey] || PLANS.free;
      let generations = [];
      try {
        generations = DEV_MODE
          ? MOCK_HISTORY
          : await getUserGenerations(currentUser.uid, 100);
      } catch (_) {}

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: {
          email: profile?.email || null,
          displayName: profile?.displayName || null,
          subscription: subKey,
          generationsUsed: profile?.generationsUsed || 0,
          generationLimit: sub.limit,
          createdAt: profile?.createdAt?.toDate?.()?.toISOString() || null,
        },
        generations: generations.map(e => ({
          date: e.createdAt?.toDate?.()?.toISOString() || null,
          mode: e.mode || null,
          quality: e.quality || null,
          itemCount: e.itemCount || null,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `virtual-try-on-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export heruntergeladen.', 'success');
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
    const skeleton = document.getElementById('accountSkeleton');
    const cards = document.getElementById('accountProfile');
    const placeholder = document.getElementById('accountPlaceholder');
    if (skeleton) skeleton.classList.remove('hidden');
    if (cards) cards.classList.add('hidden');
    if (placeholder) placeholder.classList.add('hidden');
    refreshUserProfile().then(profile => {
      renderAccount(profile);
    });
  }
});
