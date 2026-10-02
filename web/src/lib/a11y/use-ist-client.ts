'use client';

import { useSyncExternalStore } from 'react';

/*
  "Laeuft dieser Code schon im Browser?" -- fuer Komponenten, die ein Portal
  nach document.body haengen. Waehrend des Server-Renders gibt es kein
  `document`, createPortal wuerde dort abstuerzen.

  Drei Komponenten hatten dafuer bisher jeweils eigene Zeilen:

      const [mounted, setMounted] = useState(false);
      useEffect(() => setMounted(true), []);

  Das funktioniert, hat aber zwei Nachteile. Erstens dieselbe Logik dreimal.
  Zweitens erzwingt es nach JEDEM Mounten eine zweite Renderrunde, nur um ein
  Flag umzulegen -- und genau davor warnt die React-Regel
  `set-state-in-effect`.

  useSyncExternalStore loest es ohne Effekt und ohne zweites Rendern: Der
  dritte Parameter ist der Serverwert (false), der zweite der Clientwert
  (true). React weiss damit ausdruecklich, dass die beiden abweichen -- das
  ist kein Hydration-Fehler, sondern die Aussage selbst.

  Der Abonnent gibt eine leere Abmeldefunktion zurueck: Dieser Wert aendert
  sich nach der Hydration nie wieder.
*/
const nieAendern = () => () => {};
const imBrowser = () => true;
const aufDemServer = () => false;

export function useIstClient(): boolean {
  return useSyncExternalStore(nieAendern, imBrowser, aufDemServer);
}
