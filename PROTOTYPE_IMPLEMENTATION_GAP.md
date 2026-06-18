# Prototype → App Implementation Gap

Compares the HaMakom redesign prototype (the bundled HTML mockup + design brief)
against the real React app in `src/`. Goal: one canonical list so we stop
discovering missing features one at a time.

_Last updated: after commit `100f92d` (vibe tabs + results polish)._

## Status legend
- **Built** — present and working in the app.
- **Partial** — some of it exists; notable pieces missing.
- **Not built** — not in the app yet.

Each item also gets a launch tag: **Launch-blocking**, **Beta-safe**, or **Polish/later**.

---

## Recommendation (read first)

**Must-have before beta**
- **Single-spot date fallback + richer recovery** (#5, #6). Today, thin cities
  dead-end at "try another city." The audit shows 92 inventory-gap combos. A
  recommender that can't build a route should offer the strongest single
  verified venue as a one-stop date, and the fallback should offer *proven*
  recovery (nearby city / other vibe / browse) — never invented options.
- **Hard-gate guarantee** — every recommended venue (route stop *or* single
  spot) must be a real, operational, known-status, correct-city, non-placeholder
  DB row. Already enforced in the engine; must remain true for the new
  single-spot path.

**Nice-to-have before beta**
- **"Why this plan works" block** (#3) — cheap, high-trust. Today it's a
  one-line summary; the prototype shows three concrete reasons.
- **Lightweight per-stop cues** (#4) — at minimum a "Good first stop" marker on
  stop 1 and the existing "if the night is flowing" optional section.

**Later polish**
- Full per-stop badge taxonomy with data, "fully walkable" phrasing on the map,
  and decorative copy parity (#4, #13).

---

## Item-by-item

### 1. Vibe tabs / "3 plans in this city" — **Built** · Beta-safe
Shipped in `100f92d`. The chosen vibe is the primary plan; the engine surfaces
the strongest plan for other vibes in the same city; tabs swap the whole plan.
Hero match badge recomputes (Strong match / Also in {city}).
_Caveat:_ needs ≥2 vibes covered in the city. Sparse cities show fewer/no tabs
(correct, honest behavior).

### 2. Verify hours & kashrus disclaimer — **Built** · Beta-safe
Persistent info line on the results page ("we verify venues are active, but
hours can change — check the map link or call before going"). Matches the brief's
trust requirement.

### 3. "Why this plan works" block — **Partial** · Nice-to-have before beta
App shows a one-line italic fit summary (`getPlanFitSummary`) + the plan
narrative. The prototype shows a dedicated block with **three** checkmark
reasons derived from the answers. Missing: the structured 3-reason block.

### 4. Per-stop badges ("Good first stop," "If the night is flowing," "Backup") — **Partial** · Polish/later
App has per-stop `order_tip` text and an "If the night is flowing, add:"
optional-stops section. Missing: the colored per-stop pill badges and the
"Good first stop" / "Backup option" labels. No `badge` field exists in
`datePlans.js` data yet (0 occurrences), so this needs data + UI.

### 5. Rich honest fallback / recovery screen — **Partial → in progress** · Launch-blocking
An honest fallback screen exists ("Not enough strong options in {city} yet —
try a different city or experience") with retry/browse actions. Missing: the
prototype's *proven* recovery — "nearby city has N plans (~X min away)," "keep
the city, change the vibe," "browse verified places," "build your own." Being
addressed alongside #6.

### 6. Single-spot date fallback — **Not built → in progress** · Launch-blocking
When a full 2–3 stop route can't be built, the app should offer the strongest
single verified venue as an explicit one-stop "simple date" (coffee / dessert /
dinner / activity / scenic walk / drinks), clearly labeled as one stop, not a
fake route. Connects the long tail of locations (and the 92 gap combos) to the
quiz flow. Implementing now.

### 7. Save / share behavior — **Built** · Beta-safe
Save toggles with confirmation ("✓ Plan saved"), reminder toggle, share via
`navigator.share` with WhatsApp fallback, Open-in-Maps. Save is sign-in gated
via `ResultsGateModal`. Matches the brief's "instant confirmation on save/share."

### 8. Map behavior — **Built** · Beta-safe
`PlanRouteMap` (lazy-loaded Leaflet + OSM tiles, cream theme) renders the whole
route with numbered gold pins and a distance + walk-time badge (e.g.
"900m · ~12 min"). Only renders when ≥2 stops have coords. The prototype's
"fully walkable" phrasing isn't shown (we show the time instead). The real
Leaflet map exceeds the prototype's decorative grid.

### 9. Browse → build your own plan — **Built** · Beta-safe
Explore/Browse (by category + city), place detail, and `CustomPlanBuilder`
("Build your own plan") all exist, correctly demoted to secondary paths as the
brief asked.

### 10. Plan result cards — **Built** · Beta-safe
Tonight's-Pick card on home (now fully tappable, match badge, View →) and the
full results hero card. Match the prototype's card structure.

### 11. Mobile layout — **Built** · Beta-safe
Mobile-first (max-width ~540, 100dvh, fixed bottom nav, RTL/Hebrew support).
Responsive rather than fixed-phone-frame like the mockup.

### 12. Empty states — **Partial** · Beta target (folds into #5/#6)
Has: honest fallback screen, generic `EmptyState`, empty-saved states, and an
empty-city "recommend a place" CTA. The main quiz empty state is the fallback
screen — improving it is #5/#6.

### 13. Prototype copy not reflected in the app — **Partial** · Mostly Polish/later
Matched: home hero copy, tab labels, badges. Missing/not yet mirrored: the
"why this plan works" reason copy (#3), per-stop badge copy (#4), fallback
recovery copy like "Tiberias has 4 plans, ~30 min away" (#5), and "fully
walkable" (#8). Most are cosmetic except the fallback copy, which ships with #5.

---

## Launch-blocking summary
Only **#5 (rich fallback)** and **#6 (single-spot fallback)** are launch-blocking,
and both are being implemented next. Everything else is Built or safe to defer.
The hard-gate guarantee must hold for the new single-spot path.
