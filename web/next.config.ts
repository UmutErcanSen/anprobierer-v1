import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Ohne diese Zeile sucht Turbopack sich das Wurzelverzeichnis selbst und
   * landet beim Repo-Root — dort liegt noch die package-lock.json der alten
   * Vanilla-App. Das Ergebnis wären falsch aufgelöste Module.
   * Kann entfallen, sobald die Altanwendung beim Cutover verschwindet.
   */
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // sharp ist ein natives Modul und darf nicht mitgebündelt werden — sonst
  // bricht es zur Laufzeit. Explizit als externes Server-Paket markiert.
  serverExternalPackages: ['sharp'],
};

export default nextConfig;
