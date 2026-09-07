# HaMakom — Android beta → first users

Ordered checklist. Each step is something only the account owner can do; the
code side is ready on `claude/unzip-file-XBQLx`.

## 0. Ship the code (5 min)
1. Merge `claude/unzip-file-XBQLx` → `main`. Vercel deploys hamakom.app from
   `main` automatically.
2. Rebuild the Android shell so the web bundle + new share plugin are inside it:
   `npm run android` (runs build → `cap sync android` → opens Android Studio).

## 1. Database (10 min, one-time)
Run from the repo with a `.env` that has `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`:
```
npm run db:health          # what users can actually see + what's missing
npm run db:sync-missing    # adds missing seed rows, never overwrites curation
npm run enrich             # Google Places status + coords for the new rows
npm run db:health          # confirm: >80% of approved rows pass strict gates
```
If `db:health` can't connect at all → the free-tier project is paused:
Supabase dashboard → project → **Restore**. (The app now survives this — it
falls back to the bundled 322 venues — but enriched DB rows give the best
plans.)

## 2. Kashrut triage (an evening — the single biggest trust lever)
Eight famous non-kosher venues are already flagged "Not certified". Verify and
fill `kashrus` for the top dinner venues in `src/data/locations.js`, in this
order: Papagaio (111), Lechem Basar (102, 133), Muscat (99), La Piedra (98),
Casa Lavi (110), Lindwar (116), Luciana Mamilla (106), Café Denya (83),
HaTzar Ein Kerem (87), Adom (184), Michali (125), Portofino (223), Mesubin
(131), Ruben (132), Setai TLV (226), Jome (227), Le Miel (234), ALALI (232),
then the 18 wineries. Use consistent strings: `Rabbanut Jerusalem`,
`Mehadrin – Badatz …`, `Not certified`. The app shows "Kashrut not verified
yet" for every food venue you haven't filled — honest, but each one you fill
converts a hesitation into a booking.

## 3. Google Play closed testing (the gate to real users)
Personal developer accounts created after Nov 2023 **must run a closed test
with ≥12 testers opted in for 14 continuous days** before Google grants
production access. Plan for it now:
1. Play Console → your app → Testing → **Closed testing** → create a track.
2. Add a tester list (Gmail addresses) — recruit 15–20 friends/community
   members so 12 stay opted in. Send them the opt-in link + Play link.
3. Build a **signed release AAB** in Android Studio (Build → Generate Signed
   Bundle) with your upload key (`android/keystore.properties`, kept out of
   git). Bump `versionCode`/`versionName` in `android/app/build.gradle` for
   every upload.
4. Upload, fill the listing (EN + HE; screenshots of home, quiz, results,
   detail, browse, saved), content rating (Everyone), and **Data safety**:
   - Collected: email (optional sign-in), app interactions (analytics,
     optional), crash logs (Sentry), approximate location (optional, used
     once for city suggestion, not stored).
   - Shared with: Supabase (hosting), Microsoft Clarity (analytics, opt-in),
     Sentry (crash reports). The in-app Privacy page now matches this.
5. Privacy policy URL: `https://hamakom.app/privacy` (prerendered, loads
   without JS).
6. After 14 days → Apply for production access (Google asks what you tested
   and what you fixed — keep a short changelog).

## 4. App Links (so shared links open the app)
After you have the release keystore: get its SHA-256
(`keytool -list -v -keystore <file>`) and publish
`public/.well-known/assetlinks.json` with package `app.hamakom` and that
fingerprint, then redeploy. The intent filter is already in the manifest.

## 5. Supabase Auth for the native build
Auth → URL configuration → add redirect URL `app.hamakom://auth-callback`
(and `https://hamakom.app`). Google sign-in inside the app depends on it.

## 6. Recruiting the first 50 users (what actually works for this audience)
- **WhatsApp is the channel.** Every plan and place now shares with a link
  that opens the exact plan. Ask each tester to send one plan to one friend.
- **Shadchanim and community WhatsApp groups**: a message that says "answer 3
  questions, get a real kosher-aware 3-stop date plan in Jerusalem/TLV" with
  the Play opt-in link. Offer to add any venue they recommend within a day.
- **Thursday**: post the "Thursday Night Pick" in 3–5 groups every Thursday
  at ~14:00. It's the natural weekly loop and costs nothing.
- **Venues**: the 5–10 places you flag as founding partners get their own
  share link and a reason to post about you.

## What to watch in the first two weeks
`npm run db:health` weekly; `problem_reports` and `user_feedback` tables
daily (the one-tap "closed / wrong kashrut" reports are your data-quality
queue); Clarity recordings of the quiz → results step for anyone who bails.
