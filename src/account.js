import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout, updateUserEmail, changeUserPassword, deleteAccount, reauthenticateUser } from './auth.js';
import { getUserGenerations, deleteGeneration } from './firestore.js';
import { cancelPlan, reactivatePlan } from './subscription.js';
import { onRouteChange, getCurrentPath, navigateTo } from './router.js';
import { PLANS } from './plans.js';
import { showToast } from './utils.js';
import { icon, renderIconElements } from './icons.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

let _statsTabVisited = false;

function animateCounter(elId, target, duration = 2500) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = performance.now();
  let lastVal = -1;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    let display = Math.min(Math.round(target * eased), target);
    if (display > lastVal + 1) display = lastVal + 1;
    if (display < lastVal) display = lastVal;
    lastVal = display;
    el.textContent = display;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target;
    }
  }
  requestAnimationFrame(tick);
}

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
    const iconMap = { free: 'star', basic: 'layers', pro: 'crown' };
    const planIcon = icon(iconMap[subKey] || 'star', 16);
    planBadge.innerHTML = `${planIcon} ${sub.label} <span class="plan-badge-limit">· ${sub.limit === -1 ? '∞' : sub.limit + '/Monat'}</span>`;
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
    if (remaining === -1) {
      donutLabel.textContent = `Unbegrenzte Anzeigen diesen Monat`;
    } else {
      donutLabel.textContent = `Du hast ${used} von ${max} Anzeigen diesen Monat erstellt`;
    }
  }

  if (donutFill) {
    const circumference = 314.159;
    const offset = circumference * (1 - pct / 100);
    const container = donutFill.closest('.account-donut-container');
    container?.classList.remove('account-donut-container--glow-attention', 'account-donut-container--glow-warning', 'account-donut-container--glow-critical');
    donutFill.classList.remove('account-donut-fill--attention', 'account-donut-fill--warning', 'account-donut-fill--critical');
    if (remaining !== -1) {
      if (pct >= 100) {
        donutFill.classList.add('account-donut-fill--critical');
        container?.classList.add('account-donut-container--glow-critical');
      } else if (pct >= 80) {
        donutFill.classList.add('account-donut-fill--warning');
        container?.classList.add('account-donut-container--glow-warning');
      } else if (pct >= 60) {
        donutFill.classList.add('account-donut-fill--attention');
        container?.classList.add('account-donut-container--glow-attention');
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        donutFill.style.strokeDashoffset = offset;
      });
    });
  }

  renderSubscriptionInfo(profile, subKey, sub);
  const upgradeBanner = document.getElementById('accountUpgradeBanner');
  if (upgradeBanner) {
    const limitReached = sub.limit !== -1 && used >= sub.limit;
    if (limitReached && subKey === 'free') {
      upgradeBanner.classList.remove('hidden');
    } else {
      upgradeBanner.classList.add('hidden');
    }
  }

  const historyStats = document.getElementById('accountHistoryStats');
  if (historyList && currentUser) {
    let allEntries = [];
    let activeFilters = { mode: 'all', clothing: 'all', time: 'all', search: '' };

    const renderStats = (entries, animate = true) => {
      const now = new Date();
      const total = entries.length;
      const thisMonth = entries.filter(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.date + 'T00:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      const combined = entries.filter(e => e.mode === 'combined').length;
      const single = entries.filter(e => e.mode === 'single').length;
      const today = entries.filter(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.date + 'T00:00:00');
        return d.toDateString() === now.toDateString();
      }).length;

      if (animate) {
        animateCounter('statTotal', total);
        animateCounter('statMonth', thisMonth);
        animateCounter('statCombined', combined);
        animateCounter('statSingle', single);
      } else {
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statMonth').textContent = thisMonth;
        document.getElementById('statCombined').textContent = combined;
        document.getElementById('statSingle').textContent = single;
      }

      const trendEl = document.getElementById('statTotalTrend');
      if (trendEl) {
        trendEl.textContent = today > 0 ? `+${today} heute` : '';
        trendEl.style.display = today > 0 ? '' : 'none';
      }
    };

    const renderClothingFilters = (entries) => {
      const types = [...new Set(entries.map(e => e.clothingType).filter(Boolean))].sort();
      const options = `<option value="all">Alle</option>` + types.map(t => `<option value="${t}">${t}</option>`).join('');

      const mobileSel = document.getElementById('filterClothingMobile');
      if (mobileSel) {
        const prev = mobileSel.value;
        mobileSel.innerHTML = options;
        mobileSel.value = types.includes(prev) ? prev : 'all';
      }

      const desktopContainer = document.getElementById('filterClothingDesktop');
      if (desktopContainer) {
        desktopContainer.innerHTML = `<button class="account-filter-badge active" data-filter="all">Alle</button>` +
          types.map(t => `<button class="account-filter-badge" data-filter="${t}">${t}</button>`).join('');
        desktopContainer.querySelectorAll('.account-filter-badge').forEach(btn => {
          btn.addEventListener('click', () => {
            desktopContainer.querySelectorAll('.account-filter-badge').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilters.clothing = btn.dataset.filter;
            syncSelectsFromFilters();
            applyFilters();
          });
        });
      }
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
            ${icon('scroll-text', 40)}
            <span>${entries.length === 0 ? 'Noch keine Anzeigen erstellt' : 'Keine Ergebnisse für diese Filter'}</span>
            ${entries.length === 0 ? '<button class="btn btn-sm btn-primary" onclick="navigateTo(\'/anzeige-erstellen\')">Jetzt erste Anzeige erstellen</button>' : ''}
          </div>`;
        return;
      }

      const cardsHtml = filtered.map(e => {
        const rawDate = e.createdAt?.toDate?.() || (e.date ? new Date(e.date + 'T00:00:00') : null);
        const date = rawDate
          ? `${String(rawDate.getDate()).padStart(2,'0')}/${String(rawDate.getMonth()+1).padStart(2,'0')}/${rawDate.getFullYear()}`
          : '–';
        const modeLabel = e.mode === 'combined' ? 'Kombiniert' : 'Einzelbild';
        const modeClass = e.mode === 'combined' ? 'combined' : 'single';
        const notes = e.notes || '';
        const hasNotes = notes.length > 0;
        const infoParts = [];
        if (e.clothingType) infoParts.push(e.clothingType);
        if (e.itemCount) infoParts.push(`${e.itemCount} ${e.itemCount === 1 ? 'Kleidungsstück' : 'Kleidungsstücke'}`);
        if (e.imageCount) infoParts.push(`${e.imageCount} ${e.imageCount === 1 ? 'Bild' : 'Bilder'}`);
        const infoText = infoParts.join(' · ');

        return `<div class="ah-card ah-card--${modeClass}">
          <div class="ah-thumb${e.thumbnail ? '' : ' ah-thumb--' + modeClass}">
            ${e.thumbnail ? `<img class="ah-thumb-img" src="${e.thumbnail}" alt="">` : icon(modeClass === 'combined' ? 'layers' : 'image', 22)}
          </div>
          <div class="ah-body">
            <div class="ah-top">
              <span class="ah-badge ah-badge--${modeClass}">${modeLabel}</span>
              <span class="ah-date">${date}</span>
            </div>
            ${infoText ? `<div class="ah-info">${infoText}</div>` : ''}
            ${hasNotes ? `<div class="ah-notes">"${notes}"</div>` : ''}
            <div class="ah-actions">
              <button class="ah-btn ah-btn--dl" data-id="${e.id}" aria-label="Herunterladen">${icon('download', 20)}</button>
              <button class="ah-btn ah-btn--preview" data-id="${e.id}" aria-label="Vorschau">${icon('eye', 20)}</button>
              <button class="ah-btn ah-btn--del" data-id="${e.id}" aria-label="Löschen">${icon('trash-2', 20)}</button>
            </div>
          </div>
        </div>`;
      }).join('');

      historyList.innerHTML = cardsHtml + `
        <div class="ah-card ah-card--new" onclick="navigateTo('/anzeige-erstellen')">
          <span class="ah-new-icon">+</span>
          <span>Neue Anzeige erstellen</span>
        </div>`;

      historyList.querySelectorAll('.ah-btn--dl').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          showToast('Download wird in Kürze implementiert.', 'info');
        });
      });

      historyList.querySelectorAll('.ah-btn--preview').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const id = btn.dataset.id;
          const entry = allEntries.find(e => e.id === id);
          if (!entry) return;
          const overlay = document.createElement('div');
          overlay.className = 'ah-preview-overlay';
          overlay.innerHTML = `<div class="ah-preview-content" onclick="event.stopPropagation()">
            <div class="ah-preview-top">
              <h3>Anzeigenvorschau</h3>
              <button class="ah-preview-close" id="ahPreviewClose">${icon('x', 20)}</button>
            </div>
            ${entry.previewImage || entry.thumbnail ? `<img class="ah-preview-img" src="${entry.previewImage || entry.thumbnail}" alt="">` : '<div style="padding:2rem;text-align:center;color:var(--text-3)">Kein Vorschaubild vorhanden</div>'}
          </div>`;
          document.body.appendChild(overlay);
          const onKey = (e) => { if (e.key === 'Escape') closeOverlay(); };
          const closeOverlay = () => { document.removeEventListener('keydown', onKey); if (overlay.parentNode) overlay.remove(); };
          overlay.querySelector('#ahPreviewClose').addEventListener('click', closeOverlay);
          overlay.addEventListener('click', closeOverlay);
          document.addEventListener('keydown', onKey);
        });
      });

      historyList.querySelectorAll('.ah-btn--del').forEach(btn => {
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

    const syncSelectsFromFilters = () => {
      const modeSel = document.getElementById('filterModeMobile');
      const clothingSel = document.getElementById('filterClothingMobile');
      const timeSel = document.getElementById('filterTimeMobile');
      if (modeSel) modeSel.value = activeFilters.mode;
      if (clothingSel) clothingSel.value = activeFilters.clothing;
      if (timeSel) timeSel.value = activeFilters.time;
    };

    const syncBadgesFromFilters = () => {
      ['filterModeDesktop', 'filterTimeDesktop'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const key = containerId === 'filterModeDesktop' ? 'mode' : 'time';
        container.querySelectorAll('.account-filter-badge').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.filter === activeFilters[key]);
        });
      });
      const clothingContainer = document.getElementById('filterClothingDesktop');
      if (clothingContainer) {
        clothingContainer.querySelectorAll('.account-filter-badge').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.filter === activeFilters.clothing);
        });
      }
    };

    const searchMobile = document.getElementById('historySearchMobile');
    const searchDesktop = document.getElementById('historySearchDesktop');
    const handleSearch = (e) => {
      activeFilters.search = e.target.value;
      if (searchMobile && e.target !== searchMobile) searchMobile.value = e.target.value;
      if (searchDesktop && e.target !== searchDesktop) searchDesktop.value = e.target.value;
      applyFilters();
    };
    if (searchMobile) searchMobile.addEventListener('input', handleSearch);
    if (searchDesktop) searchDesktop.addEventListener('input', handleSearch);

    document.getElementById('filterModeMobile')?.addEventListener('change', (e) => {
      activeFilters.mode = e.target.value;
      syncBadgesFromFilters();
      applyFilters();
    });

    document.getElementById('filterClothingMobile')?.addEventListener('change', (e) => {
      activeFilters.clothing = e.target.value;
      syncBadgesFromFilters();
      applyFilters();
    });

    document.getElementById('filterTimeMobile')?.addEventListener('change', (e) => {
      activeFilters.time = e.target.value;
      syncBadgesFromFilters();
      applyFilters();
    });

    document.querySelectorAll('#filterModeDesktop .account-filter-badge').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#filterModeDesktop .account-filter-badge').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilters.mode = btn.dataset.filter;
        syncSelectsFromFilters();
        applyFilters();
      });
    });

    document.querySelectorAll('#filterTimeDesktop .account-filter-badge').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#filterTimeDesktop .account-filter-badge').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilters.time = btn.dataset.filter;
        syncSelectsFromFilters();
        applyFilters();
      });
    });

    const loadEntries = (entries) => {
      allEntries = entries;
      renderStats(entries);
      renderClothingFilters(entries);
      renderHistoryCards(entries);
    };

    if (DEV_MODE) {
      loadEntries([]);
    } else {
      getUserGenerations(currentUser.uid, 50).then(entries => {
        loadEntries(entries || []);
      }).catch(() => {
        loadEntries([]);
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
        emailMessage.innerHTML = `${icon('check-circle', 14)} E-Mail geändert. Bitte neue Adresse bestätigen.`; emailMessage.className = 'account-settings-message success';
        await refreshUserProfile();
      } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
          emailMessage.innerHTML = `${icon('alert-triangle', 14)} Bitte zuerst abmelden und erneut einloggen, dann E-Mail ändern.`; emailMessage.className = 'account-settings-message error';
        } else {
          emailMessage.innerHTML = icon('x-circle', 14) + ' ' + (err.message || 'Fehler beim Ändern.'); emailMessage.className = 'account-settings-message error';
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
        passwordMessage.innerHTML = `${icon('check-circle', 14)} Passwort geändert.`; passwordMessage.className = 'account-settings-message success';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
      } catch (err) {
        passwordMessage.innerHTML = icon('x-circle', 14) + ' ' + (err.code === 'auth/wrong-password' ? 'Aktuelles Passwort ist falsch.' : err.message || 'Fehler beim Ändern.'); passwordMessage.className = 'account-settings-message error';
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
      const svgWrapper = btn.querySelector('svg, [data-lucide]');
      if (svgWrapper) {
        const iconName = isPassword ? 'eye-off' : 'eye';
        svgWrapper.outerHTML = icon(iconName, 16);
      } else {
        btn.innerHTML = icon(isPassword ? 'eye-off' : 'eye', 16) + btn.innerHTML;
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
      confirmDeleteBtn.innerHTML = `${icon('hourglass', 14)} Wird gelöscht...`;
      try {
        await deleteAccount(password);
        deleteModal.classList.remove('visible');
        document.body.style.overflow = '';
        showToast('Konto erfolgreich gelöscht.', 'success');
        navigateTo('/');
      } catch (err) {
        deleteAccountError.innerHTML = icon('x-circle', 14) + ' ' + (err.code === 'auth/wrong-password' ? 'Passwort ist falsch.' : err.message || 'Fehler beim Löschen.');
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
          ? []
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
          const info = e.mode === 'combined' ? 'Kombiniert' : `${e.itemCount || '?'} Einzelbild`;
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
          ? []
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

  const tabsContainer = document.querySelector('.account-card--merged .account-tabs');
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.account-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabsContainer.querySelectorAll('.account-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const parent = tabsContainer.closest('.account-card--merged');
        parent.querySelectorAll('.account-tab-content').forEach(c => c.classList.remove('active'));
        const content = parent.querySelector(`.account-tab-content#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (content) content.classList.add('active');
        if (tab === 'generations') {
          const donutFill = document.getElementById('accountDonutFill');
          if (donutFill) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                donutFill.style.strokeDashoffset = donutFill.style.strokeDashoffset;
              });
            });
          }
        }
        if (tab === 'stats') {
          renderIconElements();
          renderStats(allEntries, !_statsTabVisited);
          _statsTabVisited = true;
        }
      });
    });
  }
}

function renderSubscriptionInfo(profile, subKey, sub) {
  const container = document.getElementById('accountSubscriptionContent');
  if (!container) return;

  const isPro = subKey === 'pro';
  const isFree = subKey === 'free';
  const cancelAtEnd = profile.cancelAtPeriodEnd === true;
  const periodEnd = profile.currentPeriodEnd?.toDate?.();
  const periodEndStr = periodEnd ? periodEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

  let statusText, statusClass;
  if (isFree) {
    statusText = 'Free · Kein aktives Abo';
    statusClass = 'as-status--free';
  } else if (cancelAtEnd && periodEndStr) {
    statusText = `Gekündigt · Läuft aus am ${periodEndStr}`;
    statusClass = 'as-status--canceling';
  } else {
    statusText = `${sub.label} · Aktiv`;
    statusClass = 'as-status--active';
  }

  const used = profile.generationsUsed || 0;
  const limit = sub.limit === -1 ? '∞' : sub.limit;

  let html = `<div class="as-status"><span class="as-status-badge ${statusClass}">${statusText}</span></div>`;

  if (!isFree) {
    const subEnd = periodEnd || (() => {
      const d = new Date(); d.setMonth(d.getMonth() + 1); return d;
    })();
    const subEndStr = subEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (cancelAtEnd) {
      html += `<div class="as-row"><span class="as-label">Läuft ab</span><span class="as-value">${subEndStr}</span></div>`;
    } else {
      html += `<div class="as-row"><span class="as-label">Nächste Abbuchung</span><span class="as-value">${subEndStr}</span></div>`;
    }
  }

  if (sub.limit !== -1 && periodEnd) {
    const resetStr = periodEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    html += `<div class="as-row"><span class="as-label">Nächster Reset</span><span class="as-value">${resetStr}</span></div>`;
  }

  html += `<div class="as-row"><span class="as-label">Verbraucht</span><span class="as-value">${used} / ${limit}</span></div>`;

  html += '<div class="as-actions">';
  if (isFree) {
    html += `<button class="btn btn-primary btn-sm" id="asUpgradeBtn">Jetzt upgraden</button>`;
  } else if (cancelAtEnd) {
    html += `<button class="btn btn-outline btn-sm" id="asReactivateBtn">Kündigung zurücknehmen</button>`;
  } else {
    html += `<button class="btn btn-outline btn-sm" id="asChangePlanBtn">Plan wechseln</button>`;
    html += `<button class="btn btn-danger btn-sm" id="asCancelBtn">Abo kündigen</button>`;
  }
  html += '</div>';

  container.innerHTML = html;

  document.getElementById('asUpgradeBtn')?.addEventListener('click', () => {
    window.showUpgradeModal('account');
  });
  document.getElementById('asChangePlanBtn')?.addEventListener('click', () => {
    window.showUpgradeModal('account');
  });
  document.getElementById('asReactivateBtn')?.addEventListener('click', async () => {
    try {
      await reactivatePlan(currentUser.uid);
      await refreshUserProfile();
      renderAccount(userProfile);
      showToast('Kündigung zurückgenommen.', 'success');
    } catch (_) {
      showToast('Fehler beim Reaktivieren.', 'error');
    }
  });
  document.getElementById('asCancelBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('cancelModal');
    const endDate = document.getElementById('cancelEndDate');
    if (periodEndStr) endDate.textContent = periodEndStr;
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  });
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

function initCancelModal() {
  const modal = document.getElementById('cancelModal');
  if (!modal) return;
  document.getElementById('cancelModalAbort')?.addEventListener('click', () => {
    modal.classList.remove('visible');
    document.body.style.overflow = '';
  });
  document.getElementById('cancelModalConfirm')?.addEventListener('click', async () => {
    document.getElementById('cancelModalConfirm').disabled = true;
    try {
      await cancelPlan(currentUser.uid);
      await refreshUserProfile();
      modal.classList.remove('visible');
      document.body.style.overflow = '';
      renderAccount(userProfile);
      showToast('Abo gekündigt. Läuft am Ende des Zeitraums aus.', 'success');
    } catch (_) {
      showToast('Fehler beim Kündigen.', 'error');
    } finally {
      document.getElementById('cancelModalConfirm').disabled = false;
    }
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCancelModal);
} else {
  initCancelModal();
}
