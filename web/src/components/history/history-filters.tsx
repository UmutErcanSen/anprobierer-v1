'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/field';

/*
  Zwei Filter fuer den Anproben-Verlauf. Aendert die URL-Query statt lokalen
  State zu halten -- so bleibt der Filter beim Neuladen, beim Teilen des Links
  und beim Zurueck-Navigieren erhalten, und die Liste selbst bleibt eine
  Server Component (keine Duplizierung der Datenabfrage im Client).
*/
export function HistoryFilters({ status, mode }: { status: string; mode: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: 'status' | 'mode', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    params.delete('page'); // neuer Filter -> zurueck auf Seite 1
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <div className="w-48">
        <Select aria-label="Nach Status filtern" value={status} onChange={(e) => update('status', e.target.value)}>
          <option value="all">Alle Status</option>
          <option value="succeeded">Fertig</option>
          <option value="failed">Fehlgeschlagen</option>
          <option value="in_progress">In Bearbeitung</option>
        </Select>
      </div>
      <div className="w-48">
        <Select aria-label="Nach Modus filtern" value={mode} onChange={(e) => update('mode', e.target.value)}>
          <option value="all">Alle Modi</option>
          <option value="single">Einzeln</option>
          <option value="combined">Kombiniert</option>
        </Select>
      </div>
    </div>
  );
}
