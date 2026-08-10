/**
 * Fassung der Datenschutzerklaerung, der bei der Registrierung zugestimmt wird.
 *
 * Art. 7 Abs. 1 DSGVO verlangt, dass der Verantwortliche die Einwilligung
 * NACHWEISEN kann. Nur "hat irgendwann zugestimmt" reicht dafuer nicht: Wird
 * die Datenschutzerklaerung spaeter geaendert, saehe es sonst so aus, als
 * haetten Bestandsnutzer der neuen Fassung zugestimmt -- was sie nie getan
 * haben. Deshalb wird die Fassung mitgespeichert
 * (profiles.consent_version/consent_at, siehe Migration
 * 20260810120000_signup_missbrauch_und_einwilligung.sql).
 *
 * WICHTIG: Bei jeder inhaltlichen Aenderung an /datenschutz muss dieser Wert
 * hochgezaehlt werden. Datumsformat, damit auf einen Blick erkennbar ist,
 * welcher Stand gemeint ist. Bestandsnutzer behalten ihre alte Fassung --
 * eine erneute Zustimmung einzuholen ist eine eigene, bewusste Entscheidung
 * und passiert nicht automatisch.
 */
export const PRIVACY_VERSION = '2026-08-10';
