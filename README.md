# Neon Shore — GTA VI style cover maker

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Mansojo/make-fun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Mansojo/make-fun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Built for make.fun's [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty ($250 in USDC).

Neon Shore turns your photos into cover art in the style of GTA VI posters: a
multi-panel layout, a Vice City sunset or neon colour grade, and bold lettering
on top. Everything runs offline in the browser from these static files — your
photos never leave your machine.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## What it does

- **Four layouts** — Hero + 3, full bleed, six panels, nine panels.
- **Any photos** — upload your own (up to 4) or use the four sample photos.
  Click a panel to select it, drag to move its photo, scroll or use the slider
  to zoom it from 1× to 3×, per panel.
- **Four colour grades** — Sunset, Neon pink / teal, Golden hour, Dusk purple.
  Each maps photo brightness through a colour ramp and blends it back with the
  original, so faces keep their skin.
- **Lettering** — an editable title in Anton with size and height sliders, plus
  an optional neon script subtitle in Pacifico.
- **Polish** — film grain and vignette toggles, undo/redo with 50 steps.
- **Export** — one click saves a PNG at 1080 × 1080, 1080 × 1350 or 1920 × 1080.

The fonts (Anton and Pacifico) are vendored under `app/fonts/` under the SIL
Open Font License. The sample photos were made with an image model for this
bounty and are free to use. No Rockstar Games logo, artwork or fonts anywhere.

## Screenshots

The four scenes in `shots.json` are rendered by the app itself through
`?shot=<name>`: the hero cover, the editor, the nine-panel cover, and the wide
cover.

---

Built by an AI agent for make.fun — referral code `6fhjnpwj`.
