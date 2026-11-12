# SportsYurt brand pack v4

## What's in v4
- Full gamut: the signature **peach → salmon → rose** gradient, **lavender** as the secondary colour, charcoal and a grey ramp.
- Twelve colourways, including canary, mauve, charcoal & lavender, British racing green, and neon pink (light and dark).
- **App icons are the symbol only, at every size.** The device shows the app name under the icon, so the icon carries no words. This also follows Apple's guidance to keep text out of app icons.
- **The wordmark always reads as one word: "sportsyurt".** It's never split into "sports" / "yurt" or shortened to "sport". Every lockup uses the full wordmark in a single colour:
  - horizontal;
  - stacked (the symbol above the wordmark);
  - social square.

## Palette
| Name | Hex | CSS variable | Role |
|---|---|---|---|
| Peach | `#FDC7A2` | `--sy-peach` | Top of the signature gradient; warm highlight tone |
| Salmon | `#FB928D` | `--sy-salmon` | Middle of the signature gradient; the core brand colour |
| Rose salmon | `#FC657E` | `--sy-rose` | Base of the signature gradient; adds depth and energy |
| Lavender | `#E7D7E7` | `--sy-lavender` | Secondary brand colour: the flap, wordmark on dark, light tile tint |
| Lavender mist | `#F7F1F7` | `--sy-lavender-mist` | Light backgrounds and light icon tiles |
| Charcoal | `#222026` | `--sy-charcoal` | Wordmark and type on light backgrounds; primary dark |
| Graphite | `#3A3740` | `--sy-graphite` | Top of dark tile gradients |
| Night | `#17151B` | `--sy-night` | Deepest dark; base of dark tile gradients |
| Grey | `#8E8A93` | `--sy-grey` | Secondary text, greyscale symbol base |
| Silver | `#C9C6CC` | `--sy-silver` | Greyscale highlights and dividers |
| Mist | `#ECEAEE` | `--sy-mist` | Neutral light backgrounds |
| Off-white | `#F4F1F6` | `--sy-offwhite` | Court and type in dark mode |
| White | `#FFFFFF` | `--sy-white` | Court on light backgrounds |
| Butter | `#FFE680` | `--sy-canary-1` | Canary gradient top |
| Golden canary | `#FFC93D` | `--sy-canary-2` | Canary gradient base: bright, optimistic, warm enough to sit with peach |
| Mauve light | `#D7B4D2` | `--sy-mauve-1` | Mauve gradient top |
| Mauve | `#9C6B98` | `--sy-mauve-2` | Mauve gradient base: soft, premium |
| Racing green light | `#2F6E4F` | `--sy-brg-1` | British racing green gradient top |
| British racing green | `#0B3D26` | `--sy-brg-2` | Gradient base: heritage motorsport green |
| Cream | `#F3EAD3` | `--sy-cream` | Symbol and type on racing green (classic livery) |
| Neon pink light | `#FF5DB8` | `--sy-neon-1` | Neon gradient top |
| Neon pink | `#FF1A8C` | `--sy-neon-2` | Neon gradient base: high-energy accent |

Gradients are vertical and linear, top to bottom. They are also in `palette.css` as `--sy-gradient-*`:
- **Signature:** #FDC7A2 → #FB928D → #FC657E
- **Canary:** #FFE680 → #FFC93D
- **Mauve:** #D7B4D2 → #9C6B98
- **Charcoal:** #4A4752 → #17151B
- **British racing green:** #2F6E4F → #0B3D26
- **Neon pink:** #FF5DB8 → #FF1A8C

## Colourways
| Key | Name | Description | Wordmark colour |
|---|---|---|---|
| `signature-light` | Signature light | Primary icon: signature gradient on lavender-white glass, lavender flap | `#222026` |
| `signature-dark` | Signature dark | Dark mode: signature gradient on graphite-to-night glass | `#E7D7E7` |
| `salmon` | Salmon | White knockout symbol on the signature gradient tile | `#222026` |
| `lavender` | Lavender | Signature symbol on a lavender tile | `#222026` |
| `canary` | Canary | Charcoal on butter-to-golden canary | `#222026` |
| `mauve` | Mauve | White on mauve | `#FFFFFF` |
| `charcoal` | Charcoal & lavender | Lavender-white on charcoal, lavender wordmark | `#E7D7E7` |
| `racing-green` | British racing green | Cream on British racing green | `#F3EAD3` |
| `neon-light` | Neon pink (light) | Neon pink on white | `#222026` |
| `neon-dark` | Neon pink (dark) | Neon pink with soft glow on black | `#FF5DB8` |
| `grey-light` | Greyscale (light) | Greyscale symbol on light grey | `#222026` |
| `grey-dark` | Greyscale (dark) | Greyscale symbol on dark grey | `#ECEAEE` |

## Folders
- `sportsyurt_brand_study_v4.png`: the overview board.
- `logo/` (vector SVG for every colourway, with PNG previews in `logo/png/`):
  - `symbol/`
  - `lockup/` (horizontal)
  - `stacked/` (symbol above the full wordmark)
  - `wordmark/`
  - `social/` (1080 squares; signature-light is on white)
- `app-icons/`:
  - `4k/`: 4096 px 3D symbol masters.
  - `colourways/<key>/`: 2048–32 px.
  - `ios-ipados/`: light, dark and tinted sets, plus Icon Composer layers.
  - `android/`: res/mipmap-*, adaptive layers and the Play Store icon.
  - `macos/`: the .iconset folder and AppIcon.icns.
  - `windows/`: .ico and tile PNGs.
- `web/`: the favicons (svg/ico/png), apple-touch-icon, PWA icons, the maskable icon, site.webmanifest and head-snippet.html.
- `palette.json` and `palette.css`: the colour tokens.

## Usage rules
- Don't split, recolour part of, or shorten the wordmark.
- Keep 10% clear space around app icons.
- Use the favicon without the court marking at 16–32 px.

## Notes and design decisions
- Colour requests were treated as palette direction, not fixed rules:
  - canary is warmed so it sits with the peach;
  - the charcoal colourway pairs with lavender;
  - the flap is lavender in the signature colourways;
  - racing green uses cream, as in classic livery.
- The hex values are sampled from the Nothing Sport reference and refined by eye. They are **not** verified brand-master values; check them against any official swatches before print.
- The Android adaptive foreground and the Icon Composer layers are flat on purpose: those platforms add their own depth and gloss.
- Wordmark: "sportsyurt", Manrope Medium 500 with "yurt" in Bold 700, the yurt "o" and the shared rt crossbars, charcoal #222026 on light.
