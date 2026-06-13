# LifeOS — Finances

A local-first personal finance command centre. Imports multi-bank CSVs, auto-cleans and
categorises them, tracks net worth and goals, and proactively surfaces spending trends and ways to
lean your spend.

> **Scope:** this is the **Finances** module only — Part 1 of a wider LifeOS (Health / Tasks /
> Habits are planned, not built yet). It runs entirely on your machine: your data lives in a local
> SQLite file that is never committed or sent anywhere (the Claude API is the only optional outbound
> call, and only if you add a key). The repo ships with **fake example data** so you can try it
> immediately, then replace it with your own.

## Stack
- **Next.js 16** (App Router, TypeScript) — one local process for UI + API
- **SQLite + Prisma 7** (`dev.db`) — all data stays on your machine
- **Tailwind 4**, **Recharts**, **lucide-react**
- **Claude API** (optional) — AI categorisation of unknown merchants + monthly insight narrative

## Quick start
Requires Node 20+.

```bash
git clone <your-fork-url> && cd life_os
npm install
cp .env.example .env.local  # then edit it (all values optional — see Config below)
npx prisma migrate dev      # creates dev.db (first run only)
npm run seed                # loads example data: net worth, goals, budget, taxonomy, rules
npm run dev                 # http://localhost:3000
```

Once it's running, clear the demo data and make it yours: import your own bank CSVs on the
Transactions page, edit goals/net worth in the UI, or edit `prisma/seed.ts` and run
`npm run db:reset`. To start from a completely blank slate, skip `npm run seed`.

### Config
Copy `.env.example` to `.env.local` and fill in what you want:
```
ANTHROPIC_API_KEY="sk-ant-..."   # optional — enables AI categorisation + narrative
NEXT_PUBLIC_USER_NAME="Alex"     # optional — name in the dashboard greeting
```
Without the API key, rule-based categorisation and alerts still work — you just lose the AI
narrative and auto-classification of unfamiliar merchants. `.env*` files are gitignored.

## Using it
1. **Transactions → Import CSV** — drop a bank CSV export. The format is
   auto-detected, rows are categorised, and duplicates are skipped on re-import. Old-year files are
   welcome (they power year-over-year trends).
2. **Recategorise** inline on the Transactions page. Hit the ✨ wand on a row to apply that category
   to every matching transaction and save a rule for future imports.
3. **Budget** shows projected vs actual per category for any month.
4. **Net Worth** — add a snapshot whenever you check balances; the chart and linked goals update.
5. **Insights → Generate** — recomputes alerts (overspend, spikes, subscription creep, savings-rate,
   YoY, large transactions) and an AI narrative.

## Staying up to date
Code is shared through GitHub; **your data never is**. Your `dev.db` lives only on your machine and
is gitignored, so pulling updates can't touch, overwrite, or sync your finances — everyone keeps
their own database.

To pull the latest changes:
```bash
git pull                    # gets the new code
npm install                 # only needed if dependencies changed
npx prisma migrate dev      # only needed if the database schema changed (safe — see below)
npm run dev
```

`git pull` only updates code, so your transactions, goals, and net worth stay exactly as they were.
The one case that needs the extra `npx prisma migrate dev` step is when an update adds or changes a
database table or column. That command applies any new migrations to your existing database **by
adding to it, not wiping it** — your rows are preserved. It's always safe to run; if there's nothing
new to apply, it does nothing.

> ⚠️ **Never run `npm run seed` or `npm run db:reset` once you have real data.** Both erase your
> database and reload the demo data. They're only for first-time setup on an empty database.

## Run it always-on (macOS)
`npm run dev` only runs while its terminal stays open. To have `http://localhost:3000` available all
the time — no terminal, survives reboots — install it as a background service (a LaunchAgent running
the production build):

```bash
npm run build
bash setup-service.sh
```

`setup-service.sh` auto-detects your paths, writes `~/Library/LaunchAgents/com.lifeos.app.plist`, and
starts the service. Then just open `http://localhost:3000` whenever you like.

Useful commands:
```bash
launchctl list | grep lifeos              # check it's running (a number in the first column = up)
launchctl kickstart -k gui/$(id -u)/com.lifeos.app   # restart it (your "apply changes now" command)
tail -f ~/Library/Logs/LifeOS/app.error.log          # see errors if it won't start
launchctl bootout gui/$(id -u)/com.lifeos.app        # stop and remove the service
```

### Refreshing after a change
Because the service serves a **built** copy of the app (not live-reloading like `npm run dev`), you
have to rebuild and/or restart the service for changes to show up. Pick the row that matches what you
changed, then hard-refresh the browser (`Cmd+Shift+R`):

| What you changed | Commands to apply it |
| --- | --- |
| `NEXT_PUBLIC_USER_NAME` (the greeting name) | `npm run build` then `launchctl kickstart -k gui/$(id -u)/com.lifeos.app` |
| `ANTHROPIC_API_KEY` (read live at runtime) | `launchctl kickstart -k gui/$(id -u)/com.lifeos.app` |
| Code pulled from GitHub | `git pull` → `npm install` → `npm run build` → `launchctl kickstart -k gui/$(id -u)/com.lifeos.app` |

`NEXT_PUBLIC_*` values are baked in at build time, so changing the name needs a fresh `npm run build`;
the API key is read at runtime, so a restart alone is enough. Your data (`dev.db`) is never touched by
any of these.

## Data model
See `prisma/schema.prisma`. `prisma/seed.ts` loads neutral **example** data (made-up net worth,
goals, and budget) so the app looks alive on first run — replace it with your own or start empty.
`npm run db:reset` wipes and reseeds.

## Bank parsers
Each adapter in `src/lib/banks/` normalises one bank's CSV format to a canonical shape. The bundled
adapters were written against specific bank exports — **validate them against your own statements**
before trusting the numbers (the import preview lets you eyeball every row before committing), and
add an adapter in `src/lib/banks/` for any other bank.

## Notes
- Mobile-responsive; to use on your phone, run `npm run dev` and open the Network URL on the same
  Wi-Fi (or front it with a private tunnel).
- `dev.db`, `.env*` and `/data/uploads/` are gitignored.

## Troubleshooting
- **`npm audit` shows vulnerabilities** — normal transitive-dependency noise; safe to ignore for a
  local app. **Do not run `npm audit fix --force`** — it will downgrade core packages and break the
  app.
- **`Cannot find module 'dotenv'` / Prisma runs an old version (6.x)** — your install skipped some
  packages (often because `NODE_ENV=production` is set). Reinstall everything with
  `npm install --include=dev`, then retry.
- **`prisma migrate dev` says `Argument "url" is missing`** — you're on an old Prisma. This project
  needs Prisma 7; run `npm install` then `npm run migrate` (which uses the project's own copy).
