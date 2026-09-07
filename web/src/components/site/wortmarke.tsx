/*
  Die Wortmarke "Wearify" -- eine Quelle fuer alle fuenf Stellen, an denen sie
  auftaucht (beide Kopfzeilen, mobiles Menue, Anmeldeseiten, Fusszeile).

  Warum Text und kein Bild:
  Die mitgelieferten PNG-Sperrsaetze enthalten zusaetzlich den Claim ("Dein
  Kleid. Dein Look."), der bei 15px Kopfzeilenhoehe unlesbar waere -- und ein
  Bild waere dort ohnehin unscharf, nicht markierbar und muesste fuer hell und
  dunkel doppelt geladen werden. Als Text folgt die Marke automatisch dem
  Farbschema, bleibt in jeder Groesse scharf und wird vorgelesen.

  Die Werte stammen unveraendert aus dem Markenhandbuch: Jost Light,
  Tracking 340 (= 0.34em).

  Bewusst OHNE Signet: Das Handbuch nennt 56px als Mindestgroesse fuer das
  Zeichen. In einer 64px hohen Kopfzeile bliebe dafuer kein Platz, ohne die
  Vorgabe zu verletzen. Das Signet sitzt deshalb dort, wo es gross genug sein
  darf -- Favicon (30px sind laut Handbuch zulaessig) und Vorschaubild fuer
  geteilte Links.
*/
export function Wortmarke({ className = '' }: { className?: string }) {
  return (
    /*
      -mr-[0.34em] gleicht den Zwischenraum aus, den die Laufweite HINTER dem
      letzten Buchstaben erzeugt. Ohne diese Korrektur saesse die Marke
      sichtbar zu weit links in jedem rechtsbuendigen oder zentrierten
      Zusammenhang -- ein klassischer Tracking-Fehler.
    */
    <span
      className={`font-marke font-light uppercase tracking-[0.34em] -mr-[0.34em] ${className}`}
    >
      Wearify
    </span>
  );
}
