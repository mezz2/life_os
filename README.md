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
