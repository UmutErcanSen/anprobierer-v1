import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { PLANS } from './plans.js';

export async function getSubscriptionInfo(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const plan = PLANS[data.subscription] || PLANS.free;
  return {
    subscription: data.subscription || 'free',
    subscriptionStatus: data.subscriptionStatus || 'active',
    generationLimit: data.generationLimit ?? 3,
    generationsUsed: data.generationsUsed ?? 0,
    currentPeriodStart: data.currentPeriodStart?.toDate?.() || null,
    currentPeriodEnd: data.currentPeriodEnd?.toDate?.() || null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    plan,
  };
}

export async function upgradePlan(uid, planKey) {
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

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await updateDoc(doc(db, 'users', uid), {
    subscription: planKey,
    subscriptionStatus: 'active',
    generationLimit: plan.limit,
    currentPeriodStart: serverTimestamp(),
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  });
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
  switch (subscription) {
    case 'pro': return Infinity;
    case 'basic': return 5;
    default: return 1;
  }
}

export function getAllowedQualities(subscription) {
  switch (subscription) {
    case 'pro': return ['low', 'medium', 'high'];
    case 'basic': return ['low', 'medium', 'high'];
    default: return ['medium'];
  }
}

export function isVintedTextAllowed(subscription) {
  return subscription === 'basic' || subscription === 'pro';
}
