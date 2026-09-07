import { test, expect } from '@playwright/test';
import { brauchtAbgleich, ABGLEICH_ABSTAND_MS, type AboAbbild } from '@/lib/stripe/abgleich-regeln';

/*
  Wann muss der Tarif gegen Stripe abgeglichen werden?

  Diese Datei existiert wegen eines echten Vorfalls: Ein Konto sollte zum
  29.08. von Pro auf Basic wechseln. Stripe hat das getan -- das Ereignis
  erreichte uns aber nie. In unserer Datenbank stand danach dauerhaft weiter
  'pro', und nichts hat es je bemerkt. Der Nutzer bekam Pro-Leistungen fuer
  Basic-Geld, bei jeder Generierung aufs Neue.

  Ein solcher Fehler ist lautlos: Es stuerzt nichts ab, es faellt niemandem
  auf, und er kostet ab dem ersten Tag Geld. Genau deshalb wird die
  Entscheidungsregel hier festgenagelt.
*/

const JETZT = new Date('2026-09-07T07:00:00Z');

/** Ein gesundes Abbild: Periode laeuft noch, nichts steht an. */
function gesund(ueberschreibungen: Partial<AboAbbild> = {}): AboAbbild {
  return {
    stripe_subscription_id: 'sub_123',
    current_period_end: '2026-09-29T12:22:45Z',
    scheduled_change_at: null,
    updated_at: '2026-08-10T15:54:47Z',
    ...ueberschreibungen,
  };
}

test.describe('brauchtAbgleich', () => {
  /*
    Der Vorfall selbst, mit den echten Werten aus der Datenbank. Wenn dieser
    Test je wieder auf false kippt, ist die Selbstheilung ausgebaut -- und
    ein verlorenes Webhook-Ereignis kostet wieder dauerhaft Geld.
  */
  test('faelliger Tarifwechsel wird erkannt -- der Vorfall vom 29.08.', () => {
    const vorfall: AboAbbild = {
      stripe_subscription_id: 'sub_1TyWVXQiFozdcJ4rDV8Sb8BZ',
      current_period_end: '2026-08-29T12:22:45Z',
      scheduled_change_at: '2026-08-29T12:22:45Z',
      updated_at: '2026-08-10T15:54:47Z',
    };
    expect(brauchtAbgleich(vorfall, JETZT)).toBe(true);
  });

  test('abgelaufene Periode wird erkannt, auch ohne geplanten Wechsel', () => {
    // Verlaengerung oder Kuendigung -- in beiden Faellen haette ein Ereignis
    // kommen muessen.
    expect(brauchtAbgleich(gesund({ current_period_end: '2026-09-01T00:00:00Z' }), JETZT)).toBe(true);
  });

  test('laufende Periode ohne geplanten Wechsel braucht keinen Abgleich', () => {
    expect(brauchtAbgleich(gesund(), JETZT)).toBe(false);
  });

  test('kuenftiger Wechsel ist noch nicht faellig', () => {
    expect(brauchtAbgleich(gesund({ scheduled_change_at: '2026-09-29T12:22:45Z' }), JETZT)).toBe(false);
  });

  /*
    Free-Konten sind die Mehrheit. Wuerden sie einen Abgleich ausloesen,
    entstuende auf jeder Kontoseite und vor jeder Generierung ein
    Stripe-Aufruf fuer ein Abo, das es gar nicht gibt.
  */
  test('ohne Stripe-Abo passiert nichts', () => {
    expect(brauchtAbgleich(gesund({ stripe_subscription_id: null, current_period_end: null }), JETZT)).toBe(false);
    expect(brauchtAbgleich(null, JETZT)).toBe(false);
  });

  test('gerade erst geschriebener Stand wird nicht erneut abgeglichen', () => {
    // Sonst koennte ein Datensatz, den auch Stripe noch nicht aktualisiert
    // hat, bei JEDEM Aufruf einen API-Aufruf ausloesen.
    const ebenAbgeglichen = new Date(JETZT.getTime() - ABGLEICH_ABSTAND_MS / 2).toISOString();
    expect(brauchtAbgleich(gesund({ current_period_end: '2026-09-01T00:00:00Z', updated_at: ebenAbgeglichen }), JETZT)).toBe(
      false,
    );
  });

  test('nach Ablauf der Bremse wird wieder abgeglichen', () => {
    const laengerHer = new Date(JETZT.getTime() - ABGLEICH_ABSTAND_MS - 1000).toISOString();
    expect(brauchtAbgleich(gesund({ current_period_end: '2026-09-01T00:00:00Z', updated_at: laengerHer }), JETZT)).toBe(
      true,
    );
  });

  test('greift genau AB dem Zeitpunkt, nicht erst danach', () => {
    const exakt = JETZT.toISOString();
    expect(brauchtAbgleich(gesund({ scheduled_change_at: exakt }), JETZT)).toBe(true);
    const eineSekundeSpaeter = new Date(JETZT.getTime() + 1000).toISOString();
    expect(brauchtAbgleich(gesund({ scheduled_change_at: eineSekundeSpaeter }), JETZT)).toBe(false);
  });

  test('unlesbare Datumswerte loesen keinen Dauerabgleich aus', () => {
    // Ein kaputter Wert darf nicht bei jedem Aufruf einen API-Aufruf
    // ausloesen, der ohnehin nichts reparieren kann.
    expect(brauchtAbgleich(gesund({ current_period_end: 'kaputt', updated_at: null }), JETZT)).toBe(false);
  });
});
