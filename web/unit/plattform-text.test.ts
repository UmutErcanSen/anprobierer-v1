import { test, expect } from '@playwright/test';
import { formatSaleTextForPlatform, PLATFORMS } from '@/lib/generation/platforms';

/*
  Aufbereitung des Verkaufstexts fuer die Zielplattformen.

  Warum das Tests verdient: Diese Funktion entscheidet, was der Nutzer
  tatsaechlich bei Vinted, Kleinanzeigen oder eBay einfuegt. Ein Fehler hier
  ist voellig lautlos -- nichts stuerzt ab, es sieht nur unprofessionell aus,
  und zwar bei jedem einzelnen Verkauf. Genau so ein Fehler steckte bis
  zuletzt drin: Jeder Zeilenumbruch galt als Absatzgrenze, wodurch weich
  umbrochene Saetze mitten entzweigerissen wurden.

  Die Eingaben stammen bewusst aus echten Modellausgaben (weiche Umbrueche,
  gelegentliches Markdown), nicht aus idealisierten Beispielen.
*/

const vinted = PLATFORMS.find((p) => p.key === 'vinted')!;
const ebay = PLATFORMS.find((p) => p.key === 'ebay')!;

test.describe('formatSaleTextForPlatform', () => {
  test('zieht weich umbrochene Zeilen zu einem Absatz zusammen — Regression', () => {
    const text = [
      '✨ Spitzen-Top in Weiß ✨',
      '',
      'Wunderschönes Top aus Häkelspitze mit Zackensaum. Der',
      'schmale Trägerschnitt wirkt leicht und sommerlich.',
    ].join('\n');

    const { description } = formatSaleTextForPlatform(text, vinted);

    // Der Satz muss zusammenhaengen, nicht durch eine Leerzeile getrennt sein.
    expect(description).toBe(
      'Wunderschönes Top aus Häkelspitze mit Zackensaum. Der schmale Trägerschnitt wirkt leicht und sommerlich.',
    );
    expect(description).not.toContain('\n\n');
  });

  test('behält echte Absätze (Leerzeile) als Absätze', () => {
    const text = ['Titel', '', 'Erster Absatz.', '', 'Zweiter Absatz.'].join('\n');
    const { description } = formatSaleTextForPlatform(text, vinted);
    expect(description).toBe('Erster Absatz.\n\nZweiter Absatz.');
  });

  test('lässt Aufzählungspunkte auf eigenen Zeilen — sonst wird der eBay-Text eine Wurst', () => {
    const text = ['Titel', '', '- Zustand: sehr gut', '- Größe: M', '- Verschluss: keiner'].join('\n');
    const { description } = formatSaleTextForPlatform(text, ebay);
    expect(description).toBe('- Zustand: sehr gut\n- Größe: M\n- Verschluss: keiner');
  });

  test('erkennt auch nummerierte Aufzählungen', () => {
    const text = ['Titel', '', '1. Erster Punkt', '2. Zweiter Punkt'].join('\n');
    const { description } = formatSaleTextForPlatform(text, ebay);
    expect(description).toBe('1. Erster Punkt\n2. Zweiter Punkt');
  });

  test('entfernt Markdown-Reste aus Titel und Text', () => {
    const text = ['**Fetter Titel**', '', '### Größe: M (38/10)'].join('\n');
    const { title, description } = formatSaleTextForPlatform(text, vinted);
    expect(title).toBe('Fetter Titel');
    expect(description).toBe('Größe: M (38/10)');
  });

  test('kommt mit führenden Leerzeilen zurecht', () => {
    const text = ['', '', 'Der eigentliche Titel', '', 'Beschreibung.'].join('\n');
    const { title, description } = formatSaleTextForPlatform(text, vinted);
    expect(title).toBe('Der eigentliche Titel');
    expect(description).toBe('Beschreibung.');
  });

  test('kürzt den Titel an der Wortgrenze und hängt ein Auslassungszeichen an', () => {
    const lang = 'Ein sehr langer Titel der ganz sicher ueber das Limit von sechzig Zeichen hinausgeht';
    const { title } = formatSaleTextForPlatform(`${lang}\n\nText`, vinted);
    expect(title.length).toBeLessThanOrEqual(vinted.titleMaxLength);
    expect(title.endsWith('…')).toBe(true);

    /* "Wortgrenze" heisst: Der beibehaltene Teil ist ein Praefix des
       Originals, und im Original folgt darauf ein Leerzeichen. Ein Blick auf
       das letzte Zeichen vor dem Auslassungszeichen reicht dafuer NICHT --
       das ist auch bei korrektem Schnitt ein Buchstabe (…"von" + "…"). */
    const kern = title.slice(0, -1);
    expect(lang.startsWith(kern)).toBe(true);
    expect(lang[kern.length]).toBe(' ');
  });

  test('fällt ohne Beschreibung auf den Titel zurück, statt leer zu bleiben', () => {
    const { description } = formatSaleTextForPlatform('Nur ein Titel', vinted);
    expect(description).toBe('Nur ein Titel');
  });

  test('liefert bei leerer Eingabe leere Felder statt zu werfen', () => {
    const { title, description } = formatSaleTextForPlatform('', vinted);
    expect(title).toBe('');
    expect(description).toBe('');
  });
});
