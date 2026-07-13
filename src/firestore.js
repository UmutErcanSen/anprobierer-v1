import {
  doc, getDoc, setDoc, updateDoc, increment, deleteDoc,
  collection, addDoc, query, orderBy, limit, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

export async function createUserProfile(uid, email, displayName) {
  await setDoc(doc(db, 'users', uid), {
    email,
    displayName: displayName || '',
    subscription: 'free',
    generationsUsed: 0,
    generationLimit: 5,
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function checkGenerationAllowed(uid) {
  const profile = await getUserProfile(uid);
  if (!profile) return false;
  if (profile.generationLimit === -1) return true;
  return profile.generationsUsed < profile.generationLimit;
}

export async function incrementGenerationsUsed(uid) {
  await updateDoc(doc(db, 'users', uid), {
    generationsUsed: increment(1),
  });
}

export async function saveGeneration(uid, data) {
  await addDoc(collection(db, 'generations', uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getUserGenerations(uid, max = 20) {
  const q = query(
    collection(db, 'generations', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteGeneration(uid, generationId) {
  await deleteDoc(doc(db, 'generations', uid, generationId));
}

export async function deleteUserData(uid) {
  const genSnap = await getDocs(collection(db, 'generations', uid));
  const batch = [];
  genSnap.forEach(d => batch.push(deleteDoc(d.ref)));
  await Promise.all(batch);
  await deleteDoc(doc(db, 'users', uid));
}
