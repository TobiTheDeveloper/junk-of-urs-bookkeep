# Junk Of Urs — Bookkeeper

A mobile-first **Progressive Web App** for tracking income, expenses, receipts, and tax reserves for your solo proprietorship.

Built for **Junk Of Urs** — subcontractor work and junk removal gigs in one place.

## Features

- **Dashboard** — Monthly income, expenses, tax set-aside, and take-home estimates
- **Income tracking** — Subcontractor payments vs. junk removal gigs
- **Expense tracking** — Categories tailored for junk removal (fuel, dump fees, tools, etc.)
- **Receipt photos** — Snap or upload receipts when logging expenses
- **Tax reserve calculator** — Configurable income tax + self-employment tax rates
- **Reports** — Profit breakdown, income by source, spending by category
- **Offline-first** — All data stored locally on your device (IndexedDB)
- **Installable PWA** — Add to your phone home screen like a native app
- **Backup export** — Download JSON backup from Settings

## Quick Start

```bash
npm install
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173`).

### Install on your phone

1. Run `npm run dev` and open the app on your phone (same Wi‑Fi), or deploy with `npm run build` + `npm run preview`
2. In Chrome/Safari, use **Add to Home Screen**
3. The app works offline after the first load

## Tax Settings

Default rates (adjust in **Settings**):

| Rate | Default |
|------|---------|
| Income tax | 22% |
| Self-employment tax | 15.3% |

Tax reserve = `(Income − Deductible Expenses) × combined rate`

This is an **estimate** — consult a tax professional for your situation.

## Cloud Sync (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env` and add your project URL and anon key
3. Run `supabase/migrations/001_initial.sql` in the Supabase SQL Editor
4. Enable Email auth in Supabase Authentication settings
5. Restart the dev server and sign in from **Settings**

Data syncs automatically after changes when signed in. Use **Sync Now** for a manual sync.

## Export

- **Settings → Export Transactions (CSV)** — full transaction log for your accountant
- **Reports → Summary CSV / Categories CSV** — period profit and spending breakdown
- **Settings → Export Full Backup (JSON)** — complete local backup including metadata

## Scripts
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Dexie (IndexedDB)
- vite-plugin-pwa
