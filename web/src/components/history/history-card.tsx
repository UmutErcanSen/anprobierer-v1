import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Loader2, Lock } from 'lucide-react';
import { FavoriteToggle } from '@/components/history/favorite-toggle';
import { CLOTHING_TYPES, COLOR_SWATCH, type ClothingType } from '@/lib/generation/constants';

export type HistoryGeneration = {
  id: string;
  status: string;
  mode: string;
  quality: string;
  credits_charged: number;
  created_at: string;
  imageCount: number;
  isFavorite: boolean;
  categories: string[];
  sizes: string[];
  colors: string[];
  /** Free-Tarif ab dem zweiten Ergebnis (siehe lock.ts) -- das Thumbnail ist
   * bereits die serverseitig unscharfe Variante, hier nur noch als Hinweis
   * markieren. */
  locked: boolean;
};

const MODE_LABEL: Record<string, string> = { single: 'Einzeln', combined: 'Kombiniert' };

/** Eindeutige, lesbare Werte -- eine Generierung mit mehreren Stuecken kann
 * z.B. zweimal "Jeans" enthalten, das soll nicht zweimal auftauchen. */
function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

function StatusBadge({ status }: { status: string }) {
  if (status === 'succeeded') {
    return <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">Fertig</span>;
  }
  if (status === 'failed') {
    return <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">Fehlgeschlagen</span>;
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
      <Loader2 size={11} className="animate-spin" aria-hidden /> In Bearbeitung
    </span>
  );
}

/* Modus ist kein Zustand, sondern eine Eigenschaft -- bekommt bewusst KEINE
   eigene Signalfarbe (die App hat genau einen Akzent, Farbe ist Status
   vorbehalten). Stattdessen ein neutrales, umrandetes Tag mit leichtem
   Frosted-Hintergrund, damit es sich trotzdem vom farbigen Status-Badge
   abhebt, ohne mit ihm um Aufmerksamkeit zu konkurrieren. */
function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="rounded-full border border-line-strong bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink">
      {MODE_LABEL[mode] ?? mode}
    </span>
  );
}

/** Eine Karte im Verlauf-Raster. Rein darstellend -- die Daten (inkl. signierter Thumbnail-URL) kommen fertig von der Server Component. */
export function HistoryCard({ generation, thumbnail }: { generation: HistoryGeneration; thumbnail: string | null }) {
  const { id, status, mode, quality, credits_charged, created_at, imageCount, isFavorite, categories, sizes, colors, locked } =
    generation;

  const categoryList = unique(categories.map((c) => CLOTHING_TYPES[c as ClothingType]?.de ?? c));
  const sizeLabel = unique(sizes).join(', ');
  const colorList = unique(colors);

  return (
    <li>
      <Link
        href={`/konto/verlauf/${id}`}
        className="group flex flex-col overflow-hidden rounded-xl border border-line transition-colors hover:border-line-strong"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt=""
              fill
              unoptimized
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <ImageOff size={20} aria-hidden />
            </div>
          )}
          {/* Beide Badges in EINER Ecke statt gegenueberliegend: bei
              schmalen Karten (viele Spalten) stiessen "Fehlgeschlagen" links
              und "Kombiniert" rechts sonst zusammen und ueberlappten sich. */}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            <StatusBadge status={status} />
            <ModeBadge mode={mode} />
          </div>
          <div className="absolute right-2 top-2">
            <FavoriteToggle generationId={id} initialFavorite={isFavorite} />
          </div>
          {locked && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink">
              <Lock size={11} aria-hidden /> Vorschau
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          <span className="text-sm font-medium text-ink">{dateFormat.format(new Date(created_at))}</span>
          <span className="text-xs text-muted">
            {imageCount} {imageCount === 1 ? 'Bild' : 'Bilder'}
            {quality === 'hd' && ' · HD'} · {credits_charged} {credits_charged === 1 ? 'Credit' : 'Credits'}
          </span>
          {/* Kategorie und Farbe je in eigener Zeile statt in einer
              gemeinsamen Zeile mit der Groesse -- bei mehreren Stuecken pro
              Generierung liefen Kategorie/Groesse/Farbe-Punkte vorher schnell
              zusammen und waren auf einen Blick schwer auseinanderzuhalten.
              Als Tag/Pill statt Fliesstext, damit jeder Wert als eigenstaen-
              diger Chip erkennbar ist -- die Farbe traegt ihren Musterkreis
              direkt im Tag statt als separate Punktreihe. Nur anzeigen, wenn
              ueberhaupt Daten da sind (aeltere Generierungen vor der
              Attribut-Migration haben keine). */}
          {(categoryList.length > 0 || colorList.length > 0) && (
            <div className="mt-1.5 flex flex-col gap-1">
              {categoryList.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {categoryList.map((c) => (
                    <span
                      key={c}
                      className="truncate rounded-full border border-line-strong bg-surface px-2 py-0.5 text-[11px] text-ink-soft"
                    >
                      {c}
                      {sizeLabel ? ` · ${sizeLabel}` : ''}
                    </span>
                  ))}
                </div>
              )}
              {colorList.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {colorList.map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-[11px] text-ink-soft"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full border border-line-strong"
                        aria-hidden
                        style={{ background: COLOR_SWATCH[c as keyof typeof COLOR_SWATCH] ?? c }}
                      />
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
