# MWEDONDAY

A retro 16-bit arcade workout timer. Vanilla JS, no build step, static deploy.

Live: https://alexstorer.github.io/mwedonday/

## Modes

- **Circuit** — work/rest intervals; one cycle = a full pass through every exercise
- **AMRAP** — as many rounds as possible in a fixed time cap, tap `+1 ROUND` per cycle
- **Reps** — checklist per round, tap exercises off (or `FINISH SET` / `FINISH ROUND`)
- **Ladder** — free-climb timed box; `▲ UP`, `↻ AGAIN`, `▼ DOWN` after each set

## Features

- Pixel-art monkey mascot with optional Web Speech announcements (supportive / mean / off)
- WebAudio chiptune SFX (no MP3s; ladder UP/AGAIN/DOWN sound distinct)
- Shareable workout URLs (config encoded in the hash)
- Live tab title timer, optional Screen Wake Lock, CRT scanline overlay
- Today's training log accumulated in-session
- Mobile-first, single-column layout

## Local dev

```bash
python3 -m http.server 8765
# open http://localhost:8765/
```

## Tech

Plain `index.html` + `styles.css` + ES module JS (`app.js`, `monkey.js`, `audio.js`).
Deploys as-is to GitHub Pages.
