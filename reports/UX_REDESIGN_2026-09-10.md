# Product redesign — 10 September 2026

The public experience now uses a shared system font, neutral surfaces, blue actions, consistent icons, accessible focus indicators and responsive spacing. Results lead with the places, duration and two actions, followed by a numbered itinerary and an always-visible map. Advanced preferences open in a modal sheet instead of competing with the plan.

Changed home, two-choice quiz, results, browsing/search/filtering, place cards/details, Saved, profile, and custom-builder city selection. Removed simulated multi-second loading, the guest Saved sign-in interruption, redundant detail sharing buttons, and irrelevant food disclosures for parks. Fixed details opening at an inherited scroll position. Sharing always offers a copyable link even when native sharing is unavailable. Dialogs support Escape, modal focus and focus restoration. Menu and dietary evidence requirements are unchanged.

Validation:
- ESLint and production build pass.
- All 32 regression tests pass.
- System audit: 3,735 scenarios, 3,036 generated plans, no invalid plans or duplicate IDs. Inventory: 277 discoverable places, 83 cities. Strict restrictions can correctly yield no matches.
- Browser checks at desktop and 390 × 844: home, Beit Shemesh two-choice results, itinerary map, browse search/list/map, preference cancellation and application, guest save/reopen, share link copy confirmation, profile sign-in sheet without submitting credentials, Escape dismissal, Hebrew profile/navigation, and place detail navigation.
- The existing build size advisory remains; no build error. Menu/dietary coverage remains limited to sourced records (six venues), and the UI does not claim otherwise.

No production account, contact, or authentication data was changed during browser checks.
