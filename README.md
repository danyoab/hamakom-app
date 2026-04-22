# HaMakom

HaMakom is a mobile-first bilingual React/Vite app for observant Jewish singles in Israel. The product direction is planner-first: one strong date plan first, calm alternatives second.

## Stack

- React + Vite
- Supabase Auth / Database / Storage
- Leaflet / React Leaflet
- Vercel deployment

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and set real values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_PIN=...
```

3. Start the app:

```bash
npm run dev
```

## Pre-Deploy Checklist

Blocking:
- Set production `VITE_SUPABASE_URL`
- Set production `VITE_SUPABASE_ANON_KEY`
- Change `VITE_ADMIN_PIN` from the default `1234`
- Run the SQL from the Admin `SQL` tab in Supabase
- Make sure Google auth and email magic links are enabled in Supabase Auth
- Add your production app URL to Supabase Auth redirect URLs
- Create the `location-images` storage bucket in Supabase if image upload is needed

Quality checks:
- `npm run build`
- `npm run lint`
- Test quiz -> result -> save gate -> sign in -> restore flow
- Test saved plans and saved places
- Test admin login
- Test analytics tab after real events exist
- Test Hebrew / RTL screens on mobile

## Supabase Setup

Required features used by the app:
- Auth
- Database tables for locations, pending submissions, quiz results, analytics, feedback
- Storage bucket: `location-images`

The Admin `SQL` tab contains the first-pass schema for:
- `analytics_events`
- `user_feedback`
- `recommendation_impressions`
- `recommendation_outcomes`

## Adding A New Location (Checklist)

When adding a place, update all relevant layers so it appears consistently in Explore, quiz flows, and production:

1. Add the location in `src/data/locations.js` with the same shape as existing entries:
   - `id`, `name`, `name_he`, `city`, `city_he`
   - `category`, `occasion`, `price`, `date_stage`
   - `description`, `description_he`, `maps_query`
   - `kashrus`, `featured`, `status` (usually `approved`)
2. If the city is new, add it to `src/lib/constants.js`:
   - Include city in `CITIES`
   - Add city coordinates to `CITY_COORDS` for map support
3. If relevant, add/update a plan in `src/data/datePlans.js` that uses the place in `stops`.
4. Keep quiz city text complete by adding any new plan city copy in `src/lib/quiz.js` (`cityText` map).
5. If Supabase is enabled, insert the same location into the `locations` table with `status='approved'`.
   - The app will prefer DB rows over seed fallback when Supabase data is available.
6. Verify in UI:
   - Explore search finds both English and Hebrew name/city variants
   - City/category filters include and show the place
   - Map pin appears when city coordinates exist

## Vercel Deployment

1. Import the repo into Vercel
2. Framework preset: `Vite`
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PIN`
4. Deploy
5. In Supabase Auth, add the Vercel production URL and preview URL pattern as redirect URLs

The repo already includes [vercel.json](vercel.json) with SPA rewrites back to `index.html`.

## Current Known Gaps

- Reminders are local-only, not push notifications or calendar events
- Date plan admin edits are local-browser storage based, not multi-admin cloud persistence
- Analytics dashboard is client-side aggregated from Supabase rows; SQL views would be better at scale
- Recommendation learning is still heuristic plus event capture, not a full adaptive model
