/*
  Next.js ruft register() genau einmal auf, wenn eine Serverinstanz startet --
  und wartet darauf, bevor die erste Anfrage bedient wird. Damit ist das die
  einzige Stelle, an der sich eine fehlende Konfiguration melden kann, BEVOR
  ein Nutzer darueber stolpert.

  Der Runtime-Test ist noetig, weil register() auch in der Edge-Runtime laeuft.
  Dort gibt es die Server-Geheimnisse gar nicht, und 'server-only' im
  geprueften Modul wuerde ohnehin greifen -- die Pruefung gehoert
  ausschliesslich in den Node-Prozess.
*/
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { pruefeServerEnv } = await import('@/lib/env-server');
  pruefeServerEnv();
}
