"use client";

import { useState } from "react";

/*
  Eigener Client-Baustein statt eines simplen <Link>: das Stripe Customer
  Portal braucht serverseitig eine frische Portal-Session (Stripe erlaubt
  keine statische URL dafuer). Der Klick loest also erst einen Request aus,
  der die Weiterleitung liefert.
*/
export function ManageSubscriptionLink() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Konnte nicht geöffnet werden.");
    } catch {
      setError("Konnte nicht geöffnet werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-50"
      >
        {loading ? "Öffnet …" : "Abo verwalten"}
      </button>
      {error && <span className="text-xs text-accent">{error}</span>}
    </span>
  );
}
