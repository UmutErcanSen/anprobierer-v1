import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { PLANS } from './plans.js';

export async function getSubscriptionInfo(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const plan = PLANS[data.subscription] || PLANS.free;

  const scheduledDowngrade = data.scheduledDowngrade || null;
  const downgradeAt = data.downgradeAt?.toDate?.() || null;

  return {
    subscription: data.subscription || 'free',
    subscriptionStatus: data.subscriptionStatus || 'active',
    generationLimit: data.generationLimit ?? 3,
    generationsUsed: data.generationsUsed ?? 0,
    currentPeriodStart: data.currentPeriodStart?.toDate?.() || null,
    currentPeriodEnd: data.currentPeriodEnd?.toDate?.() || null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    scheduledDowngrade,
    downgradeAt,
    plan,
  };
}

export async function upgradePlan(uid, planKey, options = {}) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Ungültiger Plan: ' + planKey);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const updateData = {
    subscription: planKey,
    subscriptionStatus: 'active',
    generationLimit: plan.limit,
    generationsUsed: 0,
    currentPeriodStart: serverTimestamp(),
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    scheduledDowngrade: null,
    downgradeAt: null,
  };

  await updateDoc(doc(db, 'users', uid), updateData);
  return updateData;
}

export async function cancelPlan(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) throw new Error('User-Profil nicht gefunden');
  const data = snap.data();

  await updateDoc(doc(db, 'users', uid), {
    cancelAtPeriodEnd: true,
    scheduledDowngrade: null,
    downgradeAt: null,
  });

  return {
    subscription: data.subscription,
    currentPeriodEnd: data.currentPeriodEnd?.toDate?.() || null,
  };
}

export async function reactivatePlan(uid) {
  await updateDoc(doc(db, 'users', uid), {
    cancelAtPeriodEnd: false,
  });
}

export async function downgradePlan(uid, planKey) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Ungültiger Plan: ' + planKey);

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) throw new Error('User-Profil nicht gefunden');
  const data = snap.data();
  const currentPeriodEnd = data.currentPeriodEnd?.toDate?.() || null;
  const downgradeAt = currentPeriodEnd || new Date();

  await updateDoc(doc(db, 'users', uid), {
    scheduledDowngrade: planKey,
    downgradeAt,
    cancelAtPeriodEnd: false,
  });

  return { planKey, downgradeAt };
}

export async function applyScheduledDowngrade(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();

  if (data.scheduledDowngrade && data.downgradeAt) {
    const downgradeAt = data.downgradeAt.toDate();
    const now = new Date();

    if (now >= downgradeAt) {
      const plan = PLANS[data.scheduledDowngrade];
      const updates = {
        subscription: data.scheduledDowngrade,
        subscriptionStatus: 'active',
        generationLimit: plan ? plan.limit : 3,
        scheduledDowngrade: null,
        downgradeAt: null,
      };

      if (data.cancelAtPeriodEnd) {
        updates.cancelAtPeriodEnd = false;
      }

      if (data.scheduledDowngrade === 'free') {
        updates.currentPeriodEnd = null;
      }

      await updateDoc(doc(db, 'users', uid), updates);
      return { applied: true, newPlan: data.scheduledDowngrade };
    }
  }

  return null;
}

export function getFeatureDiff(fromKey, toKey) {
  const features = {
    free: { label: 'Free', limit: '3/Monat', quality: 'Niedrig', items: '1', texts: false, support: 'Standard' },
    basic: { label: 'Basic', limit: '25/Monat', quality: 'Hoch', items: 'Bis zu 5', texts: true, support: 'Priorität' },
    pro: { label: 'Pro', limit: 'Unbegrenzt', quality: 'Max', items: 'Unbegrenzt', texts: true, support: 'Premium' },
  };
  const from = features[fromKey];
  const to = features[toKey];
  if (!from || !to) return [];

  const lost = [];
  if (from.limit !== to.limit) lost.push({ label: 'Generierungen', from: from.limit, to: to.limit });
  if (from.quality !== to.quality) lost.push({ label: 'Bildqualität', from: from.quality, to: to.quality });
  if (from.items !== to.items) lost.push({ label: 'Kleidungsstücke', from: from.items, to: to.items });
  if (from.texts && !to.texts) lost.push({ label: 'Vinted-Texte', from: 'Ja', to: 'Nein' });
  if (from.support !== to.support) lost.push({ label: 'Support', from: from.support, to: to.support });
  return lost;
}

export async function checkAndResetMonthly(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();

  if (data.currentPeriodEnd) {
    const periodEnd = data.currentPeriodEnd.toDate();
    const now = new Date();

    if (now >= periodEnd) {
      if (data.cancelAtPeriodEnd && data.subscription !== 'free') {
        await updateDoc(doc(db, 'users', uid), {
          subscription: 'free',
          subscriptionStatus: 'active',
          generationLimit: 3,
          generationsUsed: 0,
          currentPeriodStart: serverTimestamp(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          scheduledDowngrade: null,
          downgradeAt: null,
        });
        return { reset: true, newPlan: 'free', reason: 'canceled_expired' };
      } else {
        const newPeriodEnd = new Date(now);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        await updateDoc(doc(db, 'users', uid), {
          generationsUsed: 0,
          currentPeriodStart: serverTimestamp(),
          currentPeriodEnd: newPeriodEnd,
        });
        return { reset: true, newPlan: data.subscription, reason: 'monthly_reset' };
      }
    }
  }

  return null;
}

export function getMaxItemsForPlan(subscription) {
  if (subscription === 'pro') return Infinity;
  if (subscription === 'basic') return 5;
  return 1;
}

export function getAllowedQualities(subscription) {
  switch (subscription) {
    case 'pro': return ['high'];
    case 'basic': return ['medium'];
    default: return ['low'];
  }
}

export function getQualityForPlan(subscription) {
  switch (subscription) {
    case 'pro': return 'high';
    case 'basic': return 'medium';
    default: return 'low';
  }
}
