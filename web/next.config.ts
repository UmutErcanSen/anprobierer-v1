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
};

export default nextConfig;
