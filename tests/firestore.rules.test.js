/**
 * Rules-Tests für firestore.rules (Phase 0).
 *
 * Ausführen:  npm run test:rules
 * Voraussetzung: Java 11+ (der Firestore-Emulator ist eine JVM-Anwendung).
 *
 * Geprüft wird vor allem die Isolation zwischen Nutzern — der Befund, wegen
 * dem diese Rules überhaupt entstanden sind. Die bewusst offen gelassene
 * Abo-Lücke ist am Ende als erwartetes Verhalten dokumentiert, damit niemand
 * sie später für einen Regressionsfehler hält.
 */
import { before, after, beforeEach, describe, it } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc,
} from 'firebase/firestore';

const ALICE = 'alice-uid';
const MALLORY = 'mallory-uid';

/** Gültiges Free-Profil, wie createUserProfile() es anlegt. */
const freshProfile = {
  email: 'alice@example.com',
  displayName: 'Alice',
  subscription: 'free',
  subscriptionStatus: 'active',
  generationsUsed: 0,
  generationLimit: 3,
  cancelAtPeriodEnd: false,
};

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'virtual-try-on-rules-test',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Vorhandenes Profil anlegen, ohne die Rules zu durchlaufen.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE), freshProfile);
    await setDoc(doc(ctx.firestore(), 'users', ALICE, 'generations', 'gen-1'), {
      mode: 'single', imageCount: 1, thumbnail: 'x',
    });
  });
});

const asAlice = () => testEnv.authenticatedContext(ALICE).firestore();
const asMallory = () => testEnv.authenticatedContext(MALLORY).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

describe('Isolation zwischen Nutzern', () => {
  it('Fremder kann ein Profil nicht lesen', async () => {
    await assertFails(getDoc(doc(asMallory(), 'users', ALICE)));
  });

  it('Anonymer kann ein Profil nicht lesen', async () => {
    await assertFails(getDoc(doc(asAnon(), 'users', ALICE)));
  });

  it('Eigentümer kann sein Profil lesen', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'users', ALICE)));
  });

  it('Nutzerbasis kann nicht durchgezählt werden (list verboten)', async () => {
    await assertFails(getDocs(collection(asMallory(), 'users')));
    await assertFails(getDocs(collection(asAlice(), 'users')));
  });

  it('Fremder kann ein Profil nicht überschreiben', async () => {
    await assertFails(updateDoc(doc(asMallory(), 'users', ALICE), { displayName: 'gehackt' }));
  });

  it('Fremder kann Generierungen weder lesen noch löschen', async () => {
    await assertFails(getDocs(collection(asMallory(), 'users', ALICE, 'generations')));
    await assertFails(deleteDoc(doc(asMallory(), 'users', ALICE, 'generations', 'gen-1')));
  });

  it('Eigentümer kann seine Generierungen lesen', async () => {
    await assertSucceeds(getDocs(collection(asAlice(), 'users', ALICE, 'generations')));
  });
});

describe('Profilanlage', () => {
  it('Neuanlage als "pro" wird abgelehnt', async () => {
    await assertFails(setDoc(doc(asMallory(), 'users', MALLORY), {
      ...freshProfile, subscription: 'pro', generationLimit: -1,
    }));
  });

  it('Neuanlage mit Free-Defaults ist erlaubt', async () => {
    await assertSucceeds(setDoc(doc(asMallory(), 'users', MALLORY), freshProfile));
  });

  it('Profil unter fremder UID anlegen wird abgelehnt', async () => {
    await assertFails(setDoc(doc(asMallory(), 'users', 'jemand-anderes'), freshProfile));
  });
});

describe('Feldvalidierung', () => {
  it('E-Mail-Adresse ist über das Profildokument nicht änderbar', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { email: 'neu@example.com' }));
  });

  it('negativer Zählerstand wird abgelehnt', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { generationsUsed: -5 }));
  });

  it('erfundener Plan wird abgelehnt', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { subscription: 'enterprise' }));
  });

  it('überlanger Anzeigename wird abgelehnt', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'users', ALICE), { displayName: 'a'.repeat(101) }));
  });

  it('normale Namensänderung ist erlaubt', async () => {
    await assertSucceeds(updateDoc(doc(asAlice(), 'users', ALICE), { displayName: 'Alice B.' }));
  });
});

describe('Größenbremsen (Schutz vor dem 1-MiB-Dokumentlimit)', () => {
  const gens = (db) => collection(db, 'users', ALICE, 'generations');

  it('überdimensioniertes previewImage wird abgelehnt', async () => {
    await assertFails(addDoc(gens(asAlice()), {
      mode: 'single', imageCount: 1, previewImage: 'x'.repeat(400001),
    }));
  });

  it('überdimensioniertes thumbnail wird abgelehnt', async () => {
    await assertFails(addDoc(gens(asAlice()), {
      mode: 'single', imageCount: 1, thumbnail: 'x'.repeat(60001),
    }));
  });

  it('Generierung in üblicher Größe ist erlaubt', async () => {
    await assertSucceeds(addDoc(gens(asAlice()), {
      mode: 'combined', imageCount: 3,
      thumbnail: 'x'.repeat(5000), previewImage: 'x'.repeat(80000),
    }));
  });
});

describe('Nicht deklarierte Pfade', () => {
  it('beliebige andere Collection ist gesperrt', async () => {
    await assertFails(getDoc(doc(asAlice(), 'admin', 'secrets')));
    await assertFails(setDoc(doc(asAlice(), 'beliebig', 'doc'), { a: 1 }));
  });
});

describe('Bekannte, bewusst offene Lücke (Phase 2/3 behebt sie)', () => {
  it('Eigentümer kann sich selbst hochstufen — erwartet, siehe Kommentar in firestore.rules', async () => {
    // Die Altanwendung schreibt Abo-Felder ausschließlich clientseitig.
    // Ein Verbot würde sie funktionsunfähig machen; wirtschaftlich kostet die
    // Lücke nichts (BYOK + Fake-Checkout). Schlägt dieser Test fehl, weil er
    // NICHT mehr durchgeht, ist das eine gute Nachricht: dann ist die
    // Schreiblogik serverseitig und der Test darf gelöscht werden.
    await assertSucceeds(updateDoc(doc(asAlice(), 'users', ALICE), {
      subscription: 'pro', generationLimit: -1,
    }));
  });
});
