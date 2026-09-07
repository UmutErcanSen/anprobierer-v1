# Markenvorlagen (nicht ausgeliefert)

Dieser Ordner liegt bewusst NICHT unter `public/`.

Alles hier drin ist Quellmaterial: Es wird zur Laufzeit von niemandem
geladen, und in `public/` waeren es rund 590 KB, die bei jedem Deployment
mitgehen, ohne dass sie je jemand abruft.

## Was daraus entstanden ist

| Quelle | Ergebnis | Erzeugt mit |
| --- | --- | --- |
| `wearify-horizontal-light.png` | `src/app/opengraph-image.png` (1200x630) | sharp, auf Papierweiss zentriert |
| `wearify-signet-light.svg` | `src/app/apple-icon.png` (180x180) | sharp, auf #F5F2EF zentriert |
| `wearify-signet-light.svg` | `src/app/icon.svg` (Favicon) | unveraendert kopiert |

## Was tatsaechlich ausgeliefert wird

Nur `public/marke/*.svg` (je rund 900 Bytes). Aus den Original-SVGs wurde der
eingebettete C2PA-Metadatenblock entfernt -- der machte 90% der Dateigroesse
aus und hat im Web keinen Zweck.

Die Wortmarke ist KEINE Bilddatei, sondern echter Text in Jost Light mit
Tracking 340 (siehe `src/components/site/wortmarke.tsx`). Die mitgelieferten
PNG-Sperrsaetze enthalten zusaetzlich den Claim, der bei 15px Kopfzeilenhoehe
unlesbar waere.

Das Original-Handbuch des Gestalters liegt daneben in `README.md`.
