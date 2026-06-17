# HaMakom — Date Planning System Audit & Handoff

> Prepared as a handoff for designing a new "Date Planning Agent."
> Audited against the live codebase and the live Supabase database on 2026-06-17.
> Nothing new was built. This documents only what exists today.

---

## 0. TL;DR (read this first)

- **Plans are NOT AI-generated and NOT from live web/Maps lookups at request time.** They are assembled in the browser by deterministic JavaScript scoring functions over a fixed table of ~317 locations in Supabase. No LLM is involved anywhere in plan creation.
- There are **three plan sources** layered together: (1) ~hand-written curated plans in a JS file, (2) a "smart" generator that picks an anchor location + support stops, (3) a separate dynamic slot-filler. The live app uses sources (1)+(2) merged.
- The location data is **real and reasonably fresh from Google Places** (coords 100%, business_status 98%, opening hours 88%, all enriched within 30 days). But the **human-curated quality layer is completely empty** — `vibe_tags`, `romantic_score`, `energy_score`, `best_time`, `duration_min`, and `kashrus` are populated for **0 of 317 rows**.
- **The app collects only 4 things from the user**: city, relationship stage, experience focus, and (optional) length. It does **not** ask for date/time, budget, kosher/dietary, indoor/outdoor, or travel preference.
- **Opening hours are stored but never checked** against any actual date/time, because the app never collects a date/time. The only "is it open" gate is dropping rows flagged `CLOSED_PERMANENTLY` by Google.
- This is a **kosher-focused app for religious Jewish singles**, yet there is **zero kosher data** in the database. Kosher is only loosely implied by an `occasion: 'frum-friendly'` tag on a minority of rows.

---

## 1. How date plans are currently created

### Source of truth
- **Database:** Supabase Postgres, `locations` table, **317 rows, all `status='approved'`**. (A static `SEED_LOCATIONS` array of 139 rows exists in `src/data/locations.js` as an offline fallback only.)
- **Curated plans:** `src/data/datePlans.js` — a hand-written array of full multi-stop plans (e.g. "Hidden Jerusalem Evening"). These have fixed stops with hardcoded lat/lng and copy.

### It is rule-based, in-browser, at request time
There is **no server, no API call, and no AI** in the plan-building path. When the user finishes the quiz, `App.jsx` calls pure functions that score the in-memory location list and assemble stops. Everything runs client-side.

### The three engines
| Engine | File | What it does | Used in live app? |
|---|---|---|---|
| Curated plans | `src/data/datePlans.js` + `lib/quiz.js` (`scorePlan`/`getMatchedPlans`) | Scores the hand-written plans against the answers | Yes (merged) |
| Smart generated plans | `lib/planRecommendations.js` (`getSmartMatchedPlans` → `buildGeneratedPlan`) | Picks a strong anchor location for the city/focus, then chains 1–2 "support" stops nearby | Yes (merged, **primary**) |
| Dynamic slot plan | `lib/planBuilder.js` (`assembleDynamicPlan`) | Fills 2–3 sequential "slots" (opener → main → dessert/walk) from category templates | **Present but not called** by `App.jsx` today |
| Single-place recs | `lib/locationRecommendations.js` (`getRecommendedLocations`) | Ranks individual venues (used for "browse" rails and the "more places" list, not multi-stop plans) | Yes |

### Step-by-step: user request → final plan (live path)
1. User opens the quiz (`QuizStepper.jsx`) and answers up to 4 questions. `when` is hardcoded to `'planning-ahead'`.
2. `App.jsx` calls `getSmartMatchedPlans(datePlans, locations, quizAnswers, 2, behavior)`.
3. **Curated plans** are scored by `quiz.js scorePlan` (tag overlap on focus/seriousness/length/city).
4. **Generated plans**: the location list is filtered to the chosen city + chosen focus to form an "anchor pool." Each anchor is scored (`scoreLocation` in `locationRecommendations.js`), then `buildSupportStops` greedily adds nearby stops using proximity + emotional-flow + time-of-day heuristics (`planCoherence.js`).
5. Curated + generated are merged, deduped, sorted by score, then **a randomized "band" + 20% exploration** is applied for variety, plus a recency penalty so you don't see the same plan twice. Top 2 are returned.
6. If nothing clears the geographic + focus bar, the app shows an honest **"Not enough strong options yet"** screen instead of faking a plan.

### Tools / APIs / files in play
- **Build-time only:** Google Places API (New) via `scripts/enrich-locations.mjs` populates the DB. **Not called at request time.**
- **Runtime:** Supabase JS client (read locations), `localStorage`/`sessionStorage` (recency, behavior, quiz answers). No Maps/Yelp/web calls during planning.
- **Key files:** `lib/planRecommendations.js`, `lib/planCoherence.js`, `lib/locationRecommendations.js`, `lib/quiz.js`, `lib/planBuilder.js`, `lib/constants.js`, `data/datePlans.js`, `components/QuizStepper.jsx`, `App.jsx`.

---

## 2. What the system collects from the user

The quiz (`QuizStepper.jsx`) asks **exactly four** questions:

| # | Question | Field | Values |
|---|---|---|---|
| 1 | Which city? | `city` | 13 cities + `flexible` |
| 2 | Where are you two at? | `seriousness` | `just-met`, `getting-to-know`, `getting-serious` |
| 3 | What kind of experience? | `focus` | `food-drink`, `activity`, `outdoors`, `atmosphere` |
| 4 | How long? (optional/skippable) | `length` | `short`, `medium`, `long` |

`when` is **always hardcoded** to `'planning-ahead'` on completion.

**NOT collected:** ❌ specific date / day / time, ❌ budget, ❌ food preferences, ❌ **kosher / dietary level**, ❌ indoor/outdoor, ❌ walking vs driving, ❌ activity type beyond the 4 focus buckets, ❌ number of people, ❌ accessibility.

This is the single biggest gap for the new agent: most of the constraints you want to enforce (budget, kosher, travel mode, real timing) **are never asked**.

---

## 3. Rules currently in force

All rules live in `planCoherence.js`, `locationRecommendations.js`, and the engine files. They are soft scoring nudges unless marked HARD.

**Hard filters (absolute):**
- Drop `business_status === 'CLOSED_PERMANENTLY'` (`applyHardFilters`).
- Stops must be same real city, and within **6 km** of the previous stop (`sameLocale`); otherwise the plan is returned shorter rather than crossing town. Cross-city plans are refused outright if the user picked a specific city.
- Anchor must carry the user's focus, or (for a specific city with no in-focus anchor) return no plan.

**Distance / travel:** proximity score by haversine (≤0.5 km +6 … >6 km −2). City-center coords used as fallback when a venue lacks coords.

**Pairing / category flow:** `TRANSITION_PENALTIES` hand-list, e.g. **`food:food` = −1 ("two food stops in a row")**, activity→lounge clash −2, walk→meal +1, wine→dinner +1. Energy-swing and intimacy-jump penalties between stops. Slot templates enforce opener→main→dessert narrative.

**Budget:** there is **no budget input and no budget cap**. Price (`1–4`) is used only as a soft scoring nudge and to print an estimated `₪X–Y per person` range. Nothing prevents an expensive plan.

**Opening hours / timing:** `timeFitForStopIndex` keeps "night-only" venues out of stop 1 and prefers evening venues last — **but it runs off `best_time`, which is 0% populated, so it always falls back to category defaults.** **The stored `opening_hours` JSON is never read by any scorer.** No check that a place is open on the actual date/time (because no date/time is collected).

**Avoiding duplicate categories / two dinners:** only the soft `food:food −1` penalty and the slot templates discourage it. It is **not a hard rule** — two cafés/restaurants in a row can still happen, especially in the generated engine.

**Stage matching:** `date_stage` (1/2/3) is matched to `seriousness`. **Kosher:** `if (location.kashrus || occasion includes 'frum-friendly') score += 1` — but `kashrus` is empty, so only the occasion tag ever fires.

**Variety:** recency penalty (last 15 plans, localStorage), score-band shuffle, 20% exploration pick, per-user feedback weighting.

---

## 4. Known problems with current plans (honest)

1. **Curated-quality layer is dead.** Every `vibe_tags`/`romantic_score`/`energy_score`/`best_time`/`duration_min` branch in the scorers is effectively unreachable — **0/317 rows** have them. So all "emotional fit," "romantic enough," and real duration logic silently falls back to coarse category+occasion+price guesses. The code looks much smarter than the data lets it be.
2. **No real open/closed verification beyond Google's permanent-closure flag.** "Open online but actually unreliable," temporary closures, holiday/Shabbat hours, and seasonal venues are **not handled at all**. Verification source is "Google auto" for 309 rows, "closed" for 8. No human "last verified," no phone/website/social confirmation.
3. **Timing is fictional.** Start times ("Best start 7:00pm") and durations ("About 3 hours") are **template strings keyed off `length`**, not computed from venue hours or real travel time. Nothing knows whether the night actually fits before places close.
4. **Two-food-in-a-row and category repetition can still occur** (soft −1 only). Same for awkward pacing when the support-stop pool is thin.
5. **Geographic coverage is lopsided.** Jerusalem 83, Tel Aviv 33, "Various" 23, Petach Tikva 19 — then a long tail of cities with 1–5 rows. For a thin city, a real multi-stop, same-locale plan often can't be built, triggering the "not enough options" fallback or a 2-stop plan.
6. **"Various" chain rows** (escape rooms, karting, ziplines — 23 rows, no fixed location) are hard to place coherently; they're gated by the 6 km rule only when coords exist.
7. **Kosher/dietary blindness** in a kosher-first product: no kosher level, no dairy/meat, no hechsher. Risk of sending observant users to non-kosher venues.
8. **No Plan B.** If a place is closed/full there is no fallback-swap mechanism; the user just gets a different top-2 plan on reroll.

(There is no stored log of specific user complaints in the repo; feedback flows to `user_feedback`/`problem_reports` tables and Telegram. Worth querying those for real examples before the redesign.)

---

## 5. Location data — fields & real fill rates

`locations` table (live, 317 rows). **Live fill rates measured 2026-06-17:**

| Field | Exists | Filled | Source |
|---|---|---|---|
| `name`, `name_he`, `city`, `city_he`, `category` | ✅ | 100% | Seed/curated |
| `occasion[]` (tags) | ✅ | most | Curated (hand) |
| `price` (1–4) | ✅ | 100% | Curated/Google |
| `date_stage[]` (1/2/3) | ✅ | most | Curated |
| `description` / `_he` | ✅ | most | Curated |
| `lat` / `lng` | ✅ | **100%** | Google Places |
| `formatted_address` | ✅ | 98% | Google Places |
| `opening_hours` (jsonb) | ✅ | **88%** | Google Places (**stored, never used**) |
| `business_status` | ✅ | 98% | Google Places |
| `CLOSED_PERMANENTLY` rows | — | 8 rows (3%) | Google Places |
| `google_rating` | ✅ | **100%** | Google Places |
| `website` | ✅ | 85% | Google Places |
| `phone` | ✅ | 88% | Google Places |
| `last_enriched_at` | ✅ | 98% (all within 30d) | Pipeline |
| `confidence_score` / `verification_status` | ✅ | 100% (auto=309, closed=8) | Derived |
| `kashrus` (kosher) | ✅ col | **0%** | — empty |
| `vibe_tags[]` | ✅ col | **0%** | — empty |
| `romantic_score` / `energy_score` / `quietness_score` / `group_vs_intimate_score` | ✅ col | **0%** | — empty |
| `best_time[]` | ✅ col | **0%** | — empty |
| `duration_min` / `duration_max` | ✅ col | **0%** | — empty |
| `avg_rating` / `review_count` (community) | ✅ | sparse | `location_reviews` |
| `image_url` / `photo_refs[]` | ✅ | partial | Google/commons |

**Categories:** Cafes & Restaurants 176, Activities & Experiences 57, Parks & Outdoors 37, Wineries 18, Museums & Culture 17, Hotels & Lounges 12.

So: **API/factual data = good and fresh. Human/editorial/dietary data = essentially nonexistent.**

---

## 6. How "open or closed" is verified today

- **Only** via Google Places `business_status` captured at enrichment time. Rows marked `CLOSED_PERMANENTLY` are dropped before scoring.
- `last_enriched_at` is the closest thing to a "last verified" date — it's the last Google sync (all within 30 days), **not** a human verification.
- **No** website check, **no** phone call, **no** social-media check, **no** live request-time lookup.
- **No distinction** between temporarily and permanently closed beyond Google's own flag. Holiday/Shabbat/seasonal closures are invisible.
- `opening_hours` exists for 88% of rows but **is not consulted** by any matching logic.

---

## 7. Integrations available

| Integration | Status |
|---|---|
| Google Places API (New) | ✅ **Build-time only** (enrichment script). Key in env `GOOGLE_PLACES_KEY`. Could be reused at request time. |
| Supabase (Postgres + Auth + Storage + Edge Functions) | ✅ Core backend. |
| Telegram | ✅ Problem reports → `@Hamakombot` via Edge Function. |
| Maps deep links | ✅ `getMapsUrl` builds Google Maps search URLs (no routing/distance API). |
| WhatsApp | ✅ Share/invite via `wa.me` deep links only. |
| Leaflet | ✅ In-app map display. |
| Vercel | ✅ Hosting. |
| Admin panel | ✅ `AdminView.jsx`, role-gated (`app_metadata.role='admin'`). |
| Yelp / TripAdvisor / OpenTable / Resy / Waze / Calendar / Airtable / Sheets / CRM | ❌ None. |
| Any LLM / AI API | ❌ **None anywhere in the product.** |

---

## 8. What current output looks like (real examples)

**A. Curated plan** (`datePlans.js`, "Hidden Jerusalem Evening"): 3 fixed stops — Wine & Friends (Mahane Yehuda) → Nachlaot Walk → Knafeh dessert. Hardcoded coords, copy, "Best start 7:15pm," "₪180–220 pp." *Chosen by:* tag match on focus=atmosphere/food-drink, seriousness, Jerusalem. *Issue:* static; venues never re-verified against the curated text.

**B. Generated plan** (`buildGeneratedPlan`): e.g. user picks Jerusalem / getting-to-know / food-drink → anchor = a high-scoring Jerusalem café, support stops = a nearby park + dessert spot within 6 km, ordered by flow/time heuristics. Title/narrative/budget templated from the anchor. *Issue:* support quality depends entirely on coords + occasion tags; can pick a second café (soft −1 only); timing is templated.

**C. "Not enough options" fallback:** thin city + specific focus → app honestly declines rather than cross-city faking. (Good behavior to preserve.)

> Note: exact generated output is non-deterministic (randomized variety band + exploration), so there is no fixed "saved plan" archive to paste. To see live examples, run the quiz or query `recommendation_impressions` / `saved_plans`.

---

## 9. What the improved agent should be able to output

(User's wish list — captured for the new design, not yet built.) Variations: Safe/simple, Romantic, Fun/adventurous, Budget-friendly, Premium, Rainy-day, Last-minute, Kosher-strict, Walking-only, Car-friendly, plus **Plan B** when a stop is closed/full. Each needs the new inputs in §2 and the new data in §11 to be trustworthy.

---

## 10. Technical environment

- **Framework:** React 19 + Vite 8, single-page app, all state in `App.jsx` (~1600 lines), no TypeScript, inline styles, custom i18n (`translations.js`), RTL/Hebrew + English, PWA.
- **Backend:** Supabase (Postgres, Auth = Google OAuth + email OTP, Storage, Edge Functions).
- **Hosting:** Vercel. **Domain:** hamakom.app.
- **AI model:** none in product today.
- **Current "prompts":** none — all copy is templated strings in the engine files.
- **Schemas:** `supabase/schema.sql` (locations + analytics + feedback + saved + reviews).
- **Admin:** `AdminView.jsx`, role-gated.
- **Constraints:** client-side scoring (whole location list ships to browser); no request-time external calls; Google key currently build-time only; project ref `kyenbpkgxnjrknebbiyr`.

---

## 11. Files/code ChatGPT should see before designing the new agent

**Must read (the actual logic):**
- `src/lib/planRecommendations.js` — the primary generated-plan engine (anchor + support stops, variety, scoring).
- `src/lib/planCoherence.js` — all geo/flow/time/duration heuristics + `validatePlanFlow` (the "is this plan sane" checks).
- `src/lib/locationRecommendations.js` — per-location scoring, hard filters, curated-fit scoring (mostly dormant).
- `src/lib/quiz.js` — curated-plan scoring + session helpers.
- `src/lib/planBuilder.js` — the unused slot-template engine (good reference for "no two dinners" structure).
- `src/components/QuizStepper.jsx` — exactly what's asked of the user.
- `src/lib/constants.js` — cities, categories, `CITY_COORDS`, occasion keys.

**Data & schema:**
- `supabase/schema.sql` (`locations` table + enrichment columns).
- `src/data/datePlans.js` (curated plan shape), `src/data/locations.js` (seed shape/sample rows).
- `scripts/enrich-locations.mjs` + `supabase/ENRICHMENT_README.md` (how data is sourced & scored).
- `scripts/audit-plan-coherence.mjs` (existing regression harness).

**For real-world signal:** query `user_feedback`, `problem_reports`, `recommendation_impressions`, `recommendation_outcomes`, `saved_plans` in Supabase.

---

## Final summary

**1. How it works today:** A 4-question quiz feeds deterministic, in-browser JavaScript scorers that rank ~317 Google-enriched Supabase locations and stitch 2–3 nearby same-city stops into a plan (merged with a handful of hand-written plans). No AI, no live lookups. Real geo/flow/timing *heuristics* exist and are decent; copy and timing are templated.

**2. Biggest weaknesses:** (a) the editorial/quality data the scorers were built for is 0% populated, so the engine runs on coarse fallbacks; (b) timing and "is it open now" are essentially fictional — hours stored but unused, no date/time collected; (c) no budget, kosher, indoor/outdoor, or travel-mode inputs in a kosher-first product; (d) two-food-in-a-row and pacing issues are only softly discouraged; (e) no Plan B / no live re-verification.

**3. Missing data:** kosher/dietary level, `vibe_tags`, romantic/energy/quiet scores, `best_time`, real `duration`, request-time open/closed truth, human "last verified," budget intent, and the user inputs in §2.

**4. Change first (recommended order):** (i) Collect the missing inputs (date/time, budget, kosher, travel mode). (ii) Actually *use* `opening_hours` + collected time as a hard gate, and add a kosher field + filter. (iii) Populate or LLM-derive the curated quality fields so the existing scoring stops running on fallbacks. (iv) Add a hard "no two same-category anchors / no two dinners" rule and a Plan-B swap. (v) Only then layer an LLM on top for narrative + judgment — keep the deterministic geo/hours/kosher checks as guardrails the model cannot override.

**5. Honesty note:** Location *facts* (coords, rating, permanent-closure, address) are real and fresh. Location *judgment* (vibe, romance, best time, duration, kosher) and *live availability* are **not verified** — do not trust them in the new design until they're filled and gated.
