# Catch the King Helper

**Solver, trainer and move-review for the Metin2 event mini-game “Catch the King” (Schnapp den König / Prinde Regele).**

Pure HTML/CSS/JS — no build step, no dependencies, works offline as a PWA.
Open `index.html` through any static server (or the GitHub Pages deployment) and play.

## What it does

- **Live helper** — mirror your in-game board (tap a card → value, mark flashes), get the strongest next move with human-readable reasoning, per-cell 5-probability heatmap, and a live gold-chance meter.
- **Practice mode** — unlimited simulated boards with the real rules. Train the risk decisions without spending King Decks. Optional coach compares your move with the solver's.
- **Blunder review** — after any game, every move is re-evaluated: chess-style grades (best / good / inaccuracy / blunder), the better move where one existed, and a gold-chance timeline.
- **Stats** — local record of your games, score distribution, gold rate, import/export as JSON. Everything stays in your browser.
- **Mobile-first + desktop keyboard** — tap-first UI, or hover + `1‑5`/`K` (with `Shift` for flash), `Backspace` undo, `Esc` new game.
- **EN / DE / RO**, installable PWA, fully offline after first load.

## Game rules (as implemented)

25 face-down cards on a 5×5 board: `7×1, 4×2, 5×3, 5×4, 3×5, 1×K`.
Points = face×10, King = 100. Hand sequence: `1 1 1 1 1 2 2 3 3 4 5 K`.

- Hand **higher** → score the card, turn continues (chain). **Equal** → score, turn ends. **Lower** → no points, turn ends; the card stays face-up and *catchable*.
- Each move you may reveal a face-down card **or catch** a face-up unscored one (same comparison rules — chain-catches are free actions).
- The **K hand card never chains**: it beats only the board King (“catch the king in exactly one move”, +100) and loses to everything else.
- **Flash / 5-rule**: a flipped card flashes if a face-down 5 is among its 8 neighbors. Playing your hand-5 onto a cell adjacent to any 5 gets it captured (0 points, turn ends).
- **Bingo**: +10 for each fully *scored* row / column / diagonal (12 lines).
- Chests: Bronze 100–399 · Silver 400–549 · **Gold 550+**.

Edge-case behaviors sit behind flags in `js/engine/rules.js` (`DEFAULT_RULE_FLAGS`) so a
discrepancy discovered during a live event is a one-line fix.

## The solver

Four cooperating layers, all sharing one pure ES-module engine:

1. **Exact belief tracking** — flash observations are recorded *at event time* and resolved into constraints over 5-placements; with ≤3 fives this is enumerated exactly (≤ C(25,3) = 2300 placements), giving exact per-cell probabilities and exact posterior board sampling. Value counts factorize exactly conditional on the placement.
2. **Heuristic policy** — fodder-economics model (a lost reveal is deferred points for a later hand), turn-continuation value, 5-turn safety, bingo shaping, information gain about the 5s. Weights machine-tuned by seeded self-play random search (`tools/tune.js`).
3. **Rollout move selection** — at every non-forced decision, candidates are evaluated by Monte-Carlo rollouts on boards sampled from the exact posterior (common random numbers across candidates, two-stage selection against the winner's curse), maximizing **P(score ≥ 550)** — not expected score.
4. **Exact endgame** — belief-state expectimax with memoization when ≤7 cells are hidden, maximizing the true gold probability.

Forced moves (opening book, provably-free chain-catches) skip the expensive machinery.

## Benchmarks

Reproducible with the Node tools (no build needed):

```
node --test test/                         # engine + belief unit tests (incl. soundness fuzz)
node tools/bench.js --n 20000 --seed 1    # single-thread benchmark
node tools/bench-par.js --solver rollout --n 100000 --seed 1   # parallel benchmark
node tools/bench-par.js --a heuristic --b rollout --n 5000     # paired A/B (CRN)
node tools/trace.js 7                     # watch one game move by move
```

Self-play gold rates (fresh seeds, Wilson 95% CI):

| Policy | Gold rate | Notes |
|---|---|---|
| Tuned heuristic alone | ~30.6% | n=30k |
| + rollouts & exact endgame (`rollout`) | see table in releases | n≥100k confirmation run |
| Reference helper (jogoe v0.12.10) | 44.8% | their published 100k self-play figure |

*(Benchmark numbers in this table are updated from the exact runs documented in the commit that changes them.)*

**A note on comparability:** our simulation uses the slightly *stricter* real-game 5-capture rule (a revealed 5 neighbor also captures the hand-5, not only a face-down one), which the reference solver respects in play but does not model in its simulator. If anything this makes our self-play numbers conservative relative to theirs.

## Repository layout

```
index.html, css/, icons/, manifest.webmanifest, sw.js   — the app (static, offline-capable)
js/engine/    rules, 25-bit bitboards, game state, exact belief (shared everywhere)
js/solver/    heuristic, rollouts, exact endgame, Web Worker entry
js/ui/        board, panels, picker, review, stats views
js/i18n/      en / de / ro dictionaries
js/practice/  (practice logic lives in ui/main.js — simulated dealer uses the engine sampler)
tools/        Node-only: bench, parallel bench, paired A/B, tuner, tracer
test/         node --test suites
```

## Development

No toolchain: edit, serve statically (`python -m http.server`), refresh.
Tests and benchmarks run on plain Node ≥ 20 (`node --test test/`).

## Credits & disclaimers

- Rules verified against the [official Metin2 wiki](https://en-wiki.metin2.gameforge.com/index.php/Catch_the_King) and community documentation.
- Inspired by (and benchmarked against) [jogoe's CTK helper](https://dominikloefflerniteo.github.io/ctk-helper-jogoe/ctk/) — a clean-room reimplementation; no code was copied.
- Fan tool. Not affiliated with Gameforge. Use at your own discretion.
