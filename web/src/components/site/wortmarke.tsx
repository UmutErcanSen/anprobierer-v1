/*
  Die Marke "Wearify" -- eine Quelle fuer alle Stellen, an denen sie auftaucht
  (beide Kopfzeilen, mobiles Menue, Anmeldeseiten, Fusszeile).

  Warum die Wortmarke Text ist und kein Bild:
  Die mitgelieferten PNG-Sperrsaetze enthalten den Claim mit eingebrannt, der
  bei 15px Kopfzeilenhoehe unlesbar waere -- und ein Bild waere dort unscharf,
  nicht markierbar und muesste fuer hell und dunkel doppelt geladen werden.
  Als Text folgt die Marke automatisch dem Farbschema, bleibt in jeder Groesse
  scharf und wird vorgelesen. Die Werte stammen unveraendert aus dem
  Markenhandbuch: Jost Light, Tracking 340 (= 0.34em).
*/

/**
 * Das Signet als CSS-Maske statt als <img>.
 *
 * Dadurch folgt die Farbe dem Token --accent und wechselt mit dem Theme
 * automatisch von #C4471C auf #E4713D, wie das Handbuch es verlangt ("Akzent
 * nie unveraendert auf Dunkel"). Mit zwei Bilddateien braeuchte es dafuer
 * einen zweiten Download und eine media-Abfrage -- und die kennt den vom
 * Nutzer GEWAEHLTEN Modus gar nicht, der Umschalter waere wirkungslos.
 *
 * Seitenverhaeltnis 180:132 stammt aus der viewBox der Vorlage.
 */
function Signet({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 bg-accent ${className}`}
      style={{
        aspectRatio: '180 / 132',
        maskImage: 'url(/marke/wearify-signet-light.svg)',
        WebkitMaskImage: 'url(/marke/wearify-signet-light.svg)',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
      }}
    />
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
 * Das Handbuch nennt 56px als Mindestgroesse fuer das Signet. Hier steht es
 * bewusst kleiner: In einer 64px hohen Kopfzeile liesse sich die Vorgabe
 * nicht einhalten, ohne die Leiste zu sprengen. Im Verbund mit der Wortmarke
 * traegt das Zeichen die Erkennbarkeit ohnehin nicht allein -- anders als
 * freistehend, worauf die Vorgabe zielt.
 */
export function Marke({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Signet className="h-[22px]" />
      <Wortmarke />
    </span>
  );
}

/**
 * Der volle Sperrsatz mit Claim -- fuer die Fusszeile, wo Platz ist.
 *
 * Der Claim steht bewusst NUR hier und nicht zusaetzlich im Kopf: Zweimal
 * dieselbe Aussage auf einer Seite schwaecht sie, statt sie zu verstaerken.
 */
export function MarkeMitClaim({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center gap-3 md:flex-row md:gap-4 ${className}`}>
      <Signet className="h-14" />
      <span className="flex flex-col items-center gap-1 md:items-start">
        <Wortmarke className="text-ink" />
        <span className="whitespace-nowrap font-marke text-[10px] font-light uppercase tracking-[0.28em] -mr-[0.28em] text-muted">
          Dein Kleid. Dein Look.
        </span>
      </span>
    </span>
  );
}
