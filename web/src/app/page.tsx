import Image from "next/image";
import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

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
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-10 text-center md:pt-24">
          <p className="kicker">KI-Anprobe für Vinted und Kleinanzeigen</p>

          <h1 className="display mx-auto mt-6 max-w-4xl text-5xl md:text-8xl">
            Anziehen,<br />
            ohne <em>anzuziehen</em>.
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-lg text-ink-soft md:text-xl">
            Ein Foto von dir. Ein Kleidungsstück. Ein realistisches Anprobebild
            samt fertigem Verkaufstext — in unter einer Minute.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/registrieren" size="lg">Kostenlos starten</LinkButton>
            <LinkButton href="/#so-gehts" variant="outline" size="lg">So funktioniert's</LinkButton>
          </div>

          {/* Vorher/Nachher */}
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 overflow-hidden rounded-md border border-line">
            <figure className="relative">
              <Image
                src="/examples/beispiel-1.png"
                alt="Originalfoto vor der Anprobe"
                width={716}
                height={716}
                priority
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

          <dl className="mx-auto mt-10 flex max-w-2xl flex-wrap items-start justify-center gap-x-16 gap-y-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="text-3xl font-semibold tracking-tight text-ink">{s.value}</dt>
                <dd className="mt-1 text-sm text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
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
      </main>

      <SiteFooter />
    </>
  );
}
