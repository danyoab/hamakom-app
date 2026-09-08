# Current planning contract

Updated 8 September 2026. This supersedes the historical DATE_PLANNING_RULES.md where they differ.

## Ideas and routes

A single-place date needs a named, approved venue with a real city and category. Known temporary/permanent closures and generic chain/Home records are excluded. Unknown availability is prominently disclosed. This permits useful discovery during an outage without inventing a route.

A route contains two or three distinct venues. Every venue must additionally have OPERATIONAL status and valid venue coordinates. Curated, generated, custom and shared routes use the same validation. Saved/shared IDs resolve against the current catalog before display.

## Mandatory constraints

- Exact canonical city throughout; Beit Shemesh includes Ramat Beit Shemesh. Flexible-city selection is explicit.
- Maximum straight-line leg: walking 2 km; driving 6 km. Travel estimates include a detour factor and, for driving, parking allowance. They are estimates, not navigation.
- At most one full meal. Consecutive food stops require a light second stop; no dinner after dessert. Stored food_type takes precedence over name-based classification.
- Budget applies to each stop's catalog price level, not an invented total bill. Unknown price does not match a capped budget.
- Selected dietary requirements apply to every food stop and need tags plus a safe source URL and check date. Non-food stops need no dietary evidence. Separate tags do not establish that one dish meets combined requirements.
- Verified kosher requires verified status, authority, a valid past check date, and no expired/invalid supplied expiry. Mehadrin additionally requires its explicit level. Unknown/legacy kashrus text never passes this gate.
- Estimated duration is actual selected visits plus transit. Short plans cap at 120 minutes; medium at 180. One-place fallback duration stays explicit even when the user wanted a longer date.
- When both date and start time exist, known regular opening periods must cover the whole visit plus 15 minutes. Overnight, week wrap and split periods are supported. Unknown, holiday and Shabbat-relative hours remain unconfirmed; a regular-hours match is not a booking or live-open guarantee.

## Ranking and recovery

The quiz asks only city and date stage. The results show a map and a collapsed Fine-tune panel for duration, food needs, kashrut, budget, date/time, travel mode, vibe and menu links. Edits apply together; cancel discards the draft. Reset retains city and stage. Empty results retain the same controls so users can recover without repeating the quiz.

Maps render for single-place dates as well as routes. Only supplied venue coordinates produce pins; missing coordinates use an explicitly labeled area viewport without a pretend venue pin. Partial data preserves stop numbering and does not draw a complete route. Full-route navigation includes every stop in order and the selected travel mode. Map lines show straight-line relationships, not street directions.

Hard constraints run before preference scores. Vibe/stage/feedback rank eligible places; they do not override constraints. Prefer coherent routes where the data permits them. Otherwise offer clearly labeled one-place dates in the selected city. Never pad results with unrelated cities, generic placeholders, or guessed coordinates.

Alternatives are separately validated places in the selected area. They are not certified drop-in substitutions for an existing route. The custom builder checks the full new route before offering a second stop.

The public database response is authoritative, including an empty response. Do not merge seed rows into it. Offline fallback and cached data are disclosed; use audit:live to assess the database without fallback.

## Verification

Run `npm run lint`, `npm test`, `npm run audit:system`, `npm run build` and `npm audit --omit=dev`. The offline audit reports inventory gaps separately from invalid plans. Run `npm run audit:live` with a functioning database before release. A passing seed test is not an auth, moderation or cloud-save integration test.
