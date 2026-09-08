# HaMakom release audit — 8 September 2026

## Release status

The paused Supabase project was restored. The live public catalog, account saves, account deletion, analytics isolation and notification authentication have been checked. The web release is prepared for GitHub deployment; final deployment results are recorded below when available. This report describes a web release, not an Android/iOS store release or a guarantee that every possible bug has been eliminated.

## What changed

- **Two choices to get a plan:** city and date stage. Duration, food requirements, kashrut, budget, date/time, travel mode and menu links are optional Fine-tune controls on results. Cancel and Reset work without restarting the quiz.
- **Beit Shemesh and city coverage:** canonical city aliases include Ramat Beit Shemesh and Hebrew spellings. Every one of the 83 catalog cities produces an idea with the default two-choice flow.
- **Maps:** single-place and multi-stop plans display maps. Numbered pins use actual venue coordinates. Missing coordinates produce a labeled area map rather than an invented venue pin. Google Maps navigation includes the full route in order.
- **Coherent plans:** generated, curated, custom, shared and saved plans use one validator. It checks current venue IDs, closures, city, route distance, food order, visit/travel duration, dietary evidence, price caps and optional opening-hour windows. Street travel, holiday exceptions and reservations still require checking.
- **Menus and food needs:** source-backed menu links and vegan, vegetarian, gluten-free and dairy-free tags. Unknown food information never passes a restrictive filter. Chain information and separate dietary options are explicitly labeled; no allergy-safe or kashrut claim is inferred.
- **Reliable data:** paginated public catalog, matching live/offline IDs, honest fallback notices, no merging rejected/deleted rows back into live results. Added Greg Beit Shemesh as database ID 318 and repaired the stale database ID sequence. Offline data now preserves real coordinates and the original enrichment timestamps.
- **Saves and sharing:** portable plan IDs retain stops/order/mode/time. Guest saves work; switching accounts clears the previous account's local state. Save reconciliation preserves unseen changes from another device. Deletion failures are visible.
- **Privacy:** an allowlisted public view replaces anonymous access to internal location fields. Analytics tables and aggregate views are private. Outcome updates use a narrow session/account-bound RPC with client UUIDs compatible with the live bigint database IDs. Deleting an account cascades through its analytics. Removed unconditional Clarity tracking and private API caching.
- **Notifications:** removed the hardcoded report secret, rotated it in Edge Functions, stored its database copy in Vault, and verified the retired value is rejected. Fixed Telegram's public HTTPS callback and gateway settings. Registration returned success; the report handler accepted a harmless empty payload without sending messages.
- **Release safeguards:** regression tests and catalog/dependency checks run before deployment. Escaped prerender JSON-LD, constrained output slugs, applied compatible dependency updates, and separated the catalog bundle from app code.

## Verification

- `npm test`: 32 regression tests passed.
- `npm run lint`: passed.
- `npm run audit:system` and `npm run audit:live`: each tested 3,735 scenarios and validated 3,036 returned plans; zero invalid plans and duplicate IDs. 1,629 constrained scenarios had no match, reported honestly rather than filled with unrelated places.
- Catalog: 318 approved records, 277 discoverable venues, 83 cities, 276 coordinate-bearing venues, 269 marked operational, 190 food venues, six discoverable researched menu/dietary records.
- `npm run build`: passed, including PWA assets, 277 venue pages and four static pages. App bundle approximately 163 kB gzip plus separately cached catalog 87 kB gzip; Vite still reports its uncompressed chunk-size advisory.
- `npm audit --omit=dev`: zero vulnerabilities.
- `scripts/verify-release.mjs --exercise-auth`: creates two temporary test accounts without emails, tests cross-account and anonymous isolation, cross-session save restoration, outcome validation/partial updates, and account deletion/cascades; cleans up both accounts. See `release-verification.json` for the final outcome.
- Mobile browser checks: English two-choice Beit Shemesh quiz produced Keramikli → Rimon with actual map pins and navigation; vegan + menu filtering produced Greg with chain-source/unknown-coordinate disclosures; Hebrew shared two-stop map and itinerary rendered correctly. Earlier checks also covered Cancel, empty-result Reset, guest save/reload, custom maps, shared timing and unavailable-link recovery.
- Supabase Google provider is enabled. Password-authenticated temporary sessions and account deletion were exercised. No real Google-account login or email delivery was sent during these tests.
- Suggestion, problem-report and partner-submission writes passed an anonymous-role SQL transaction that was rolled back. Separate API reads confirmed no test submissions remained. Report and Telegram authentication were checked without sending test messages to people.

## Applied database changes

Applied the venue-details, sequence, public-catalog, analytics-access and notification-secret migrations dated 20260908. Also applied the additive kashrut/partner schema and validated partner-submission RPC from migration_20260714_monetization_foundation.sql. Do not reapply historical schema policies over the current migrations.

## Data scope and operational limits

Only six discoverable venues currently have researched menu/dietary evidence. Filters intentionally reveal that coverage gap. Most locations have older operational/hour enrichment, not real-time verification; the Google Places key returned PERMISSION_DENIED during this audit, so those records were not falsely marked refreshed. Menu and kashrut curation should continue as an ongoing operation. Verified-kashrut filters can correctly return no food matches when certificate evidence is absent.

Source additions were checked on 8 September 2026:

- [Rimon Beit Shemesh](https://www.caferimon.co.il/BeitShemesh): branch menu, address, phone, regular hours; vegetarian options. The generic vegan/gluten-free legend was not sufficient to assign those tags to dishes.
- [Bleecker Beit Shemesh](https://bleeckerbakery.co.il/סניפים-דרום/סניף-בית-שמש/): branch menu, contact and hours; vegetarian options.
- [Greg official menu](https://gregcafe.co.il/menus/) and [Beit Shemesh branch](https://gregcafe.co.il/branch/בית-שמש/): chain menu with vegan options; branch address. Chain availability is clearly labeled.
- [Aroma official menu](https://www.aroma.co.il/menus/): chain vegan and gluten-free options, with branch availability caveat.
- [Piccolino official menu](https://piccolino.co.il/wp-content/uploads/2026/05/תפריט.pdf): specifically marked vegan dishes and vegetarian options.

Neither a dietary tag nor dairy-free food means an allergy-safe kitchen. Combining vegan and gluten-free filters establishes separate published options at a venue; the same dish and cross-contact still require branch confirmation. Kashrut is never inferred from vegetarian food, a venue name or a legacy description.

## Remaining follow-up

- Maintain venue status, menu and certificate sources. There is no holiday calendar, live booking inventory or guaranteed street-route duration.
- Public forms and analytics need stronger measured rate limiting as traffic grows; frontend cooldowns alone are not a server-side anti-spam system.
- Partner inquiries are stored privately; the optional notify-partner-inquiry Edge Function has not been deployed. The admin inbox remains the source of truth.
- Full development dependency audit still reports seven advisories in the native asset-generation tool chain; production dependencies are clear. Do not process untrusted native assets with that tooling. No native build/store submission was performed.
- Full simultaneous multi-device edit semantics, real OAuth/email delivery and backup-retention operations are not established by the temporary-account tests.
- Vite hot-refresh fails in the available in-app browser. Production preview works and was used for UI verification.

## Deployment

Pending final GitHub push and hosted smoke check.
