import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Loader2 } from 'lucide-react';

export type HistoryGeneration = {
  id: string;
  status: string;
  mode: string;
  quality: string;
  credits_charged: number;
  created_at: string;
  imageCount: number;
};

const MODE_LABEL: Record<string, string> = { single: 'Einzeln', combined: 'Kombiniert' };

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

/** Eine Karte im Verlauf-Raster. Rein darstellend -- die Daten (inkl. signierter Thumbnail-URL) kommen fertig von der Server Component. */
export function HistoryCard({ generation, thumbnail }: { generation: HistoryGeneration; thumbnail: string | null }) {
  const { id, status, mode, quality, credits_charged, created_at, imageCount } = generation;

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
          <div className="absolute left-2 top-2">
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          <span className="text-sm font-medium text-ink">{dateFormat.format(new Date(created_at))}</span>
          <span className="text-xs text-muted">
            {MODE_LABEL[mode] ?? mode} · {imageCount} {imageCount === 1 ? 'Bild' : 'Bilder'}
            {quality === 'hd' && ' · HD'} · {credits_charged} {credits_charged === 1 ? 'Credit' : 'Credits'}
          </span>
        </div>
      </Link>
    </li>
  );
}
