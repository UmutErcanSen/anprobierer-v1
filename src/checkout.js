import { currentUser, userProfile, refreshUserProfile } from './auth.js';
import { upgradePlan } from './subscription.js';
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
  container.innerHTML = Object.entries(PLANS).map(([key, p]) => {
    const isActive = activePlan === key;
    const iconMap = { free: 'star', basic: 'layers', pro: 'crown' };
    return `<div class="upgrade-plan-card${isActive ? ' upgrade-plan-card--active' : ''}" data-plan="${key}">
      <span class="upgrade-plan-icon" style="color:${p.color}">${icon(iconMap[key] || 'star', 28)}</span>
      <span class="upgrade-plan-name">${p.label}</span>
      <span class="upgrade-plan-price">${p.price}</span>
      <span class="upgrade-plan-period">/ Monat</span>
      <ul class="upgrade-plan-features">${PLAN_FEATURES[key]?.map(f => `<li>${icon('check', 12)} ${f}</li>`).join('') || ''}</ul>
      ${isActive
        ? `<button class="upgrade-plan-btn upgrade-plan-btn--muted" disabled>Aktiv</button>`
        : `<button class="upgrade-plan-btn upgrade-plan-btn--primary" data-plan="${key}">Upgraden</button>`
      }
    </div>`;
  }).join('');

  container.querySelectorAll('.upgrade-plan-btn--primary').forEach(btn => {
    btn.addEventListener('click', () => startPayment(btn.dataset.plan));
  });
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
  } else {
    heading.textContent = 'Tarif auswählen';
    sub.textContent = 'Wähle den passenden Plan für deine Bedürfnisse.';
  }

  renderUpgradePlans(subKey);
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
