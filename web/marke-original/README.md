# Wearify · Logo-Dateien

Alle PNGs haben transparenten Hintergrund und sind @4x gerendert.
Die Dark-Varianten sind für dunkle Untergründe gedacht (nicht "PNG mit schwarzem Kasten").

## Signet (SVG — bevorzugt für Web)
| Datei | Farbe | Einsatz |
| --- | --- | --- |
| wearify-signet-light.svg | #C4471C | helle Flächen |
| wearify-signet-dark.svg | #E4713D | dunkle Flächen |
| wearify-signet-mono-white.svg | #F5F2EF | Foto, Volltonfläche |
| wearify-signet-mono-black.svg | #141210 | einfarbiger Druck |

## PNG @4x
| Datei | Pixel |
| --- | --- |
| wearify-wortmarke-light.png | 3484 × 732 |
| wearify-wortmarke-dark.png | 3484 × 732 |
| wearify-signet-light.png | 2080 × 1524 |
| wearify-signet-dark.png | 2080 × 1524 |
| wearify-horizontal-light.png | 2692 × 552 |
| wearify-horizontal-dark.png | 2692 × 552 |

## Einbau

Theme-Wechsel ohne JS:

```html
<picture>
  <source srcset="assets/wearify-horizontal-dark.png" media="(prefers-color-scheme: dark)">
  <img src="assets/wearify-horizontal-light.png" alt="Wearify" width="673" height="138">
</picture>
```

Signet als CSS-Maske, Farbe frei steuerbar:

```css
.wearify-signet {
  width: 40px; aspect-ratio: 180 / 132;
  background: #C4471C;
  mask: url(assets/wearify-signet-light.svg) center / contain no-repeat;
}
```

## Regeln
- Schutzraum: Hakenhöhe (X) an allen vier Seiten.
- Mindestgrößen: Signet 56 px digital, 30 px Favicon, 5 mm Stick/Prägung.
- Wortmarke: Jost Light, Tracking 340. Auf dunklem Grund #F5F2EF, nie reines Weiß.
- Akzent nie unverändert auf Dunkel: #C4471C → #E4713D.
- Zeichen nicht verzerren, neu einfärben oder mit Schatten versehen.

Schrift: Jost (SIL Open Font License) — https://fonts.google.com/specimen/Jost
