import { currentUser, userProfile, refreshUserProfile } from './auth.js';
import { upgradePlan, downgradePlan, getFeatureDiff } from './subscription.js';
import { PLANS } from './plans.js';
import { showToast } from './utils.js';
import { navigateTo } from './router.js';
import { icon, renderIconElements } from './icons.js';

let pendingPlan = null;
let checkoutSource = null;

const PLAN_FEATURES = {
  free: [
    '3 Generierungen / Monat',
    'Niedrige Qualität',
    '1 Kleidungsstück',
  ],
  basic: [
    '25 Generierungen / Monat',
    'Mittlere Qualität',
    'Bis zu 5 Kleidungsstücke',
    'Vinted-Texte',
  ],
  pro: [
    'Unbegrenzte Generierungen',
    'Hohe Qualität',
    'Unbegrenzt Kleidungsstücke',
    'Vinted-Texte',
    'Premium-Support',
  ],
};

function renderUpgradePlans(activePlan) {
  const container = document.getElementById('upgradePlans');
  if (!container) return;
  const planOrder = ['free', 'basic', 'pro'];
  const activeIdx = planOrder.indexOf(activePlan);
  container.innerHTML = planOrder.map((key, i) => {
    const p = PLANS[key];
    const isActive = activePlan === key;
    const iconMap = { free: 'star', basic: 'layers', pro: 'crown' };
    const isUpgrade = i > activeIdx;
    const isDowngrade = i < activeIdx;
    let btnHtml;
    if (isActive) {
      btnHtml = `<button class="upgrade-plan-btn upgrade-plan-btn--muted" disabled>Aktiv</button>`;
    } else if (isUpgrade) {
      btnHtml = `<button class="upgrade-plan-btn upgrade-plan-btn--primary" data-plan="${key}">Upgraden</button>`;
    } else if (isDowngrade) {
      btnHtml = `<button class="upgrade-plan-btn upgrade-plan-btn--secondary" data-plan="${key}">Wechseln</button>`;
    }
    return `<div class="upgrade-plan-card${isActive ? ' upgrade-plan-card--active' : ''}" data-plan="${key}">
      <span class="upgrade-plan-icon" style="color:${p.color}">${icon(iconMap[key] || 'star', 28)}</span>
      <span class="upgrade-plan-name">${p.label}</span>
      <span class="upgrade-plan-price">${p.price}</span>
      <span class="upgrade-plan-period">/ Monat</span>
      <ul class="upgrade-plan-features">${PLAN_FEATURES[key]?.map(f => `<li>${icon('check', 12)} ${f}</li>`).join('') || ''}</ul>
      ${btnHtml}
    </div>`;
  }).join('');

  container.querySelectorAll('.upgrade-plan-btn--primary').forEach(btn => {
    btn.addEventListener('click', () => startPayment(btn.dataset.plan));
  });
  container.querySelectorAll('.upgrade-plan-btn--secondary').forEach(btn => {
    btn.addEventListener('click', () => showDowngradeModal(btn.dataset.plan));
  });
}

function showDowngradeModal(targetKey) {
  const currentKey = userProfile?.subscription || 'free';
  const target = PLANS[targetKey];
  const current = PLANS[currentKey];
  if (!target || !current) return;

  const periodEnd = userProfile?.currentPeriodEnd?.toDate?.();
  const periodEndStr = periodEnd ? periodEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
  const diff = getFeatureDiff(currentKey, targetKey);

  const modal = document.createElement('div');
  modal.className = 'confirm-modal visible';
  modal.style.zIndex = '10002';
  modal.innerHTML = `<div class="confirm-modal-content upgrade-content" onclick="event.stopPropagation()">
    <button class="modal-close-x" onclick="this.closest('.confirm-modal').remove()">&times;</button>
    <h3>${icon('arrow-down', 18)} Zu ${target.label} wechseln?</h3>
    <div class="downgrade-diff">
      <p class="downgrade-hint">Deine aktuellen Vorteile (<strong>${current.label}</strong>) bleiben bis zum <strong>${periodEndStr}</strong> erhalten. Danach gelten diese Limits:</p>
      <table class="downgrade-table">
        <tr><th>Feature</th><th>Bisher (${current.label})</th><th>Neu (${target.label})</th></tr>
        ${diff.map(d => `<tr><td>${d.label}</td><td class="downgrade-from">${d.from}</td><td class="downgrade-to">${d.to}</td></tr>`).join('')}
      </table>
      <p class="downgrade-note">Bis zum <strong>${periodEndStr}</strong> kannst du alle ${current.label}-Funktionen wie gewohnt nutzen. Danach wird automatisch umgestellt.</p>
    </div>
    <div class="confirm-modal-actions">
      <button class="btn btn-outline btn-sm" id="ddAbortBtn">Abbrechen</button>
      <button class="btn btn-danger btn-sm" id="ddConfirmBtn">Zu ${target.label} wechseln</button>
    </div>
  </div>`;

  document.body.appendChild(modal);

  document.getElementById('ddAbortBtn').addEventListener('click', () => modal.remove());
  document.getElementById('ddConfirmBtn').addEventListener('click', async () => {
    document.getElementById('ddConfirmBtn').disabled = true;
    try {
      await downgradePlan(currentUser.uid, targetKey);
      await refreshUserProfile();
      modal.remove();
      document.getElementById('upgradeModal').classList.remove('visible');
      document.body.style.overflow = '';
      showToast(`Wechsel zu ${target.label} zum ${periodEndStr} eingeplant.`, 'success');
    } catch (err) {
      showToast('Fehler beim Wechsel: ' + (err.message || 'Bitte versuche es erneut.'), 'error');
    } finally {
      document.getElementById('ddConfirmBtn').disabled = false;
    }
  });
  modal.querySelector('.confirm-modal-content').addEventListener('click', (e) => e.stopPropagation());
  modal.addEventListener('click', () => modal.remove());
}

export function showUpgradeModal(source = 'upgrade-btn') {
  checkoutSource = source;
  pendingPlan = null;

  const subKey = currentUser ? (userProfile?.subscription || 'free') : 'free';

  const heading = document.querySelector('#upgradeModal h3');
  const sub = document.getElementById('upgradeSub');
  if (source === 'generate') {
    heading.textContent = 'Limit erreicht';
    sub.textContent = subKey === 'free'
      ? 'Du hast alle deine Gratis-Generierungen verbraucht. Upgrade für mehr.'
      : 'Dein monatliches Limit ist erreicht. Upgrade für unbegrenzte Generierungen.';
  } else if (source === 'account') {
    heading.textContent = 'Plan auswählen oder wechseln';
    sub.textContent = 'Wähle einen höheren Plan zum Upgraden oder einen günstigeren Plan zum Wechseln (gilt ab nächstem Monat).';
  } else {
    heading.textContent = 'Tarif auswählen';
    sub.textContent = 'Wähle den passenden Plan für deine Bedürfnisse.';
  }

  renderUpgradePlans(subKey, source);
  document.getElementById('upgradeModal').classList.add('visible');
  document.body.style.overflow = 'hidden';
  renderIconElements();
}

function startPayment(planKey) {
  const plan = PLANS[planKey];
  if (!plan) return;
  pendingPlan = planKey;

  document.getElementById('upgradeModal').classList.remove('visible');

  document.getElementById('checkoutPlanName').textContent = plan.label;
  document.getElementById('checkoutPlanPrice').textContent = plan.price;

  document.getElementById('checkoutMessage').textContent = '';
  document.getElementById('checkoutMessage').className = 'checkout-message';
  document.getElementById('checkoutLoading').classList.add('hidden');
  document.getElementById('checkoutSuccess').classList.add('hidden');
  document.getElementById('checkoutActions').classList.remove('hidden');
  document.getElementById('checkoutCardName').value = '';
  document.getElementById('checkoutCardNumber').value = '';
  document.getElementById('checkoutCardExpiry').value = '';
  document.getElementById('checkoutCardCvc').value = '';
  document.getElementById('checkoutPayBtn').textContent = `Jetzt upgraden — ${plan.price}`;
  document.getElementById('checkoutModal').classList.add('visible');
  document.body.style.overflow = 'hidden';

  renderIconElements();
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('visible');
  document.getElementById('upgradeModal').classList.remove('visible');
  document.body.style.overflow = '';
  pendingPlan = null;
  document.querySelectorAll('.confirm-modal.visible').forEach(m => {
    if (m.id !== 'cancelModal' && m.id !== 'upgradeModal' && m.id !== 'checkoutModal') m.remove();
  });
}

function validateForm() {
  const name = document.getElementById('checkoutCardName').value.trim();
  const number = document.getElementById('checkoutCardNumber').value.replace(/\s/g, '');
  const expiry = document.getElementById('checkoutCardExpiry').value.trim();
  const cvc = document.getElementById('checkoutCardCvc').value.trim();

  if (!name) return 'Bitte Karteninhaber eingeben.';
  if (!/^\d{16}$/.test(number)) return 'Bitte gültige Kartennummer eingeben (16 Ziffern).';
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return 'Bitte gültiges Ablaufdatum (MM/JJ) eingeben.';
  const [mm, yy] = expiry.split('/');
  const m = parseInt(mm);
  const y = parseInt(yy) + 2000;
  if (new Date(y, m) < new Date()) return 'Karte ist abgelaufen.';
  if (!/^\d{3}$/.test(cvc)) return 'Bitte gültigen CVC eingeben (3 Ziffern).';
  return null;
}

async function handlePayment() {
  const error = validateForm();
  const msgEl = document.getElementById('checkoutMessage');
  if (error) {
    msgEl.textContent = error;
    msgEl.className = 'checkout-message error';
    return;
  }

  document.getElementById('checkoutActions').classList.add('hidden');
  document.getElementById('checkoutLoading').classList.remove('hidden');
  msgEl.textContent = '';

  await new Promise(r => setTimeout(r, 2000));

  try {
    await upgradePlan(currentUser.uid, pendingPlan);
    await refreshUserProfile();

    document.getElementById('checkoutLoading').classList.add('hidden');
    document.getElementById('checkoutSuccess').classList.remove('hidden');

    setTimeout(() => {
      closeCheckout();
      showToast(`Upgrade auf ${PLANS[pendingPlan].label} erfolgreich!`, 'success');
      navigateTo('/account');
    }, 1500);
  } catch (err) {
    document.getElementById('checkoutLoading').classList.add('hidden');
    document.getElementById('checkoutActions').classList.remove('hidden');
    msgEl.textContent = 'Fehler beim Upgrade: ' + (err.message || 'Bitte versuche es erneut.');
    msgEl.className = 'checkout-message error';
  }
}

function initCheckout() {
  document.getElementById('checkoutCancelBtn')?.addEventListener('click', closeCheckout);
  document.getElementById('checkoutPayBtn')?.addEventListener('click', handlePayment);
  document.getElementById('checkoutModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckout();
  });
  document.getElementById('upgradeLaterBtn')?.addEventListener('click', closeCheckout);
  document.getElementById('upgradeModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckout();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckout);
} else {
  initCheckout();
}

window.showUpgradeModal = showUpgradeModal;
window.closeCheckout = closeCheckout;