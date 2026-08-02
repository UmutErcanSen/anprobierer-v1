import Image from "next/image";
import { Eye, Search, ShieldCheck } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Reveal } from "@/components/site/reveal";
import { CountUp } from "@/components/site/count-up";
import { PLATFORMS } from "@/lib/generation/platforms";
import { PLATFORM_ICONS, PlatformIcon } from "@/components/generation/platform-icon";

/*
  Landing Page — Richtung "Editorial & bildstark".
  Grosse Display-Headline mit Serifen-Kursiv-Akzent, der Vorher/Nachher-
  Vergleich traegt die Seite, sonst fast reines Schwarz/Weiss.

  Die Beispielbilder sind Platzhalter (dasselbe Foto, links entfaerbt).
  Sobald echte Anproben vorliegen, wird links das hochgeladene Foto und
  rechts das generierte Ergebnis gezeigt — der ehrliche, staerkere Vergleich.
*/

// Nur Werte, die tatsaechlich stimmen -- "30 Sek. pro Anprobe" und "2.400+
// Anzeigen erstellt" waren erfundene Wunsch-Zahlen ohne Grundlage (das Produkt
// hat bisher einen einzigen Testnutzer). Fake-Social-Proof untergraebt genau
// das Vertrauen, das eine Landing Page aufbauen soll -- deshalb ausschliesslich
// Aussagen, die schon heute technisch/vertraglich zutreffen.
//
// value als Zahl statt fertigem Text: CountUp animiert nur die Ziffer, "0"
// zaehlt bewusst nicht hoch (siehe count-up.tsx) und bleibt einfach stehen.
const STATS = [
  { value: 1, suffix: " gratis", label: "Ergebnis in voller Auflösung" },
  { value: 3, suffix: " Plattformen", label: "bereit zum Einfügen" },
  { value: 0, suffix: " €", label: "ohne Zahlungsdaten" },
];

// Fuer den Logo-Marquee wiederholt, sonst wirkt das Band bei nur drei
// Plattformen zu leer. Der Track wird unten zusaetzlich selbst verdoppelt
// (Bedingung fuer die nahtlose -50%-Schleife).
const MARQUEE_TRACK = Array.from({ length: 2 }, () => PLATFORMS).flat();

// Bewusst OHNE Prozentzahl ("bis zu 75% mehr verkauft" o.ae.) -- dafuer
// fehlt jede eigene Datengrundlage (1 Testnutzer bisher), und eine
// erfundene Zahl untergraebt genau das Vertrauen, das dieser Abschnitt
// aufbauen soll. Stattdessen nachvollziehbare, fuer sich stehende Gruende,
// die kein Beleg brauchen.
const SELL_POINTS = [
  {
    icon: Eye,
    title: "Käufer scrollen weiter",
    body: "Ein unscharfes Spiegel-Selfie wirkt unseriös. Ein klares Anprobebild zeigt sofort, wie das Stück am Körper sitzt.",
  },
  {
    icon: Search,
    title: "Besser auffindbar",
    body: "Ein vollständiger, treffend formulierter Text wird von der Plattform-Suche eher gefunden als eine Zeile Stichworte.",
  },
  {
    icon: ShieldCheck,
    title: "Weniger Rückfragen",
    body: "Wer die Passform am Körper sieht, hat vor dem Kauf weniger offene Fragen — das beschleunigt den Verkauf.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Fotos hochladen",
    body: "Ein Bild von dir, ein Bild vom Kleidungsstück. Mehr braucht es nicht.",
  },
  {
    n: "02",
    title: "KI erstellt die Anprobe",
    body: "Realistisch am Körper — mit passendem Faltenwurf, Perspektive und Licht.",
  },
  {
    n: "03",
    title: "Verkaufstext dazu",
    body: "Titel und Beschreibung fertig formuliert. Einfügen und verkaufen.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Fullscreen-Hero: Text links, bildfuellendes Standbild rechts.
            Fuellt den sichtbaren Bereich (100dvh minus Header), auf Mobil
            gestapelt. Text auf Paper statt ueber dem Foto — das haelt die
            Display-Typo und den Terrakotta-Akzent gestochen lesbar. */}
        <section className="grid min-h-[calc(100dvh-4rem)] md:grid-cols-2">
          {/* hero-enter: laeuft beim Laden einmal automatisch, gestaffelt
              nach Kind-Element (kein Scroll noetig, siehe globals.css) --
              anders als Reveal unten, das auf das Erreichen des
              Sichtbereichs wartet. */}
          <div className="hero-enter flex flex-col justify-center px-6 py-16 md:px-12 lg:px-16">
            <p className="kicker">KI-Anprobe für Vinted und Kleinanzeigen</p>

            <h1 className="display mt-6 text-5xl sm:text-6xl lg:text-7xl">
              Anziehen,<br />
              ohne <em>anzuziehen</em>.
            </h1>

            <p className="mt-7 max-w-md text-lg text-ink-soft">
              Ein Foto von dir. Ein Kleidungsstück. Ein realistisches Anprobebild
              samt fertigem Verkaufstext — in unter einer Minute.
            </p>

            {/* justify-center nur auf Mobil: Kicker/Headline/Absatz bleiben
                linksbuendig, aber zwei Buttons nebeneinander sahen dort auf
                der schmalen, sonst mittigen Flaeche schief aus. Ab md wieder
                linksbuendig wie der restliche Textblock. */}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <LinkButton href="/registrieren" size="lg">Kostenlos starten</LinkButton>
              <LinkButton href="/#so-gehts" variant="outline" size="lg">So funktioniert's</LinkButton>
            </div>

            <p className="mt-6 text-sm text-muted">
              Erstes Ergebnis gratis · keine Zahlungsdaten nötig
            </p>
          </div>

          <div className="hero-image-enter relative min-h-[52vh] border-t border-line md:min-h-0 md:border-t-0 md:border-l">
            <Image
              src="/examples/beispiel-1.png"
              alt="Beispiel eines generierten Anprobebilds"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-[50%_28%]"
            />
          </div>
        </section>

        {/* Logo-Marquee direkt nach dem Hero statt ganz unten -- dort ging
            der Beweis-Punkt "passend fuer jede Plattform" bisher unter.
            pt groesser als pb: mehr Luft zur Hero-Sektion oberhalb, statt
            symmetrischem Abstand, der dort zu knapp wirkte. Nur drei
            Plattformen -- bewusst gross und mit viel Abstand statt vieler
            kleiner Wiederholungen, damit jede einzelne praesent wirkt.
            mask-image blendet den Rand weich aus, damit die Wiederholung am
            linken/rechten Bildschirmrand nicht hart abgeschnitten wirkt. */}
        <section className="overflow-hidden border-t border-line pt-16 pb-12">
          <Reveal>
            <p className="text-center text-xs uppercase tracking-[0.14em] text-muted">Verkaufsbereit auf</p>
          </Reveal>
          {/* gap waechst mit der Bildschirmbreite: bei nur drei Plattformen
              wirkte ein fixer Abstand auf breiten Desktop-Monitoren zu eng
              (die Zeile blieb "mobil-dicht", obwohl viel mehr Platz da war). */}
          <div className="mt-8 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max gap-20 animate-marquee md:gap-36 lg:gap-44">
              {[...MARQUEE_TRACK, ...MARQUEE_TRACK].map((platform, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-3.5 text-3xl font-medium tracking-tight text-ink md:gap-5 md:text-5xl"
                >
                  <PlatformIcon icon={PLATFORM_ICONS[platform.key]} size={32} className="h-8 w-8 md:h-11 md:w-11" />
                  {platform.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vorher/Nachher als Beleg der Verwandlung */}
        <section className="border-t border-line">
          <Reveal className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
            <p className="kicker">Aus einem Alltagsfoto</p>
            <h2 className="display mx-auto mt-5 max-w-2xl text-3xl md:text-5xl">
              Vorher, <em>nachher</em>.
            </h2>

            {/* wipe-reveal auf dem "Nachher"-Bild: faehrt von rechts ein,
                sobald das Elternelement (derselbe Reveal-Trigger) sichtbar
                wird -- macht die Verwandlung selbst sichtbar statt zwei
                fertige Bilder nebeneinanderzustellen. */}
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 overflow-hidden rounded-md border border-line">
              <figure className="relative">
                <Image
                  src="/examples/beispiel-1.png"
                  alt="Originalfoto vor der Anprobe"
                  width={716}
                  height={716}
                  className="h-[380px] w-full object-cover object-top grayscale md:h-[560px]"
                />
                <figcaption className="absolute bottom-4 left-4 rounded-full bg-paper/90 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-ink">
                  Vorher
                </figcaption>
              </figure>
              <figure className="wipe-reveal relative border-l border-paper">
                <Image
                  src="/examples/beispiel-1.png"
                  alt="Generiertes Anprobebild"
                  width={716}
                  height={716}
                  className="h-[380px] w-full object-cover object-top md:h-[560px]"
                />
                <figcaption className="absolute bottom-4 right-4 rounded-full bg-ink px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-on-ink">
                  Nachher
                </figcaption>
              </figure>
            </div>

            <dl className="mx-auto mt-12 flex max-w-2xl flex-wrap items-start justify-center gap-x-16 gap-y-6">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <dt className="text-3xl font-semibold tracking-tight text-ink">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </dt>
                  <dd className="mt-1 text-sm text-muted">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* Warum bessere Fotos/Texte verkaufen -- bewusst als nachvollziehbare
            Gruende statt als (unbelegte) Statistik-Behauptung aufgebaut. */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <Reveal>
              <p className="kicker">Mehr als nur ein Foto</p>
              <h2 className="display mt-5 max-w-2xl text-3xl md:text-5xl">
                Warum bessere Anzeigen <em>verkaufen</em>.
              </h2>
            </Reveal>

            {/* delay={i * 100}: die drei Karten blenden nacheinander statt
                gleichzeitig ein -- signalisiert mehr Sorgfalt als ein
                einziger Block. */}
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {SELL_POINTS.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 100}>
                  <Icon size={22} className="text-accent" aria-hidden />
                  <h3 className="mt-4 text-lg font-medium tracking-tight text-ink">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* So funktioniert's */}
        <section id="so-gehts" className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <Reveal>
              <h2 className="display max-w-2xl text-3xl md:text-5xl">
                In drei Schritten <em>fertig</em>.
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 100} className="bg-paper p-8">
                  <span className="font-mono text-sm text-muted">{step.n}</span>
                  <h3 className="mt-5 text-xl font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
                </Reveal>
              ))}
            </div>

            {/* items-center statt items-start: auf Mobil sonst linksbuendig,
                obwohl Button+Text als eigener Block optisch mittig wirken
                sollen (anders als die Ueberschrift darueber, die bewusst
                linksbuendig bleibt). Ab sm wieder normale Zeile. */}
            <Reveal className="mt-14 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
              <LinkButton href="/registrieren" size="lg">Jetzt kostenlos starten</LinkButton>
              <span className="text-sm text-muted">Erstes Ergebnis gratis · keine Zahlungsdaten nötig</span>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
