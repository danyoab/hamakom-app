# HaMakom — Launch & Revenue Playbook

The order below matters. Each phase earns the right to the next one.
Trust → users → revenue. Skipping ahead burns the asset that makes this valuable.

---

## Phase 0 — Infrastructure (BLOCKING everything else)

The app is built to run on Supabase + Vercel, but as of June 2026 **no HaMakom
project exists on the connected Supabase/Vercel accounts**. Until this is fixed,
production users have no sign-in, no saved-plan sync, no feedback capture, no
analytics, and no partner-inquiry inbox — the app silently falls back to
bundled data.

1. **Supabase project exists**: ref `kyenbpkgxnjrknebbiyr` →
   `VITE_SUPABASE_URL=https://kyenbpkgxnjrknebbiyr.supabase.co`
   (anon key: Supabase dashboard → Settings → API).
2. Run the schema: paste `supabase/migrations/20260614000000_hamakom_core.sql`
   into the SQL editor (or `supabase db push`).
3. Import the locations: `node --env-file=.env scripts/sync-locations-to-supabase.mjs`
   then run the printed `setval` line in the SQL editor.
4. In Supabase Auth settings: enable Google OAuth + email magic links, set the
   site URL to `https://hamakom.app`.
5. Make yourself admin: in the SQL editor —
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'YOUR_EMAIL';`
6. **On Vercel** (wherever hamakom.app is actually deployed): set
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and (optionally)
   `VITE_SENTRY_DSN`. Redeploy.
7. Verify: open the live site → Profile → sign in should work; save a plan on
   your phone, see it appear on desktop.

## Phase 1 — Data quality (the actual product)

1. **Geocode**: `node scripts/geocode-json.mjs` (≈6 min, free, run locally),
   then `node scripts/generate-fallback.mjs`, commit, re-run the Supabase sync.
   Unlocks route maps and the proximity engine.
2. **Kashrut**: fill the `kashrus` field for the ~162 food entries in
   `src/data/locations.json` (e.g. "Mehadrin", "Rabbanut Jerusalem",
   "Badatz", "Not certified"). The UI already displays it. **This is the
   single biggest trust lever for the audience.** Do the top 30 first.
3. **Ratings pass**: 232 entries still have the default rating of 3. Even a
   rough pass (your genuine 4s and 5s, demote weak entries to 2) makes the
   signal real.
4. **Photos**: `image_url` is empty on 92% of entries. Options: Google Places
   photos (paid API), Wikimedia (free, patchy), or ask partner venues for
   their own photos (free + they're motivated).

## Phase 2 — Store distribution

### Google Play (do this first — cheap, fast, no review drama)
The app is now a valid PWA (manifest + service worker via vite-plugin-pwa),
which qualifies it as a **Trusted Web Activity** — a real Play Store listing
that wraps the live site. Updates ship instantly (it's the website).

1. One-time $25 Google Play developer account.
2. `npm i -g @bubblewrap/cli && bubblewrap init --manifest https://hamakom.app/site.webmanifest`
3. `bubblewrap build` → produces a signed `.aab`.
4. Copy the SHA-256 fingerprint Bubblewrap prints into
   `public/.well-known/assetlinks.json` (template already in repo), deploy.
5. Upload the `.aab` in Play Console, fill the listing (screenshots: quiz,
   results page, browse grid; both EN and HE).
6. Expect review in 1–3 days.

### Apple App Store (second — costs more, stricter)
Apple rejects bare website wrappers (guideline 4.2), so ship the Capacitor
wrapper only after adding at least one native capability. Recommended minimum:
**push notifications** ("your Thursday-night plan is ready") — it's also your
retention engine.

1. $99/year Apple Developer account. A Mac (or a cloud Mac like MacStadium) is
   required for the build.
2. `npm i @capacitor/core @capacitor/ios && npx cap init HaMakom app.hamakom`
   → `npx cap add ios` → open in Xcode, archive, upload.
3. Add `@capacitor/push-notifications` and register the token in Supabase.
4. In App Store Connect: use the same listing content as Play.

### Store assets needed (both)
- 1024×1024 icon (exists: rescale `public/pwa-512.png` source)
- 4–6 phone screenshots per language (take on the live site with device frame)
- Short + full description (write once, EN + HE)
- Privacy policy URL: `https://hamakom.app` → Privacy page already exists ✓

## Phase 3 — Revenue (only after Phases 0–1 are real)

The model: **Featured Partner placements** for restaurants/venues. The pieces
already built:

- `For Businesses` page (Profile → footer) with inquiry form → writes to the
  `partner_inquiries` table (falls back to mailto when Supabase is absent).
- `is_partner` flag on locations → gold "✦ Partner" badge on cards + detail
  page, partners sort first in browse. **Always labeled — never undisclosed.**

Rollout order:
1. **Do not charge yet.** Hand-pick 5–10 venues you already love, flag them
   `is_partner = true` free for 60 days ("founding partner"). Get their photos
   and kashrut certificates in exchange. This fills your data gaps for free.
2. Instrument: partner-card impressions and maps-opens are already tracked via
   `analytics_events` — that's the report you'll show venues.
3. At ~1–2k monthly users, convert founding partners to paid:
   ₪150–300/month per venue is the local-SMB ballpark; simple manual invoicing
   (Green Invoice / חשבונית ירוקה), no payment infra needed in-app.
4. Later tiers: featured placement inside date plans ("dessert stop sponsored
   by…"), city sponsorship, WhatsApp reservation deep-links.

**Rule that protects the business: recommendation ranking in the quiz is never
sold.** Partners get browse placement and badges, not rigged quiz results. The
minute users suspect plans are ads, the trust asset is gone.

## Phase 4 — Growth loops (already half-built)

- WhatsApp share/invite buttons exist on every plan/place → the growth channel
  in this demographic. Make sure share text always includes the link.
- "Suggest a place" queue → community sourcing, already wired to admin.
- Weekly "Tonight's Pick" is deterministic per day — good for a recurring
  WhatsApp status/newsletter later.

---

## Quick status reference

| Piece | Status |
|---|---|
| App code | ✅ solid (audited + fixed, June 2026) |
| PWA/service worker | ✅ shipped |
| Supabase schema | ✅ migration in repo — **project itself missing** |
| Locations sync script | ✅ in repo |
| Geocoding | ⏳ run locally (`scripts/geocode-json.mjs`) |
| Kashrut data | ❌ 0/341 — top priority manual work |
| Photos | ❌ 27/341 |
| For Businesses page | ✅ shipped |
| Partner badge + sort | ✅ shipped |
| assetlinks.json | ✅ template (needs real fingerprint at Bubblewrap step) |
| Play listing | ⏳ needs $25 account + Bubblewrap |
| iOS app | ⏳ needs $99 account + Mac + push notifications |
