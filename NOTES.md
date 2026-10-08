# Bias Spotter — agent & project notes

> **For AI agents:** Read this file first. Do not ask the user to re-explain repo layout, tiers, or deploy unless something here is outdated.

## What this is

**Bias Spotter** — a calm cognitive-bias quiz for beginners. Static web app (HTML + CSS + vanilla JS). No framework, no build step, no backend.

- **Tone:** light, everyday language; relatable scenarios; mentor-style explanations for the owner (beginner, builds mainly via agents).
- **Owner workflow:** Cloud Agent in browser → push to GitHub → check live Vercel link. Local coding optional.

## Live site & deploy

| Item | Value |
|------|--------|
| **GitHub repo** | `andreeanesu/Bias-Spotter` |
| **Production branch** | `main` |
| **App folder (Vercel Root Directory)** | `bias-spotter` |
| **Live URL** | `https://second-thought-pi.vercel.app` |
| **Vercel** | Framework: **Other**, Build Command: **empty**, auto-deploy on push to `main` |

After code changes: push to `main` → wait ~1–2 min → refresh Vercel URL.

**Note:** If an older Vercel project still has Root Directory `second-thought`, change it to `bias-spotter` and redeploy.

## Run locally (optional)

```bash
cd bias-spotter
python3 -m http.server 8080
# → http://localhost:8080
```

Do not open `index.html` directly (JSON fetch will fail).

## Content scale (current)

| Tier | Biases | Questions | Notes |
|------|--------|-----------|--------|
| Tier 1 | 20 (B001–B020) | 60 | Original set, all familiar |
| Tier 2 | 20 (B021–B040) | 60 | Trickier patterns |
| Tier 3 | 20 (B041–B060) | 60 | Subtle & nuanced |
| **Mix** | 60 total | **180** | All tiers |

- **3 questions per bias** (Recognition / Application / Ambiguous per bias block).
- **5 questions per round**, shuffled, no repeat within a tier until all seen, then cycle resets.

## Source of truth for content

1. Edit **`bias-spotter/data/source/cognitive_bias_trainer.xlsx`**
   - Sheets: Bias Library, Challenge Library, Categories
   - Bias Library has **`Tier`** column (1, 2, or 3)
2. Regenerate JSON:
   ```bash
   python3 bias-spotter/scripts/convert-excel.py
   ```
3. Commit Excel + generated `data/*.json` together.

To bulk-add biases/challenges from scripts, see `bias-spotter/scripts/expand-content.py` and `expand_content_data_*.py`.

## Key code files

```
bias-spotter/
├── index.html              # start screen, quiz, finish screen
├── js/app.js               # boot + flow
├── js/quiz-engine.js       # tiers, sessions, localStorage progress
├── js/ui.js                # render + animations
├── js/data-loader.js       # fetch JSON, play modes, feedback HTML
├── data/biases.json
├── data/challenges.json
└── styles.css
```

## App behaviour (do not break without asking)

- **Start screen:** pick Tier 1, 2, 3, or Mix — shows `seen / total` per tier.
- **Progress:** `localStorage` key `bias-spotter-tier-progress` (migrates from older `second-thought-*` keys).
- **Finish screen:** “Start another round” (same tier) or “Choose another level”.
- **Feedback:** shows “Why we do this” + reflection only (not full explanation block).
- **Footer:** bias **category** (from Bias Library), not real-world context.

## Conventions for changes

- Match existing voice and file style; minimal diffs.
- Wrong-answer options must be **bias names** that exist in `biases.json`.
- Use academically established bias names.
- Prefer everyday scenarios (work, home, relationships, health, social media) — avoid niche settings.
- Branch naming for agent work: `cursor/<short-description>-3a74` (if not committing directly to `main`).

## Common tasks

| Task | Where to look |
|------|----------------|
| Add/edit scenarios | Excel → `convert-excel.py` |
| Tier logic / progress | `js/quiz-engine.js` |
| Start / finish UI | `index.html`, `js/ui.js`, `styles.css` |
| Play mode labels | `js/data-loader.js` → `getPlayModes()` |
| 404 on Vercel | Root Directory must be `bias-spotter`; branch `main` |

## Prompt template for new agent chats

Copy, fill in, start a **new** chat (saves tokens):

```
Repo: andreeanesu/Bias-Spotter, branch main.
Read NOTES.md and bias-spotter/ before changing code.
Task: [one specific thing].
Constraints: beginner owner, light tone, minimal diff, push to main when done.
Live check: Vercel URL in NOTES.md.
```

## Changelog (high level)

- Renamed product from Second Thought → Bias Spotter (app folder `bias-spotter`, GitHub repo `Bias-Spotter`)
- Tier start screen + per-tier progress in localStorage
- Expanded from 20 → 60 biases, 60 → 180 questions
- Merged to `main`; Vercel deploy with Root Directory `bias-spotter`
