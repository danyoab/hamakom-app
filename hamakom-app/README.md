# HaMakom · המקום

**Date ideas for Jewish singles in Israel.**

Bilingual (EN/HE), mobile-first web app. Browse 139 curated kosher date locations, filter by date stage, city, category, and occasion. Submit new places. Share via WhatsApp.

🌐 [hamakom.app](https://hamakom.app)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Database | Supabase (Postgres) |
| Hosting | Vercel |
| Auth | Supabase Auth (admin only) |

---

## Getting Started

```bash
git clone https://github.com/danyoab/hamakom-app.git
cd hamakom-app
npm install
cp .env.example .env.local   # fill in your Supabase credentials
npm run dev
```

App runs at http://localhost:5173 — works offline with seed data if Supabase is not configured yet.

---

## Environment Variables

| Variable | Where to find it |
|----------|-----------------|
| VITE_SUPABASE_URL | supabase.com → Settings → API → Project URL |
| VITE_SUPABASE_ANON_KEY | supabase.com → Settings → API → anon public key |
| VITE_ADMIN_PIN | Set your own — change before deploying |

---

## Project Structure

```
src/
  App.jsx                  Main app — routing, filter state
  components/
    Card.jsx               Location card
    DetailView.jsx         Individual location page
    FilterBar.jsx          All filters
    SuggestView.jsx        User submission form
    AdminView.jsx          PIN-protected admin dashboard
  data/
    locations.js           139 seed locations (Supabase fallback)
  hooks/
    useLocations.js        Supabase fetch with seed fallback
    usePending.js          Admin: fetch / approve / reject
    useLocalStorage.js     Persist saved hearts
  lib/
    supabase.js            Supabase client
    translations.js        All EN + HE strings
    constants.js           Categories, helpers, utilities
```

---

## Deploying to Vercel

1. Push to GitHub
2. vercel.com → New Project → Import repo
3. Framework preset: Vite
4. Add env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_PIN
5. Deploy — auto-deploys on every push to main
6. Settings → Domains → add hamakom.app

---

## Admin

Hidden behind the small dot (●) in the top-right header corner.
PIN is set via VITE_ADMIN_PIN. Change it before deploying.

---

## Key Rules — Do Not Change

- date_stage is always an int array: [1], [1,2], [2,3], [3]
- All UI text comes from t[lang] — never hardcode strings
- Every component receives a tx prop — never access t directly
- RTL/LTR direction flows as dir prop from top-level lang state
