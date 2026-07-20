import { onAuthChange, refreshUserProfile, currentUser, userProfile, logout, updateUserEmail, changeUserPassword, deleteAccount, reauthenticateUser } from './auth.js';
import { getUserGenerations, deleteGeneration } from './firestore.js';
import { cancelPlan, reactivatePlan, applyScheduledDowngrade } from './subscription.js';
import { onRouteChange, getCurrentPath, navigateTo } from './router.js';
import { PLANS } from './plans.js';
import { showToast, TYPE_LABELS } from './utils.js';
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

  if (currentUser?.uid) {
    applyScheduledDowngrade(currentUser.uid).then(result => {
      if (result) {
        refreshUserProfile().then(newProfile => {
          renderAccount(newProfile);
        });
      }
    });
  }

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
    planBadge.classList.toggle('account-plan-badge--pro', subKey === 'pro');
    if (donutFill) donutFill.classList.toggle('account-donut-fill--pro', subKey === 'pro');
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
    if (subKey === 'free' || subKey === 'basic') {
      upgradeBanner.classList.remove('hidden');
      const limitReached = sub.limit !== -1 && used >= sub.limit;
      const limitNear = sub.limit !== -1 && used >= sub.limit * 0.8 && used < sub.limit;
      const t = upgradeBanner.querySelector('#bannerTitle');
      const d = upgradeBanner.querySelector('#bannerDesc');
      const nextPlan = subKey === 'free' ? 'Basic' : 'Pro';
      const inner = upgradeBanner.querySelector('.account-upgrade-banner-inner');
      if (inner) {
        inner.classList.remove('banner--danger', 'banner--warning');
        if (limitReached) inner.classList.add('banner--danger');
        else if (limitNear) inner.classList.add('banner--warning');
      }
      if (t) {
        if (limitReached) t.textContent = 'Limit erreicht';
        else if (limitNear) t.textContent = 'Fast am Limit';
        else t.textContent = 'Bereit für mehr?';
      }
      if (d) {
        if (limitReached) d.textContent = 'Du hast dein monatliches Limit ausgeschöpft. Upgrade für mehr Generierungen.';
        else if (limitNear) d.textContent = `Du hast bereits ${used} von ${sub.limit} Generierungen genutzt. Upgrade für unbegrenztes Erstellen.`;
        else d.textContent = `Wechsle zu ${nextPlan} für höhere Limits und mehr Features.`;
      }
      if (limitNear && !window._limitToastShown) {
        window._limitToastShown = true;
        setTimeout(() => showToast(`Noch ${sub.limit - used} Generierungen übrig diesen Monat.`, 'warning'), 500);
      }
    } else {
      upgradeBanner.classList.add('hidden');
    }
  }

  const continueCard = document.getElementById('accountContinueCard');
  if (continueCard) {
    try {
      const raw = localStorage.getItem('vto_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.personPhoto) {
          continueCard.classList.remove('hidden');
          const count = session.clothingItems?.length || 0;
          const iconEl = continueCard.querySelector('.account-continue-icon');
          if (iconEl) iconEl.innerHTML = icon('play', 28);
          const btn = continueCard.querySelector('#accountContinueBtn');
          if (btn) {
            btn.onclick = () => navigateTo('/anzeige-erstellen');
          }
        }
      }
    } catch (_) {}
  }

  const historyStats = document.getElementById('accountHistoryStats');
  if (historyList && currentUser) {
    let allEntries = [];
    let activeFilters = { mode: 'all', clothing: ['all'], time: 'all', search: '' };
    let currentPage = 1;
    const PAGE_SIZE = 10;

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
      const types = Object.keys(TYPE_LABELS).sort((a, b) => TYPE_LABELS[a].localeCompare(TYPE_LABELS[b]));
      const options = `<option value="all">Alle</option>` + types.map(t => `<option value="${t}">${TYPE_LABELS[t]}</option>`).join('');

      const mobileSel = document.getElementById('filterClothingMobile');
      if (mobileSel) {
        const prev = mobileSel.value;
        mobileSel.innerHTML = options;
        mobileSel.value = types.includes(prev) ? prev : 'all';
        const label = document.getElementById('filterClothingLabel');
        if (label) label.textContent = mobileSel.options[mobileSel.selectedIndex]?.textContent || 'Alle';
      }

      const desktopContainer = document.getElementById('filterClothingDesktop');
      if (desktopContainer) {
        desktopContainer.innerHTML = `<button class="account-filter-badge active" data-filter="all">${icon('shirt', 12)} Alle</button>` +
          types.map(t => `<button class="account-filter-badge" data-filter="${t}">${icon('shirt', 12)} ${TYPE_LABELS[t]}</button>`).join('');
        syncBadgesFromFilters();
        desktopContainer.querySelectorAll('.account-filter-badge').forEach(btn => {
          btn.addEventListener('click', () => {
            const val = btn.dataset.filter;
            if (val === 'all') {
              activeFilters.clothing = ['all'];
            } else {
              if (activeFilters.clothing.includes('all')) {
                activeFilters.clothing = [val];
              } else {
                const idx = activeFilters.clothing.indexOf(val);
                if (idx >= 0) {
                  activeFilters.clothing.splice(idx, 1);
                  if (activeFilters.clothing.length === 0) activeFilters.clothing = ['all'];
                } else {
                  activeFilters.clothing.push(val);
                }
              }
            }
            syncBadgesFromFilters();
            syncSelectsFromFilters();
            applyFilters();
          });
        });
      }
    };

    const filterEntries = (entries) => {
      return entries.filter(e => {
        if (activeFilters.mode !== 'all' && e.mode !== activeFilters.mode) return false;
        const clothing = activeFilters.clothing;
        if (!clothing.includes('all') && clothing.length > 0) {
          const entryTypes = e.clothingTypes || [];
          if (!entryTypes.some(t => clothing.includes(t))) return false;
        }
        if (activeFilters.search) {
          const q = activeFilters.search.toLowerCase();
          const notes = (e.notes || '').toLowerCase();
          const types = (e.clothingTypes || []).map(t => (TYPE_LABELS[t] || t).toLowerCase()).join(' ');
          if (!notes.includes(q) && !types.includes(q)) return false;
        }
        if (activeFilters.time !== 'all') {
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.date + 'T00:00:00');
          const diffDays = (new Date() - d) / (1000 * 60 * 60 * 24);
          if (activeFilters.time === 'week' && diffDays > 7) return false;
          if (activeFilters.time === 'month' && diffDays > 30) return false;
        }
        return true;
      });
    };

    const goToPage = (page) => {
      currentPage = page;
      renderHistoryCards(allEntries);
    };

    window.goToPage = goToPage;

    const renderPagination = () => {
      const filtered = filterEntries(allEntries);
      const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
      let container = document.getElementById('accountPagination');
      if (totalPages <= 1) { if (container) container.remove(); return; }
      if (!container) {
        container = document.createElement('div');
        container.id = 'accountPagination';
        historyList.after(container);
      }

      const isMobile = window.innerWidth < 768;
      let pages = [];

      if (isMobile) {
        container.innerHTML = `<div class="pagination">
          <button class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">${icon('chevron-left', 14)}</button>
          <span class="pagination-info">${currentPage}/${totalPages}</span>
          <button class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">${icon('chevron-right', 14)}</button>
        </div>`;
        return;
      }

      const maxVisible = 5;
      if (totalPages <= maxVisible + 2) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (currentPage <= 3) { start = 2; end = Math.min(maxVisible, totalPages - 1); }
        if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - maxVisible + 1); end = totalPages - 1; }
        if (start > 2) pages.push('ellipsis');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('ellipsis');
        pages.push(totalPages);
      }

      container.innerHTML = `<div class="pagination">
        <button class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">${icon('chevron-left', 14)}</button>
        ${pages.map(p => p === 'ellipsis' ? '<span class="pagination-ellipsis">…</span>' : `<button class="pagination-num${p === currentPage ? ' active' : ''}" onclick="goToPage(${p})">${p}</button>`).join('')}
        <button class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">${icon('chevron-right', 14)}</button>
      </div>`;
    };

    const renderHistoryCards = (entries) => {
      const filtered = filterEntries(entries);
      const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
      if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
      const start = (currentPage - 1) * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, filtered.length);
      const pageEntries = filtered.slice(start, end);

      const historyCount = document.getElementById('accountHistoryCount');
      if (historyCount) {
        const countText = filtered.length === entries.length
          ? `${entries.length} Anzeige${entries.length !== 1 ? 'n' : ''}`
          : `${filtered.length} von ${entries.length} Anzeigen`;
        historyCount.textContent = totalPages > 1
          ? `Seite ${currentPage} von ${totalPages} · ${countText}`
          : countText;
      }

      if (filtered.length === 0) {
        historyList.innerHTML = `
          <div class="account-history-empty">
            ${icon('scroll-text', 40)}
            <span>${entries.length === 0 ? 'Noch keine Anzeigen erstellt' : 'Keine Ergebnisse für diese Filter'}</span>
            ${entries.length === 0 ? '<button class="btn btn-sm btn-primary" onclick="navigateTo(\'/anzeige-erstellen\')">Jetzt erste Anzeige erstellen</button>' : ''}
          </div>`;
        renderPagination();
        return;
      }

      const cardsHtml = pageEntries.map(e => {
        const rawDate = e.createdAt?.toDate?.() || (e.date ? new Date(e.date + 'T00:00:00') : null);
        const date = rawDate
          ? `${String(rawDate.getDate()).padStart(2,'0')}/${String(rawDate.getMonth()+1).padStart(2,'0')}/${rawDate.getFullYear()}`
          : '–';
        const modeLabel = e.mode === 'combined' ? 'Kombiniert' : 'Einzelbild';
        const modeClass = e.mode === 'combined' ? 'combined' : 'single';
        const notes = e.notes || '';
        const hasNotes = notes.length > 0;
        const types = (e.clothingTypes || []).filter(t => t !== 'combined' && t !== '');
        const clothingBadge = types.length === 1 ? `<span class="ah-badge ah-badge--clothing">${TYPE_LABELS[types[0]] || types[0]}</span>` : '';
        const infoParts = [];
        if (types.length > 1) infoParts.push(types.map(t => TYPE_LABELS[t] || t).join(', '));
        if (e.itemCount) infoParts.push(`${e.itemCount} ${e.itemCount === 1 ? 'Kleidungsstück' : 'Kleidungsstücke'}`);
        if (e.imageCount) infoParts.push(`${e.imageCount} ${e.imageCount === 1 ? 'Bild' : 'Bilder'}`);
        const infoText = infoParts.join(' · ');
        const saleText = e.saleText || '';
        const displaySaleText = saleText.length > 150 ? saleText.slice(0, 150).replace(/\n---\n/g, ' · ').replace(/\n/g, ' ') + '…' : saleText.replace(/\n---\n/g, ' · ').replace(/\n/g, ' ');

        return `<div class="ah-card ah-card--${modeClass}">
          <div class="ah-thumb${e.thumbnail ? '' : ' ah-thumb--' + modeClass}">
            ${e.thumbnail ? `<img class="ah-thumb-img" src="${e.thumbnail}" alt="">` : icon(modeClass === 'combined' ? 'layers' : 'image', 22)}
          </div>
          <div class="ah-body">
            <div class="ah-top">
              <span class="ah-badge ah-badge--${modeClass}">${modeLabel}</span>
              ${clothingBadge}
              <span class="ah-date">${date}</span>
            </div>
            ${infoText ? `<div class="ah-info">${infoText}</div>` : ''}
            ${hasNotes ? `<div class="ah-notes">"${notes}"</div>` : ''}
            ${saleText ? `<div class="ah-sale-text">${displaySaleText}</div>` : ''}
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
      renderPagination();

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

    const applyFilters = () => { currentPage = 1; renderHistoryCards(allEntries); };

    const syncSelectsFromFilters = () => {
      const modeSel = document.getElementById('filterModeMobile');
      const clothingSel = document.getElementById('filterClothingMobile');
      const timeSel = document.getElementById('filterTimeMobile');
      if (modeSel) { modeSel.value = activeFilters.mode; updateTriggerLabel('mode', modeSel); }
      if (clothingSel) {
        const c = activeFilters.clothing;
        clothingSel.value = c.includes('all') ? 'all' : (c.length === 1 ? c[0] : 'all');
        updateTriggerLabel('clothing', clothingSel);
      }
      if (timeSel) { timeSel.value = activeFilters.time; updateTriggerLabel('time', timeSel); }
    };

    const updateTriggerLabel = (type, sel) => {
      const label = document.getElementById(`filter${type.charAt(0).toUpperCase() + type.slice(1)}Label`);
      if (label) label.textContent = sel.options[sel.selectedIndex]?.textContent || 'Alle';
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
          const val = btn.dataset.filter;
          btn.classList.toggle('active', val === 'all' ? activeFilters.clothing.includes('all') : activeFilters.clothing.includes(val));
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

    document.querySelectorAll('.account-history-mobile-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const type = trigger.dataset.filterType;
        let title, options, currentValue, currentValues, multi, maxSelections;
        if (type === 'mode') {
          title = 'Modus auswählen';
          options = [
            { value: 'all', label: 'Alle' },
            { value: 'combined', label: 'Kombiniert' },
            { value: 'single', label: 'Einzelbild' },
          ];
          currentValue = activeFilters.mode;
          multi = false;
        } else if (type === 'clothing') {
          title = 'Kleidung auswählen';
          const sel = document.getElementById('filterClothingMobile');
          options = sel ? [...sel.options].map(o => ({ value: o.value, label: o.textContent })) : [{ value: 'all', label: 'Alle' }];
          currentValues = activeFilters.clothing;
          multi = true;
          maxSelections = 0;
        } else if (type === 'time') {
          title = 'Zeitraum auswählen';
          options = [
            { value: 'all', label: 'Alle' },
            { value: 'week', label: 'Woche' },
            { value: 'month', label: 'Monat' },
          ];
          currentValue = activeFilters.time;
          multi = false;
        }
        window.openSelectOverlay({
          title, options, currentValue, currentValues,
          multi, maxSelections,
          onChange: (val) => {
            if (type === 'clothing') {
              if (val.includes('all')) {
                const others = val.filter(v => v !== 'all');
                activeFilters.clothing = others.length > 0 ? others : ['all'];
              } else {
                activeFilters.clothing = val;
              }
            } else {
              activeFilters[type] = val;
            }
            const label = document.getElementById(`filter${type.charAt(0).toUpperCase() + type.slice(1)}Label`);
            if (label) {
              if (type === 'clothing') {
                const c = activeFilters.clothing;
                label.textContent = c.includes('all') ? 'Alle' : `${c.length} ausgewählt`;
              } else {
                label.textContent = options.find(o => o.value === val)?.label || val;
              }
            }
            const sel = document.getElementById(`filter${type.charAt(0).toUpperCase() + type.slice(1)}Mobile`);
            if (sel) {
              if (type === 'clothing') {
                const c = activeFilters.clothing;
                sel.value = c.includes('all') ? 'all' : (c.length === 1 ? c[0] : 'all');
              } else {
                sel.value = val;
              }
            }
            syncBadgesFromFilters();
            applyFilters();
          },
        });
      });
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

  let html = '';

  const scheduledDowngrade = profile.scheduledDowngrade;
  const downgradeAt = profile.downgradeAt?.toDate?.();
  if (scheduledDowngrade && downgradeAt && downgradeAt > new Date()) {
    const targetPlan = PLANS[scheduledDowngrade] || { label: scheduledDowngrade };
    const downgradeStr = downgradeAt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    html += `<div class="as-warning">
      ${icon('info', 16)}
      <span>Dein Plan wechselt am <strong>${downgradeStr}</strong> zu <strong>${targetPlan.label}</strong>.</span>
    </div>`;
  }

  html += `<div class="as-status"><span class="as-status-badge ${statusClass}">${statusText}</span></div>`;

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
