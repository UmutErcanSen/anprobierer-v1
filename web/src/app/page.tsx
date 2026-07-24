import Image from "next/image";
import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
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

const STATS = [
  { value: "30 Sek.", label: "pro Anprobe" },
  { value: "2.400+", label: "Anzeigen erstellt" },
  { value: "5 gratis", label: "zum Ausprobieren" },
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
          <div className="flex flex-col justify-center px-6 py-16 md:px-12 lg:px-16">
            <p className="kicker">KI-Anprobe für Vinted und Kleinanzeigen</p>

            <h1 className="display mt-6 text-5xl sm:text-6xl lg:text-7xl">
              Anziehen,<br />
              ohne <em>anzuziehen</em>.
            </h1>

            <p className="mt-7 max-w-md text-lg text-ink-soft">
              Ein Foto von dir. Ein Kleidungsstück. Ein realistisches Anprobebild
              samt fertigem Verkaufstext — in unter einer Minute.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="/registrieren" size="lg">Kostenlos starten</LinkButton>
              <LinkButton href="/#so-gehts" variant="outline" size="lg">So funktioniert's</LinkButton>
            </div>

            <p className="mt-6 text-sm text-muted">
              5 Gratis-Anproben · keine Zahlungsdaten nötig
            </p>
          </div>

          <div className="relative min-h-[52vh] border-t border-line md:min-h-0 md:border-t-0 md:border-l">
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

        {/* Vorher/Nachher als Beleg der Verwandlung */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
            <p className="kicker">Aus einem Alltagsfoto</p>
            <h2 className="display mx-auto mt-5 max-w-2xl text-3xl md:text-5xl">
              Vorher, <em>nachher</em>.
            </h2>

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
              <figure className="relative border-l border-paper">
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
                  <dt className="text-3xl font-semibold tracking-tight text-ink">{s.value}</dt>
                  <dd className="mt-1 text-sm text-muted">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* So funktioniert's */}
        <section id="so-gehts" className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <h2 className="display max-w-2xl text-3xl md:text-5xl">
              In drei Schritten <em>fertig</em>.
            </h2>
            <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="bg-paper p-8">
                  <span className="font-mono text-sm text-muted">{step.n}</span>
                  <h3 className="mt-5 text-xl font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <LinkButton href="/registrieren" size="lg">Jetzt kostenlos starten</LinkButton>
              <span className="text-sm text-muted">5 Gratis-Anproben · keine Zahlungsdaten nötig</span>
            </div>
          </div>
        </section>

        {/* Plattform-Export als eigener Beweis-Punkt: knapp gehalten, gleiche
            Bausteine (kicker/display/Kartenraster) wie die Sektionen oben,
            damit sich nichts "aufgesetzt" anfühlt. */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <p className="kicker">Fertig zum Einfügen</p>
            <h2 className="display max-w-2xl text-3xl md:text-5xl">
              Ein Klick — <em>passend</em> für jede Plattform.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              Vinted, Kleinanzeigen und eBay haben jeweils einen eigenen Ton und
              ihr eigenes Zeichenlimit. Ein Klick bereitet Titel, Beschreibung und
              Bild passend vor und öffnet die richtige Seite — einfügen, fertig.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.key}
                  className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ink"
                >
                  <PlatformIcon icon={PLATFORM_ICONS[platform.key]} size={16} />
                  {platform.label}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
