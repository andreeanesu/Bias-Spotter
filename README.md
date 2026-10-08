# Bias Spotter

A calm cognitive-bias quiz for learning by doing.

## Run locally

The app loads content from JSON files, so use a simple local server (opening `index.html` directly may not work in all browsers):

```bash
cd bias-spotter
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

## Project structure

```
bias-spotter/
├── data/
│   ├── source/cognitive_bias_trainer.xlsx   # your content master file
│   ├── biases.json                          # bias library
│   ├── challenges.json                      # quiz questions
│   └── categories.json                      # category lookup
├── scripts/convert-excel.py                 # Excel → JSON converter
├── js/
│   ├── data-loader.js                       # fetch + join data
│   ├── quiz-engine.js                       # 5-question shuffled sessions
│   ├── ui.js                                # render screen
│   └── app.js                               # startup wiring
├── index.html
└── styles.css
```

## Update content from Excel

1. Edit `data/source/cognitive_bias_trainer.xlsx`
2. Run: `python3 bias-spotter/scripts/convert-excel.py`
3. Refresh the browser

Each quiz round serves **5 random challenges** from the bank for the chosen level.

## Publish online (Vercel)

Bias Spotter is a static site (HTML + JSON), which is ideal for [Vercel](https://vercel.com) free hosting.

### One-time setup

1. Create a free account at [vercel.com](https://vercel.com) and sign in with **GitHub**.
2. Push your latest code to GitHub (or merge to `main`).
3. In Vercel: **Add New → Project → Import** your `Bias-Spotter` repository.
4. **Important:** open **Configure Project** and set:
   - **Root Directory:** `bias-spotter` ← most important setting
   - **Framework Preset:** Other
   - **Build Command:** leave empty
   - **Output Directory:** leave as `.`
5. Click **Deploy**.

Vercel gives you a public URL like `https://bias-spotter-xyz.vercel.app`.

### If you see a 404 after deploy

This usually means Vercel is serving the repo root instead of the `bias-spotter` folder.

**Quick test:** try `https://your-project.vercel.app/bias-spotter/`

**Permanent fix:**
1. Vercel → your project → **Settings** → **General**
2. Find **Root Directory** → set to `bias-spotter` → **Save**
3. Go to **Deployments** → open the latest deploy menu → **Redeploy**

A root-level `vercel.json` is also included as a fallback if Root Directory is left blank.

### After you change the app

Each `git push` to the connected branch triggers a new deploy automatically.

### Custom domain (optional, later)

In the Vercel project: **Settings → Domains** to add your own name (e.g. `biasspotter.app`).
