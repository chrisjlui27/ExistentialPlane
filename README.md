# Book of Sheets

Dessin Logic Engine v0.1: a single offline web page for the Galaxy Tab A11. Pick or type a dessin, draw cuts and place letters on the base sphere with one finger, and three things update live:

- **What each cut is.** Minimal (it bounds a disk with no marked point), or an end-cut around 0, 1 or ∞.
- **The three readings.** The planar reading of the page at 0, at 1 and at ∞, plus an entailment check P ⊨ Q with a counter-valuation wherever it fails.
- **The lift.** Each cut drawn on the N sheets, coloured and dashed by lifted component, with the component count checked against the cycle structure.

Every verdict comes from exact data: permutations, crossing words, area trees and truth tables. Floating-point geometry only draws.

## Files

| Path | What it is |
| --- | --- |
| `book-of-sheets.html` | The whole app: one file, no libraries, no network, about 100 KB. |
| `tools/run-suite-node.mjs` | Runs the acceptance suite (T1–T14) on the pure code under Node. |
| `tools/headless.cjs` | Headless Chromium at a 1340 × 800 touch viewport: the suite, the four flows with real touch events, reload and export/import, screenshots. |
| `tools/build-artifact.mjs` | Writes the artifact copy (the same page without the standalone `<html>`/`<head>` wrapper). |
| `docs/screenshots/` | Screenshots from the last headless run. |

## Install on the tablet

1. Open the published link in Chrome on the tablet, then ⋮ → **Add to Home screen**. It opens full screen from the icon.
2. Offline fallback: save `book-of-sheets.html` to the tablet and open it from My Files in Chrome. Browser storage may be unavailable that way; the app keeps working without it, and **⋯ → Save session (JSON)** is the backup.

The About panel opens on first run and shows the viewport size and `devicePixelRatio` Chrome reports, plus stroke and grid timings.

## Using it

| Gesture | Mode | Effect |
| --- | --- | --- |
| One-finger drag | Cut | Draws a cut; it is validated when the finger lifts near the start |
| Tap | Letter | Places the selected letter (A to H) |
| Tap a cut or letter | Erase | Removes it (undoable) |
| Pinch, two-finger drag | Any | Zooms and pans the base page |
| Double-tap on empty space | Any | Resets the view |
| Long-press a cut | Any | Shows its class and crossing word, and highlights its lift |
| Tap a marked point | Any | Pins that point's reading at the top of the panel |
| Tap a sheet thumbnail | Sheets tab | Enlarges that sheet; tap off the curves to return |
| Tap a lifted component | Sheets tab | Highlights it on every sheet and its source cut on the base |

Relabel with ↻, 0↔1, 0↔∞ and 1↔∞: the drawing stays put, the badges move, the triple is recomputed from the triangle complex, and pages P and Q move together. Undo and redo keep 50 steps.

## Tests

```sh
node tools/run-suite-node.mjs   # T1–T14 on the pure code, no browser
node tools/headless.cjs         # full headless handover run, writes docs/screenshots/
```

Opening the page with `#test` runs the same suite in the browser, so it can run on the tablet itself. **⋯ → Run tests** does the same from the menu.

Last headless run: all 13 automated tests pass (T14, speed, is judged on the tablet), and 35 of 35 headless checks pass, including the four flows, reload restore, JSON export then import, and PNG export.

## Conventions

- Darts are 0 … N−1 inside, 1 … N on screen. A permutation is an array `p` with `p[i]` the image of `i`; `(στ)(i) = σ(τ(i))`.
- The gluing table is the one source of truth: over (0,1) T⁺_e meets T⁻_e, over (∞,0) T⁺_e meets T⁻_σ₀(e), over (1,∞) T⁻_e meets T⁺_σ₁(e). Counterclockwise corner walks give σ₀, σ₁ and σ∞ = (σ₁σ₀)⁻¹.
- The base sphere is drawn through M(z) = (ωz + 1)/(ω²z + 1): 0, 1, ∞ sit at 1, ω, ω²; the arc (0,1) is the dart (solid), the other two arcs are slits (dashed).
