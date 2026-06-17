# HaMakom — Date Planning Agent Handoff Package (for ChatGPT)

> Companion to `DATE_PLANNING_AUDIT.md` (the full system audit) and `CHATGPT_HANDOFF_CODE.md` (the actual source files).
> All numbers and example plans below were pulled from the **live Supabase database and the real production engine** on **2026-06-17**. Nothing was mocked. Weak points are left in on purpose.

Contents:
1. Pointer to the full audit
2. Real generated plans (run through the actual engine on live data)
3. Feedback / problem-report rows
4. Database schema (relevant tables)
5. Current code files (see `CHATGPT_HANDOFF_CODE.md`)
6. Location data-quality fill table
7. Verification rules — what we can trust
8. Technical constraints
9. Recommended build path

---

## 1. Full audit

See **`DATE_PLANNING_AUDIT.md`** (pasted in full at the end of this document, Appendix A). Read it first. One-line summary: plans are built by **deterministic in-browser JavaScript** over ~317 Google-enriched Supabase locations; **no AI, no request-time web/Maps calls**; the human-curation quality layer is **0% populated**; the quiz collects only **4 inputs** (city, stage, focus, optional length) and never asks date/time, budget, kosher, indoor/outdoor, or travel mode.

---

## 2. Real generated plans (faithful engine replay on live data)

**Method:** I ran the **actual production function** `getSmartMatchedPlans(DATE_PLANS, locations, answers)` (from `src/lib/planRecommendations.js`) against the **live `locations` table**, replaying real quiz-answer combinations taken from the `recommendation_impressions` table (113 of 120 real impressions were "generated" plans, 7 curated). Randomness was pinned for reproducibility. Distances are straight-line haversine between the stops' real coordinates; travel time is derived (walk ≈ 5 km/h, drive ≈ 30 km/h urban). "Flags" are computed from the real venue rows.

**Distribution of the 120 real impressions on file:**
- Plan kind: **generated 113, curated 7**
- Focus: activity 60, outdoors 31, food-drink 26, atmosphere 3
- Stage: just-met 51, getting-to-know 50, getting-serious 19
- Length: medium 46, short 37, long 36, skipped 1
- Cities: Beit Shemesh 21, Tel Aviv 19, Jerusalem 17, Petach Tikva 17(+14 "Petah Tikva" spelling variant), Modi'in 10, Givat Shmuel 8, Zichron Yaakov 5, Tzur Hadassah 4, flexible 2, others 1–2.

> Note the **"Petach Tikva" vs "Petah Tikva" spelling split** — a real data-consistency bug that fragments a city.

### GOOD plans (tight, coherent, all operational)

**G1 — Modi'in / getting-serious / activity / long** → *"Ceramics – Keyad Hadimyon Then Dinner"* (generated, score 23.3)
1. Ceramics – Keyad Hadimyon · Activities & Experiences · ₪3 · OPERATIONAL · hours ✓ · g4.8
2. Boat Ride · Activities & Experiences · ₪2 · OPERATIONAL · hours ✓ · g4.2
3. Park Anava · Parks & Outdoors · ₪1 · OPERATIONAL · hours ✓ · g4.5
- Legs: 0.43 km, 0.82 km. No two-food. No closed. 0 missing hours. **Clean.**

**G2 — Jerusalem / just-met / food-drink / medium** → *"Piccolino in Kikar Musica and an Easy Flow"* (generated, score 25.9)
1. Piccolino · Cafes & Restaurants · ₪2 · OPERATIONAL · hours ✓ · g4.4
2. Teddy Park · Parks & Outdoors · ₪1 · OPERATIONAL · hours ✓ · g4.4
3. Café Rimon (dairy) · Cafes & Restaurants · ₪2 · OPERATIONAL · hours ✓ · g4.2
- Legs: 0.86 km, 0.27 km. **Borderline:** café→park→café = **2 food stops** (but split by a park, so it reads OK).

**G3 — Rishon LeZion / just-met / food-drink / short** → *"Amlula and an Easy Flow"* (generated, score 25.4)
1. Amlula · Cafes & Restaurants · ₪2 · OPERATIONAL · hours ✓ · g4.6
2. Luciana Rishon LeZion · Cafes & Restaurants · ₪3 · OPERATIONAL · hours ✓ · g4
- Leg: 0.29 km. **Two restaurants back-to-back with nothing between them** — borderline-bad pacing, but geographically tight.

**G4 — Zichron Yaakov / getting-serious / atmosphere / medium** → *"An Evening Around Somek Estate Winery"* (generated, score 24.1)
1. Somek Estate Winery · Wineries · ₪3 · OPERATIONAL · hours ✓ · g4.8
2. HaMeyasdim Street · Parks & Outdoors · ₪1 · **(no business_status)** · **NO HOURS** · g=null
3. Dining on HaMeyasdim · Cafes & Restaurants · ₪3 · OPERATIONAL · hours ✓ · g4
- Legs: 0.22 km, 0.09 km. Winery→walk→dinner is a nice arc; stop 2 is an un-enriched "street" with no data.

### BAD / risky plans

**B1 — Jerusalem / getting-to-know / activity / medium** → *"Ceramics – Kad v'Chomer Then Dinner"* (generated, score 22.9)
- Stop 2 = **Café Ben Ami · `CLOSED_TEMPORARILY` · NO HOURS**. **A temporarily-closed venue was placed into a live plan.** The hard filter only blocks `CLOSED_PERMANENTLY`, and only on the single-place rails — **not in the plan generator**.

**B2 — Tel Aviv / just-met / food-drink / long** (probe) → *"Biga at Sarona Market and an Easy Flow"* (generated, score 24.3)
1. Biga at Sarona Market · ₪2 · **CLOSED_TEMPORARILY · NO HOURS** · g4.3
2. Namal (Port) · Parks & Outdoors · ₪1 · OPERATIONAL · hours ✓ · g4.5
3. Café Café (Port) · ₪2 · OPERATIONAL · hours ✓ · g3.4
- Leg 1→2 = **2.96 km** (≈35 min walk). **Anchor is temporarily closed**, and the opening leg is not walkable.

**B3 — Caesarea / just-met / food-drink / medium** → *"Kalima and an Easy Flow"* (generated, score 19.1)
1. Kalima · Cafes & Restaurants · ₪4 · OPERATIONAL · **NO HOURS** · **g2.6 (poorly rated)**
2. Caesarea Ancient Harbour · Parks & Outdoors · ₪2 · OPERATIONAL · hours ✓ · g4.7
3. Aresto · Cafes & Restaurants · ₪4 · OPERATIONAL · hours ✓ · g4.3
- Leg 1→2 = **5.69 km (≈68 min walk!)**, passed the 6 km same-locale gate. **Two ₪4 restaurants** + a 2.6-star anchor + impossible walking distance. Clear bad plan.

**B4 — Beit Shemesh / just-met / activity / long** → *"Stalactite Caves Then Dinner"* (generated, score 21.7)
1. Stalactite Caves · ₪2 · OPERATIONAL · hours ✓ · g4.7
2. Ruben · Cafes & Restaurants · ₪3 · OPERATIONAL · hours ✓ · g4.3
3. Mesubin · Cafes & Restaurants · ₪3 · OPERATIONAL · hours ✓ · g4.1
- Leg 1→2 = **3.58 km (≈43 min walk)**; then **two restaurants in a row** (Ruben→Mesubin, 0.15 km). Far opener + double dinner.

**B5 — flexible / getting-serious / atmosphere / long** (probe) → *"Fish Market and a Smooth Date"* (Tel Aviv, generated, score 20.5)
1. Fish Market · ₪4 · OPERATIONAL · hours ✓ · g4.4
2. Setai · ₪4 · OPERATIONAL · hours ✓ · g4.2
3. Norman Hotel Lobby Bar · Hotels & Lounges · ₪4 · OPERATIONAL · **NO HOURS** · g4.5
- **Two ₪4 seafood restaurants back-to-back**, then a hotel bar. ₪4+₪4+₪4 with no budget input from the user.

### Curated plans = placeholder stops, NOT real venues

**C1 — Givat Shmuel / getting-to-know / food-drink / medium** → *"Givat Shmuel Easy Evening"* (curated, score 18)
1. "Café in Givat Shmuel Center" — **category undefined, no coords, no hours, no rating, not a real DB venue**
2. "Yarkon Park Side Walk" — same
3. "Dessert (optional)" — same
- **All 3 stops are hand-written copy, not linked to any `locations` row.** Curated plans cannot be verified, have no maps links to real places, no hours, no distance. (7 of 120 real impressions were curated plans like this.)

### "Not enough options" is rarer than expected — cross-city curated leak

**N1 — Eilat / just-met / outdoors / short** (no Eilat data) → returned *"Tzur Hadassah Pizza & Park"* (curated, score 2, **`_cityMismatch: true`, `_lowConfidence: true`**).
- The honest **"Not enough strong options yet"** screen only fires when **both** generated **and** curated lists are empty. Because curated plans bypass the city-anchor gate, an Eilat user gets a **wrong-city** Tzur Hadassah plan (flagged mismatch) instead of the honest fallback. So the "we'd rather be honest" path triggers less than the audit implied.

**N2 — Petach Tikva / just-met / outdoors / short** → returned a curated *"Petach Tikva Easy Start"* with placeholder café/park/dessert stops (score 14). Outdoors-focus request answered with a café-led curated plan.

**Patterns proven from real output:**
- ✅ Geo-tight in dense cities (Jerusalem/Tel Aviv legs often < 0.5 km).
- ❌ **Temporarily-closed venues leak into plans** (B1, B2).
- ❌ **Two food/restaurant stops** are common, including back-to-back (G3, B4, B5).
- ❌ **Un-walkable legs** (3.58, 5.69, 2.96 km) presented as a flowing evening; the 6 km gate is too loose.
- ❌ **Curated plans are unverifiable placeholders** with no real venue link, hours, or coordinates.
- ❌ **Budget is uncontrolled** (₪4+₪4+₪4 plans for a "just-met" first date).
- ❌ **Poorly-rated anchors** (g2.6) chosen when a city has thin in-focus inventory.

---

## 3. Feedback / problem-report rows (anonymized)

Live tables read with the service role. Volume is very low — the product has little real feedback yet, which is itself a finding (instrument this before/while building the agent).

- **`user_feedback`: 0 rows.**
- **`saved_plans`: 0 rows.**
- **`recommendation_outcomes`: 4 rows** — all only `maps_opened`/`reminder_set` engagement; **`went`, `rating`, `would_do_again` are all null** (no one has rated a plan after going). Example: impression 48 → maps_opened=true; impression 3 → reminder_set=true. No quality signal yet.
- **`recommendation_impressions`: 120 rows** (used in §2).
- **`user_quiz_results`: 2 rows** (e.g. Jerusalem/atmosphere/getting-to-know; Rishon LeZion/food-drink/just-met/short).

**`problem_reports`: 2 rows**

| created_at | type | message | location | resolved | admin notes |
|---|---|---|---|---|---|
| 2026-05-26 | `bug` | "Sign in to Google sends to local host" | — | false | none (this was the OAuth redirect bug, since fixed) |
| 2026-05-25 | `wrong_info` | "test" | Namal (Port), id 14 | false | none (a test submission) |

> There is **no archive of users complaining about bad plans, closed places, wrong hours, kosher issues, or distance** — not because they don't exist, but because **outcome capture is essentially empty**. The bad plans in §2 were found by replaying the engine, not from user reports. Treat §2 as the evidence base.

---

## 4. Database schema (relevant tables)

Full DDL in `supabase/schema.sql`. Key tables:

**`locations`** (the only real content source). 63 columns exist; see §6 for the full list and fill rates. Core shape:
```sql
create table locations (
  id bigint primary key, name text not null, name_he text,
  city text not null, city_he text, category text not null,
  occasion text[] default '{}', price int default 2, date_stage int[] default '{}',
  description text, description_he text, maps_query text, kashrus text,
  featured boolean default false, status text default 'approved',
  slug text, region text, needs_verification boolean default false, image_url text,
  -- enrichment (Google Places, via scripts/enrich-locations.mjs):
  lat double precision, lng double precision, opening_hours jsonb, phone text, website text,
  google_rating numeric(2,1), google_price_level int, google_place_id text,
  business_status text, formatted_address text, last_enriched_at timestamptz,
  enrichment_source text, photo_refs jsonb, image_attribution text,
  confidence_score int, verification_status text, missing_fields text[], manual_edits jsonb,
  -- curator-owned (ALL 0% populated today):
  vibe_tags text[], indoor_outdoor text, best_time text[], duration_min int, duration_max int,
  energy_level int, dress_code text, romantic_score int, conversation_score int, adventure_score int,
  impressive_score int, low_pressure_score int, hidden_gem_score int, uniqueness_score int,
  weather_fit text, season_fit text, searchable_keywords text[], quietness_score int, energy_score int,
  activity_vs_food_score int, group_vs_intimate_score int, notes_internal text,
  last_curated_at timestamptz, curated_by text,
  created_at timestamptz default now()
);
```
- RLS: `public_read_approved` (status='approved'); all writes are admin-only (`app_metadata.role='admin'`).

**There is NO "date_plans" table.** Curated plans live only in the JS file `src/data/datePlans.js` (placeholder stops, see C1). Generated plans are computed at runtime and never stored as plans — only an impression record is written.

**Quiz / preference capture:**
```sql
user_quiz_results(id, user_id, answers jsonb, created_at)         -- answers = {city, seriousness, focus, length?, when, _seed}
user_preferences(user_id pk, lang, last_city, updated_at)
```

**Feedback / outcomes / impressions:**
```sql
recommendation_impressions(id, session_id, user_id, quiz_answers jsonb, primary_plan_id text, backup_location_ids text[], created_at)
recommendation_outcomes(id, recommendation_impression_id, saved, shared, maps_opened, reminder_set, went, rating int, would_do_again, updated_at)
user_feedback(id, user_id, item_type, item_id, went, rating int, would_do_again, notes, updated_at)
problem_reports(id, type, message, email, location_id, location_name, resolved, created_at)  -- INSERT triggers Telegram via pg_net
location_reviews(id, location_id, user_id, rating 1-5, body, created_at)  -- note: avg_rating/review_count columns referenced by the trigger DO NOT exist on locations (latent bug)
```

**Enrichment bookkeeping:** `enrichment_runs`, `enrichment_failures` (admin-readable run history). `manual_edits.fields` jsonb array protects curator edits from being overwritten by re-enrichment.

---

## 5. Current code files

Full source of the planning-critical files is concatenated in **`CHATGPT_HANDOFF_CODE.md`**:
- `src/lib/planRecommendations.js` — primary generated-plan engine (anchor + support stops, variety, dedup, exploration).
- `src/lib/planCoherence.js` — geo/flow/time/duration heuristics + `validatePlanFlow` (the sanity checks).
- `src/lib/locationRecommendations.js` — per-location scoring, the **only** `CLOSED_PERMANENTLY` hard filter, dormant curated-fit scoring.
- `src/lib/quiz.js` — curated-plan scoring + session helpers.
- `src/data/datePlans.js` — curated plan shape (placeholder stops).
- `src/components/QuizStepper.jsx` — the 4-question input UI.
- `src/lib/constants.js` — cities, categories, `CITY_COORDS`.
- `src/lib/planBuilder.js` — the **unused** slot-template engine (good reference for "opener→main→dessert, no two dinners" structure).

Render path: `src/App.jsx` (`getSmartMatchedPlans` at ~line 159; `getRecommendedLocations` at ~line 184) → result components `ResultCard` / `PlanComposeDebug` (debug overlay shows `_compose` legs + flow warnings).

---

## 6. Location data-quality fill table (317 approved rows, live 2026-06-17)

| Field | Exists? | Filled | Trust |
|---|---|---|---|
| `lat` / `lng` | ✅ | **100%** | High (Google) |
| `formatted_address` | ✅ | 98% | High |
| `region` (neighborhood proxy) | ✅ | **37%** | Partial |
| `business_status` | ✅ | 98% | High but **point-in-time** |
| `opening_hours` | ✅ | **88%** | Medium — **stored but never used by engine** |
| `google_rating` | ✅ | **100%** | High |
| Google reviews **count** | ❌ | — | **Not stored** (only the average rating) |
| `google_price_level` | ✅ | 32% | Low coverage; `price` (1–4) is 100% |
| `price` (1–4) | ✅ | 100% | Medium (mixed curated/Google) |
| `category` | ✅ | 100% | High |
| `city` / `city_he` | ✅ | 100% | High but **spelling variants** ("Petach"/"Petah" Tikva) |
| neighborhood (distinct field) | ❌ | — | Use `region` (37%) |
| `vibe_tags` | ✅ col | **0%** | None |
| `romantic_score` | ✅ col | **0%** | None |
| `energy_score` / `quietness_score` | ✅ col | **0%** | None |
| `best_time` | ✅ col | **0%** | None — time-fit logic runs on category defaults |
| `duration_min` / `duration_max` | ✅ col | **0%** | None — durations are templated |
| `indoor_outdoor` | ✅ col | **0%** | None |
| `weather_fit` / `season_fit` | ✅ col | **0%** | None |
| reservation required | ❌ | — | **No column** |
| `kashrus` (kosher) | ✅ col | **0%** | None — kosher-first app with **zero kosher data** |
| `last_enriched_at` (≈ last verified) | ✅ | 98% (all ≤30 days) | Google sync date, **not human-verified** |
| `enrichment_source` / `verification_status` | ✅ | 98% / 100% | `verification_status` = `auto` (309) or `closed` (8) |
| `last_curated_at` / `curated_by` | ✅ col | **0% / 0%** | **No human has ever curated a row** |
| `confidence_score` | ✅ | 100% | Derived heuristic (see ENRICHMENT_README) |
| `photo_refs` / `image_url` | ✅ | 97% / 98% | Medium |

**Closure reality:** 8 `CLOSED_PERMANENTLY` + **9 `CLOSED_TEMPORARILY`** = 17 closed venues, **all `status='approved'` and all eligible for plans**. Only the 8 permanent ones are filtered, and only on the single-place rails. **8 venues have google_rating < 3.5.**

---

## 7. Verification rules — what we can trust today

- **Can we trust `business_status`?** Partially. It's accurate **as of the last enrichment** (≤30 days), but it's a **snapshot**, not live. It distinguishes `OPERATIONAL` / `CLOSED_TEMPORARILY` / `CLOSED_PERMANENTLY` — but the app **only acts on `CLOSED_PERMANENTLY`, and only outside the plan generator**, so temporarily-closed venues reach users (proven: B1, B2).
- **Can we trust `opening_hours`?** The data is present for 88% and comes from Google, so it's reasonably trustworthy — **but the app never reads it**. Nothing checks whether a stop is open at the (uncollected) date/time. No Shabbat/holiday awareness.
- **Refresh cadence:** manual — `node scripts/enrich-locations.mjs` (resumable, `--stale-days=30`). No scheduled job; everything is currently ≤30 days old because someone ran it recently.
- **Re-check one place on demand?** Not in the product. The script supports `--ids=14` to re-enrich a single row, but there's no UI/endpoint to trigger a live re-check before showing a plan.
- **Google Places API key available?** **Yes** — `GOOGLE_PLACES_KEY` is in `.env` and proven working. Currently **build-time only**; could be called at request time (mind quota/latency/cost).
- **Add live Places checks before showing a plan?** Feasible: call Place Details for each candidate stop to confirm `businessStatus` + `currentOpeningHours` at request time. Best done server-side (Edge Function/route) to protect the key and cache results.
- **Store "last verified" + "verification source"?** Already supported: `last_enriched_at`, `enrichment_source`, `verification_status`, `confidence_score`, `manual_edits` all exist. Add a human-verification timestamp distinct from the Google sync (`last_curated_at` exists but is unused).

---

## 8. Technical constraints

- **App framework:** **React 19 + Vite 8** SPA (**not Next.js**). All state in `App.jsx` (~1600 lines), inline styles, no TypeScript, custom i18n, RTL Hebrew/English, PWA.
- **Where the agent should live:** the frontend cannot safely hold the Google key or an LLM key, and shipping the whole location table to the browser is already a smell. **Recommended: a Supabase Edge Function (Deno) or a small server endpoint** that (a) runs the deterministic guardrails, (b) optionally does live Places verification, (c) optionally calls an LLM for narrative. Keep keys server-side. The current pure scoring functions can be reused verbatim server-side (they have no DOM deps except `localStorage`, which is trivially shimmed).
- **LLM at request time?** Architecturally yes (once moved server-side). None is used today.
- **Preferred model/provider:** the workspace standard is **Claude (Anthropic)** — default to the latest (e.g. Claude Opus 4.x / Sonnet 4.x). Use the LLM for **narrative + selection-among-validated-candidates**, never as the source of truth for hours/closure/distance/kosher.
- **Acceptable latency:** the quiz today is instant (client-side). A request-time agent should target **≤ 2–4 s**. Live Places verification + an LLM call fits if candidates are pre-filtered deterministically and results cached.
- **Live vs precomputed vs hybrid:** **Hybrid recommended** — precompute/cache verified candidate venues per city (nightly enrichment + a freshness gate), then assemble/validate at request time, with the LLM adding narrative on top of an already-validated stop list.
- **Add new DB columns?** Yes — admin-only writes via migrations; `manual_edits.fields` already protects curator columns from enrichment overwrite. Add e.g. `kosher_level`, `reservation_required`, `human_verified_at`, `reviews_count`.
- **Admin tools for verifying/editing places?** Partially exist: `AdminView.jsx` + `CuratorQueue.jsx` already expose every curator column (vibe_tags, romantic_score, best_time, indoor_outdoor, etc.) — they're just **never used**. The fastest data win is to actually run curation through this existing UI (or seed the columns via an LLM pass + human spot-check).

---

## 9. Recommended build path (deterministic guardrails first, AI narrative second)

**What to protect (do not break):**
- The deterministic coherence engine in `planCoherence.js` (proximity, flow, time-fit, `validatePlanFlow`) — it's the most valuable asset; keep it as a hard gate the LLM cannot override.
- The "city-scoped, focus-scoped anchor pool" logic and the honest "not enough options" fallback (just make it fire more often — see below).
- RLS / admin-only writes; key stays server-side.

**Stage 1 — Minimal fix (days, no AI):** close the proven bugs in §2.
1. Apply `applyHardFilters` **inside the plan generator**, and extend it to drop `CLOSED_TEMPORARILY` too (fixes B1, B2). Files: `planRecommendations.js`, `locationRecommendations.js`.
2. Tighten the same-locale gate from 6 km to ~**1.5–2 km walk / configurable drive** and add a real per-leg max (fixes B3, B4, Caesarea 5.69 km). File: `planCoherence.js` (`sameLocale`, `proximityScore`).
3. Make "no two food/restaurant stops adjacent" (and ideally per-plan) a **hard** rule, not a −1 nudge (fixes G3, B4, B5). File: `planRecommendations.js` (`scoreSupportStop`) / `planBuilder.js` slot logic.
4. Add a **kosher field + filter** and a **min-rating floor** (e.g. drop g<3.5 anchors unless nothing else). Fixes B3 (g2.6) and the kosher blind spot.
5. Fix the **city spelling variants** ("Petach"/"Petah" Tikva) and either link curated plans to real `locations` rows or retire them (fixes C1, N2).
6. Collect the missing inputs in the quiz: **date/time, budget, kosher level, indoor/outdoor, travel mode**. File: `QuizStepper.jsx`.

**Stage 2 — Better v1 (use the data you already have):**
7. **Actually read `opening_hours`** against the collected date/time as a hard gate (incl. Shabbat/holiday). 
8. **Populate the curator columns** (vibe_tags, romantic/energy/quiet scores, best_time, duration, indoor_outdoor, kosher) — via the existing `AdminView`/`CuratorQueue` UI and/or a one-time LLM enrichment pass with human spot-check. This single step "turns on" most of the already-written-but-dormant scoring.
9. Add **request-time Google Places verification** (Edge Function) for the final candidate stops; store `human_verified_at` + source.
10. Make the honest fallback fire whenever no **same-city verified** plan exists (stop leaking cross-city curated placeholders — fixes N1).

**Stage 3 — Full agent (AI narrative on top of validated candidates):**
11. Move planning to a **server endpoint / Edge Function**. Pipeline: deterministic filter (open + kosher + budget + distance + category rules) → produce a **validated candidate stop set** → LLM **selects/sequences among only those candidates and writes the narrative + variations** (Safe, Romantic, Fun, Budget, Premium, Rainy-day, Last-minute, Kosher-strict, Walking-only, Car-friendly, **Plan B**). The LLM never invents venues or hours; it only orders and narrates pre-validated, currently-open, in-budget, kosher-correct options.
12. Add a **Plan-B swap** (if a stop is closed/full, substitute the next validated candidate in the same slot).

**What to avoid:** letting the LLM pick venues or assert hours/closure/distance/kosher; trusting any curator column or `opening_hours` until filled and gated; building on curated `datePlans.js` placeholders; calling Google/LLM from the browser with embedded keys.

**Files ChatGPT should modify first:** `planRecommendations.js` (generator + hard filters), `planCoherence.js` (distance/flow gates), `locationRecommendations.js` (hard filters + kosher/rating), `QuizStepper.jsx` (new inputs) — then a new server/Edge Function for verification + LLM, then the curator data fill via `AdminView.jsx`.

---

## Appendix A — full `DATE_PLANNING_AUDIT.md`

> Paste the full contents of `DATE_PLANNING_AUDIT.md` here when sending to ChatGPT (kept as a separate file in the repo to avoid duplication).
