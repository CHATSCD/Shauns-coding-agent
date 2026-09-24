# OneJob Site Factory

Paste trade leads in, get deployed tap-to-call one-pagers out — built on the
locked design from [em-thomas-electric.vercel.app](https://em-thomas-electric.vercel.app).

## What it does

1. **Leads** tab — paste CSV/JSON or upload a file (`businessName, phone, industry, city, state, notes`).
   Industry is auto-detected per row (override per-row if needed), along with hero image and accent color.
2. **Build & deploy** — for each lead: pick industry kit → pick hero image → fill the locked
   `master-template/index.html` → deploy as its own static Vercel project on team `shauns`
   (or write to `out/<slug>/` in dry-run mode, no deploy).
3. **Results** tab — live URL + a paste-ready first-text pitch per business.
4. **Hero Library** tab — upload a photo for any industry any time; it's auto-cropped to
   800×450 webp and committed to the repo under `hero-library/by-industry/<industry>/`.
5. **Kits** tab — shows the configured trades (electrical, locksmith, plumbing, HVAC, handyman)
   and how many hero images each has.

## Env vars

| Var | Used for |
|---|---|
| `DEEPSEEK_API_KEY` | the legacy chat-agent tab's model calls (`/api/agent`) |
| `GITHUB_TOKEN` | pushing hero images and any agent-driven file changes |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | default repo for the above |
| `VERCEL_TOKEN` | deploying manufactured one-pagers via the Vercel API |
| `VERCEL_TEAM_ID` | `team_XGXRFTIEoPmeMRxkVd1H4oA4` (team `shauns`) |
| `VERCEL_DEPLOY_HOOK` | redeploying *this* app itself (legacy chat-agent tool) |

## Add a new trade kit

Open `lib/kits.js` and append one object to the `KITS` array:

```js
{
  key: 'roofing',
  match: ['roof', 'roofing', 'shingle'],
  industryLabel: 'Roofer',
  accent: '#FFD000',
  tagline: 'Leaks patched before the next storm.',
  painSeeds: ['Roof leaking? Stop it before the ceiling does.', '...'],
  services: ['Leak repair', 'Storm damage', 'Re-roofs', 'Inspections'],
  whyPoints: ['...', '...', '...'],
}
```

Nothing else needs to change — industry auto-detect, the hero picker, and the build pipeline
all read from this list. Make a matching folder under `hero-library/by-industry/roofing/`
(a `.gitkeep` is enough until you upload a real hero).

## Add heroes

Use the **Hero Library** tab in the app (uploads, auto-crops to 800×450 webp, commits to
`hero-library/by-industry/<industry>/`), or drop a pre-cropped `.webp` file into that folder
directly and push it.

## Run a batch

1. Leads tab → paste or upload leads.
2. Leave **Dry run** checked to just write filled sites to `out/<slug>/` locally with no deploy —
   good for reviewing copy/hero/accent before spending real Vercel projects.
3. Uncheck it and hit **Build & Deploy** to publish each site live on team `shauns` and get URLs
   + pitch text back in the Results tab.

## Locked design

`master-template/index.html` is the one true one-pager layout (sticky call bar, `hero.webp` at
800×450 `object-fit: cover`, Oswald + DM Sans, dark background, default accent `#FFD000`). Don't
redesign it — extend `lib/kits.js` and the hero library instead. Every deploy is static HTML only
(`framework: null`), on Vercel, never anywhere else.

## Legacy chat agent

The original free-form "AI Coding Agent" tab logic still lives at `/api/agent` (DeepSeek + GitHub/Supabase/Vercel
tool calls with an approve/reject plan step) — it's no longer surfaced in the UI but the route still
works if you want to script against it directly.
