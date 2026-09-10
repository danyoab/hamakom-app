# New York release — 10 September 2026

New York is a selectable region inside HaMakom, with a direct entry at `/new-york`. The two-choice planning flow remains intact; dietary, dining type, menu, time and travel preferences are optional. Region switching resets browse filters and keeps saved places and plans accessible across regions.

## Launch catalog

- 69 sourced places across Manhattan, Brooklyn, Queens, Five Towns, Long Island, Bronx and Westchester.
- 38 places have recorded kosher authority evidence; 19 have menu links. Dietary claims are sourced at the branch level, including gluten-free options in Manhattan, Queens and Five Towns.
- 64 places have coordinates. The other five use area maps and address-based directions rather than invented venue pins or multi-stop travel estimates.
- All 124 supplied ideas are retained in `NY_RESEARCH_LEDGER.json`: 61 match published entries; the remainder are withheld pending sufficient branch, operating, seasonal or certification evidence. Withholding does not mean a venue is closed or non-kosher.
- The production database received the 69 New York rows. Existing Israel records were preserved. The committed sync script inserts missing rows only.

Primary evidence is linked on individual records: venue websites, the Vaad Harabonim of Queens, Vaad Hakashrus of the Five Towns and Rockaway, and current OK certificates. Certificate expiry is evaluated against the venue's local date and a selected future visit. Unconfirmed restaurants and lounges are visibly labelled and excluded by the New York quiz's default verified-kosher preference. Activity inclusion does not certify food sold on site.

## Planning and presentation

Plans cannot cross regions or combine meat and dairy stops. Cooking classes participate in food restrictions. US plans use dollars, New York time, miles on route summaries and US map fallbacks. Unknown prices remain unknown. Route lines show straight-line distance; navigation links provide actual directions.

The interface adds a compact region picker, original New York skyline artwork, quieter text-first venue cards, practical stop descriptions, and source/menu details. Both regions use the same responsive design. Saved and shared plans retain the appropriate region.

## Validation

- Production build and ESLint passed; all 39 automated tests passed.
- Live system audit exercised 4,050 scenarios and checked 3,444 returned plans, with no invalid plans or duplicate IDs. Strict combinations can correctly return no matches when evidence is unavailable.
- Production preview checked on desktop and at a 390 px mobile viewport: New York home and results, map rendering, Queens gluten-free filtering to Marani, menu and certification links, region switching, and Beit Shemesh results with a two-stop map. No horizontal overflow was observed in the checked mobile detail screen.

## Scope limits

This is a curated launch, not a claim that every supplied venue has been fully verified. Exact prices, all opening hours, and dietary evidence for every restaurant are not yet available. Booking requirements and seasonal availability are stated where sourced; guests should confirm current availability with venues. Gluten-free options do not imply a coeliac-safe kitchen.

The development hot-reload session reported a React Refresh runtime error in this browser environment; the production build and preview were used for release verification.
