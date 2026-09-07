/*
  Die Marke "Wearify" -- eine Quelle fuer alle Stellen, an denen sie auftaucht
  (beide Kopfzeilen, mobiles Menue, Anmeldeseiten, Fusszeile).

  Warum die Wortmarke Text ist und kein Bild:
  Die mitgelieferten PNG-Sperrsaetze enthalten den Claim mit eingebrannt, der
  bei Kopfzeilengroesse unlesbar waere -- und ein Bild waere dort unscharf,
  nicht markierbar und muesste fuer hell und dunkel doppelt geladen werden.
  Als Text folgt die Marke automatisch dem Farbschema, bleibt in jeder Groesse
  scharf und wird vorgelesen. Die Werte stammen unveraendert aus dem
  Markenhandbuch: Jost Light, Tracking 340 (= 0.34em).
*/

/**
 * Das Signet, inline statt als CSS-Maske.
 *
 * Vorher lag es als `mask-image` auf einer eingefaerbten Flaeche. Das sah bei
 * kleinen Groessen sichtbar weich aus, und zwar aus zwei Gruenden
 * gleichzeitig: Eine Maske wird vom Browser erst in eine Bitmap gerastert und
 * dann angewandt -- die feinen Buegellinien wurden dabei ein zweites Mal
 * verrechnet. Inline rendert der Browser den Vektor direkt in Geraeteaufloesung.
 *
 * Die Farbe steuert weiterhin das Theme: `currentColor` im SVG, `text-accent`
 * an der Komponente. Damit wechselt das Zeichen automatisch von #C4471C auf
 * #E4713D, wie das Handbuch es verlangt ("Akzent nie unveraendert auf
 * Dunkel") -- ohne zweite Datei und ohne media-Abfrage, die den vom Nutzer
 * GEWAEHLTEN Modus ohnehin nicht kennt.
 *
 * ACHTUNG bei der Groesse: Der Buegel besteht aus Strichen mit stroke-width
 * 2.2 in einer 180 Einheiten breiten viewBox, das W dagegen aus gefuellten
 * Flaechen. Wird das Zeichen zu klein gerendert, faellt der Strich unter einen
 * Bildpunkt und verschwindet -- waehrend das W stehen bleibt. Das Zeichen
 * sieht dann nicht klein aus, sondern kaputt. Genau daher stammt die Vorgabe
 * "Signet mindestens 56px" im Handbuch. Faustregel: gerenderte BREITE in px
 * geteilt durch 82 ergibt die Strichstaerke in CSS-Pixeln; unter 0.7 wird es
 * sichtbar fadenscheinig.
 */
function Signet({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="10 6 180 132"
      aria-hidden
      focusable="false"
      className={`block shrink-0 ${className}`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M100,52 C100,44 96.5,39 92.5,34 C86.5,26 91.5,13 100.5,14 C108.5,15 112,24 105,28" />
        <path d="M100,52 C88,68 62,70 40,76 C25,80 17,90 25,93 C32,95 41,88 44,81" />
        <path d="M100,52 C112,68 138,70 160,76 C175,80 183,90 175,93 C168,95 159,88 156,81" />
      </g>
      <g fill="currentColor">
        <path d="M52,68 Q57.6,102 79,130 Q73.4,94 52,68Z" />
        <path d="M79,130 Q92.6,106.6 100,80 Q86.4,105.4 79,130Z" />
        <path d="M100,80 Q102.4,107.6 121,130 Q118.6,101.4 100,80Z" />
        <path d="M121,130 Q137.4,99.4 148,68 Q131.6,96.6 121,130Z" />
      </g>
    </svg>
  );
}

export function Wortmarke({ className = '' }: { className?: string }) {
  return (
    /*
      -mr-[0.34em] gleicht den Zwischenraum aus, den die Laufweite HINTER dem
      letzten Buchstaben erzeugt. Ohne diese Korrektur saesse die Marke
      sichtbar zu weit links in jedem rechtsbuendigen oder zentrierten
      Zusammenhang -- ein klassischer Tracking-Fehler.
    */
    <span className={`font-marke font-light uppercase tracking-[0.34em] -mr-[0.34em] ${className}`}>
      Wearify
    </span>
  );
}

/**
 * Signet + Wortmarke nebeneinander -- die Fassung fuer Kopfzeilen und Menue.
 *
 * 38px hoch (52px breit) statt der urspruenglichen 22px: Bei 22px lag die
 * Strichstaerke des Buegels bei 0.37 CSS-Pixeln, auf dem Testgeraet also bei
 * 0.46 GERAETEpixeln -- weniger als ein halber Punkt. Der Buegel loeste sich
 * dadurch auf, waehrend das gefuellte W stehen blieb; das Zeichen wirkte
 * abgeschlagen statt nur klein. Bei 38px sind es 0.64 CSS- bzw. 0.80
 * Geraetepixel, der Buegel traegt wieder durch.
 *
 * Die Wortmarke waechst mit (17px statt 15px), damit das Verhaeltnis stimmt:
 * Ein grosses Zeichen neben unveraendert kleiner Schrift saehe aus, als
 * gehoerten sie nicht zusammen.
 */
export function Marke({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Signet className="h-[38px] w-[52px] text-accent" />
      <Wortmarke className="text-[17px]" />
    </span>
  );
}

/**
 * Der volle Sperrsatz mit Claim -- fuer die Fusszeile, wo Platz ist.
 *
 * Hier erreicht das Signet die im Handbuch geforderten 56px. Der Claim steht
 * bewusst NUR hier und nicht zusaetzlich im Kopf: Zweimal dieselbe Aussage
 * auf einer Seite schwaecht sie, statt sie zu verstaerken.
 */
export function MarkeMitClaim({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center gap-3 md:flex-row md:gap-4 ${className}`}>
      <Signet className="h-14 w-[76px] text-accent" />
      <span className="flex flex-col items-center gap-1 md:items-start">
        <Wortmarke className="text-ink" />
        <span className="whitespace-nowrap font-marke text-[10px] font-light uppercase tracking-[0.28em] -mr-[0.28em] text-muted">
          Dein Kleid. Dein Look.
        </span>
      </span>
    </span>
  );
}
