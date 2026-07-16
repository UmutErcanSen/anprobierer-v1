import { currentUser, refreshUserProfile } from './auth.js';
import { upgradePlan } from './subscription.js';
import { PLANS } from './plans.js';
import { showToast } from './utils.js';
import { navigateTo } from './router.js';
import { icon, renderIconElements } from './icons.js';

let pendingPlan = null;
let checkoutSource = null;

export function openCheckout(planKey, source = 'upgrade-btn') {
  const plan = PLANS[planKey];
  if (!plan) return;
  pendingPlan = planKey;
  checkoutSource = source;

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
  document.getElementById('checkoutModal').classList.add('visible');
  document.body.style.overflow = 'hidden';

  renderIconElements();
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('visible');
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckout);
} else {
  initCheckout();
}

window.openCheckout = openCheckout;
