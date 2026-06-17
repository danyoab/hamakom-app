# HaMakom — Date Planning Rules (Source of Truth)

> This is the **planning spec** the deterministic engine must obey. It is not an AI agent.
> The current JavaScript planner stays; these rules make it safer and more trustworthy.
> Companion docs: `DATE_PLANNING_AUDIT.md` (how the system works today), `CHATGPT_HANDOFF.md` (real data + bad-plan evidence).
>
> **Legend:** ✅ ENFORCED NOW (Priority 1, shipped) · 🟡 PLANNED (Priority 2) · 🔵 PLANNED (Priority 3) · ⚪ LATER (optional).
> The golden rule: **fewer, verified, correct plans beat more, prettier, unverified plans.** When in doubt, drop the plan and say so honestly.

---

## 0. Core principles

1. **Facts before beauty.** Every stop must be a real database venue with coordinates, a category, and a known open/closed status before it can appear. No exceptions.
2. **The planner may never invent** a venue, address, opening hours, kosher status, price, or distance. If a fact is unknown, treat it as a fail, not a guess.
3. **Hard rules are gates, not scores.** A violation removes a venue/plan entirely; it is never "penalized but still shown."
4. **Honesty over coverage.** If there aren't enough verified options, say so and offer to loosen filters. Never paper over a gap with a wrong-city or placeholder plan.
5. **AI is optional and last.** If narration is ever added, it only re-words already-validated plans and can never override a gate.

---

## 1. Required user inputs

**Collected today (✅):** city, relationship stage, experience focus, length (optional).

**Target intake (minimum):**

| Input | Status | Values |
|---|---|---|
| City / area | ✅ | canonical city list |
| Relationship stage | ✅ | just-met · early-dating · serious · long-term |
| Experience focus | ✅ | conversation · fun/activity · romantic · chill · fancy · outdoors · surprise |
| Length | ✅ | 60–90 min · 2h · 3h · flexible evening |
| **Date (day)** | 🟡 | calendar date |
| **Start time** | 🟡 | clock time |
| **Budget** | 🔵 | budget-friendly · normal · premium · no preference |
| **Kosher level** | 🔵 | not-needed · preferred · kosher-only · mehadrin |
| **Travel mode** | 🟡 | walking-only · short taxi/car ok · driving ok |
| **Indoor/outdoor** | 🔵 | indoor · outdoor · either · rain-safe only |

**Optional flags (⚪):** avoid dairy/meat, no alcohol, needs parking, needs reservation, not too loud, good for talking, minimal walking, open-now/last-minute.

> Until date/time, budget, kosher, and travel-mode inputs exist, the engine applies safe **defaults** (see each rule). Defaults must always err toward caution.

---

## 2. Hard rules that can never be broken

A plan is **rejected** (not shown) if any of these fail. A venue is **excluded** from all plans if it fails a venue-level gate.

| # | Hard rule | Status |
|---|---|---|
| H1 | Every stop is a real DB venue with `id`, coordinates, category. | ✅ |
| H2 | No venue with `business_status` = `CLOSED_TEMPORARILY` or `CLOSED_PERMANENTLY`. | ✅ |
| H3 | No venue with **unknown/null** status (unless freshly verified). | ✅ |
| H4 | No plan in a city other than the one the user chose (no cross-city fallback). | ✅ |
| H5 | No placeholder/generic plans (every stop links to a real venue). | ✅ |
| H6 | At most **one** heavy meal (no two dinners / two restaurants). | ✅ |
| H7 | Every leg within the travel-mode distance limit (default cap 2 km). | ✅ |
| H8 | Every stop open for its whole visit window (arrival + duration + 15 min buffer). | 🟡 |
| H9 | Kosher-only / mehadrin users get only verified-kosher food. | 🔵 |
| H10 | No premium-stacked plan unless the user asked for premium. | 🔵 |
| H11 | Every shown plan has a valid backup. | 🟡 |

---

## 3. Avoiding two dinner / heavy-food stops (H6) ✅

Enforced at runtime in `scoreSupportStop` via `violatesFoodPairing` (`src/lib/planGates.js`).
Classify every food venue (derived from category + name today; a stored column later):

- `is_food`: true for Cafés & Restaurants, Wineries, Hotels & Lounges (bar/lounge).
- `food_type`: restaurant · cafe · dessert · bar · ice_cream · bakery · snack · winery.
- `meal_weight`: **heavy** (sit-down restaurant) · **medium** (café) · **light** (dessert/bar/bakery/ice-cream/snack/lounge/winery).
- `can_be_meal_anchor`: true only when `meal_weight = heavy`.
- `can_follow_dinner`: true for light food types (dessert, bar, ice-cream, bakery).

**Rules:**
- A plan may contain **at most one** stop with `meal_weight = heavy`.
- Two adjacent `is_food` stops are allowed **only** if the second has `can_follow_dinner = true` (e.g. dinner → dessert, dinner → wine bar).
- Forbidden: restaurant → restaurant, dinner → dinner, heavy → heavy, café(heavy-ish) → restaurant.
- Allowed: activity → dinner · dinner → walk/viewpoint · coffee → walk · activity → dessert · walk → dinner · dinner → dessert.

---

## 4. Distance / travel limits (H7) ✅ (default cap) / 🟡 (per-mode)

Enforced at runtime in `scoreSupportStop`: any support stop more than `MAX_LEG_KM` (2.0 km) from the previous stop is hard-rejected (`src/lib/planGates.js`). The per-travel-mode limits below activate once a travel-mode input is collected (Priority 2B).
The old 6 km "same locale" rule was too loose (it allowed a proven 5.69 km leg). Travel-mode limits:

| Mode | Ideal leg | Hard max leg | Total | Notes |
|---|---|---|---|---|
| Walking only | ≤ 0.6 km | **1.2 km** | ≤ 1.8 km | ≤ ~15 min/leg |
| Short taxi/car | ≤ 10 min drive | **15 min** | — | ≤ 1 transfer |
| Driving ok | ≤ 15 min drive | **20 min** | — | prefer parking-friendly |

- **Default when travel mode is unknown:** hard max leg **2.0 km** (kills all proven bad legs of 2.96–5.69 km while keeping dense-city plans intact).
- Straight-line (haversine) is acceptable as the current measure; upgrade to real routing only if a routes API is added (⚪).
- A leg over the limit is a **hard reject** of that stop, not a penalty. The plan returns shorter rather than dragging the user across town.

---

## 5. Verifying closed / temporarily closed places (H2, H3) ✅ / 🟡

- **Source of truth:** Google `business_status`, captured by `scripts/enrich-locations.mjs`. Allowed value: **`OPERATIONAL`** only.
- **Excluded:** `CLOSED_TEMPORARILY`, `CLOSED_PERMANENTLY`, and **null/unknown**.
- **This gate runs inside the plan generator** (anchors *and* support stops), not only on the browse rails — this was the #1 proven bug. ✅
- **Freshness (monthly refresh model):** re-run enrichment ~monthly. Treat stored status as valid when `last_enriched_at` is within **35 days**. Older than that → flag stale; refresh before trusting. 🟡
- **No per-request live Google calls** in the current design (cost/latency). Live re-check is optional and only for rows ever seen closed. ⚪
- Recommended stored fields when columns are added (🔵): `last_verified_at`, `verification_source`, `verified_business_status`, `closed_detected_at`, `reopened_verified_at`.

---

## 6. Opening hours (H8) 🟡

- The DB stores `opening_hours` for ~88% of venues but the engine **does not read it yet**. Wiring this is Priority 2 and depends on collecting date + start time.
- **Per stop:** compute estimated arrival → add expected duration → add 15-min buffer → confirm the venue is open for that whole window. Example: dinner 20:00, 75 min → must be open until ≥ 21:30.
- **Shabbat / holiday awareness:** observant audience — never schedule a closed-on-Shabbat venue for a Friday-night/Saturday window.
- **Missing/unparseable hours:** exclude by default. Only allow if the user explicitly accepts "unverified hours."

---

## 7. Kosher requirements (H9) 🔵

- Kosher **cannot** be inferred from vibe or the `frum-friendly` occasion tag. It requires real data (currently 0% populated).
- Stored fields to add: `kosher_status` (not_kosher · kosher_unverified · kosher_verified · mehadrin), `kosher_certifier`, `kosher_last_verified_at`, `meat_dairy_parve`, `shabbat_open`, `kosher_notes`.
- **Rules by user setting:**
  - *Not needed* → no kosher gate.
  - *Preferred* → prefer verified kosher; non-food activities allowed; clearly label any non-verified food.
  - *Kosher only* → all food stops must be `kosher_verified` or `mehadrin`.
  - *Mehadrin/strict* → food stops must be `mehadrin`.
- Never label a venue kosher unless verified. For non-food activities kosher isn't required, but **any food stop in that plan must still obey** the user's kosher rule.
- Until kosher data exists, *kosher-only* / *mehadrin* honestly returns "not enough verified kosher options yet" rather than guessing.

---

## 8. Budget (H10) 🔵

- Map `price` (1–4) to budget setting:
  - Budget-friendly → 1–2 · Normal → 1–3 · Premium → 3–4 · No preference → 1–3 (allow 4 only if focus = fancy/premium).
- **First-date / just-met default:** avoid very expensive plans unless the user explicitly chose premium (fixes the proven ₪4+₪4+₪4 first-date plans).
- Do not stack multiple high-cost stops unless premium was requested.
- Every plan reports an estimated cost band: low · medium · high · premium.

---

## 9. Plan variations (✅ structure, 🟡 richer set)

Return **3–5** variations max, chosen from the validated candidate set — never all of them, never padded.

Catalog: Best Overall · Best for Conversation · Romantic · Fun/Activity · Budget-Friendly · Premium · Rain-Safe · Kosher-Verified · Short & Simple · Plan B.

Good structures by focus:
- First date: coffee → walk · activity → casual food · dessert/café → walk.
- Romantic: viewpoint/walk → dinner · dinner → dessert · activity → dinner → scenic finish.
- Fun: activity → food · food → activity · activity → dessert.
- Short: one strong anchor + one nearby add-on.
- Rainy: indoor activity → indoor food · café → indoor experience.

Every variation must obey **all** hard rules. A variation that can only be built by breaking a rule is simply not offered.

---

## 10. Plan B / backup (H11) 🟡

Every final plan ships with at least one backup that is:
- same city/area · same date/time availability · same kosher compatibility · similar price · similar category/vibe · within the same travel radius.
- Outdoor/rain-sensitive stop → backup is an indoor replacement.
- The backup is a real, gated venue (it passes every hard rule too).

---

## 11. Avoiding wrong-city fallback (H4) ✅

- When the user picks a specific city, **only that (canonical) city's venues** may appear — as anchors or support stops.
- Curated/cross-city plans are **not** allowed to fill a gap. The proven Eilat → Tzur Hadassah leak is removed.
- **City normalization:** map spelling variants to one canonical name (e.g. `Petah Tikva` → `Petach Tikva`) on both the answer and the venue before matching. ✅
- If the chosen city lacks enough verified options, show the honest message (Section 14) and offer a nearby area — never a silent wrong-city swap.

---

## 12. Avoiding placeholder / generic plans (H5) ✅

- Every plan stop must resolve to a real `locations` row: it needs `id`, coordinates, category, and a status the gates can check.
- The hand-written curated plans in `src/data/datePlans.js` use **placeholder stops** ("Café in Givat Shmuel Center", "Dessert (optional)") that link to no real venue — these are **rejected** until each stop is linked to a real DB id.
- A plan with any unlinked/generic stop is dropped entirely.

---

## 13. Ranking plans (after gates)

Only venues/plans that passed **every** hard rule are scored. Suggested signals (already largely present in the engine):

- **Venue:** Google rating, fresh verification, category fit, budget fit, kosher fit, vibe fit, stage fit, time-of-day fit, indoor/outdoor fit.
- **Plan:** logical sequence, travel smoothness, no duplicate heavy categories, emotional flow, conversation suitability, stage-appropriateness, budget consistency, rain safety, backup strength, variety vs recently shown plans.
- Ranking must be **explainable** in a debug view (the engine already attaches `_compose` legs + flow warnings).

---

## 14. What to show the user

For each plan:
- Title · "best for" · short summary.
- Stops in order with arrival time, duration, and per-leg travel time/distance.
- Estimated budget band.
- Kosher confidence (if relevant) and open/verified status per stop.
- Reservation note (if relevant).
- A backup option.
- "Why we chose this," plus any warning/uncertainty shown plainly.

**When not enough verified options exist:**
> "We don't have enough verified options in this city yet. Try a nearby area, or loosen a filter (budget / kosher / distance)."

Never replace this honest message with a wrong-city or placeholder plan.

---

## 15. Feedback to track

Outcome data is currently near-empty — instrument it. Capture: plan shown · plan selected · map clicked · saved/shared · issue reported · rated · (voluntarily) went.

One-tap problem buttons on every plan/stop: **closed · too far · not my vibe · too expensive · kosher info wrong · hours wrong · bad plan · great plan.** Each report flags the venue for admin review and feeds ranking.

---

## 16. Test cases the planner must pass (Definition of Done)

| # | Test | Gate | Status |
|---|---|---|---|
| T1 | A temporarily-closed venue never appears. | H2 | ✅ |
| T2 | A permanently-closed venue never appears. | H2 | ✅ |
| T3 | A venue with unknown status never appears. | H3 | ✅ |
| T4 | A city request never returns another city (no Eilat→Tzur Hadassah). | H4 | ✅ |
| T5 | No placeholder/generic stops appear. | H5 | ✅ |
| T6 | City spelling variants resolve to one city. | H4 | ✅ |
| T7 | A walking plan never includes a 3–6 km leg (capped at 2 km). | H7 | ✅ |
| T8 | No plan has two full-dinner restaurants. | H6 | ✅ |
| T9 | Every stop is open during the planned window. | H8 | 🟡 |
| T10 | A first-date normal-budget plan has no 3 premium stops. | H10 | 🔵 |
| T11 | A kosher-only user never receives unverified food. | H9 | 🔵 |
| T12 | If not enough safe venues exist, the app says so honestly. | H4/H5 | ✅ |
| T13 | Every shown plan has a backup. | H11 | 🟡 |
| T14 | Every stop has a real DB id, coords, status, and category. | H1 | ✅ |

**Done means:** all ✅ tests pass now; 🟡 after Priority 2; 🔵 after Priority 3. Optimize for fewer, better, verified plans — not more plans.
