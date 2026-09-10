# Venue photos and loading improvements

## Photos

Reviewed official website image candidates for the 69 New York listings. Added 42 selected venue, food and activity photographs, with source links in place details and full provenance in `NY_PHOTO_SOURCES.json`. Logos, unrelated locations, unusable images and uncertain candidates were omitted. The remaining 27 listings retain their category placeholder. Photos are presentation assets, not evidence of current food offerings or certification.

Selected originals totaled 21,995,166 bytes. All shipped WebP variants together total 4,527,198 bytes; the selected mobile variants average 30,248 bytes. Each image has responsive widths up to 1200 px, without upscaling. Cards and itinerary stops load lazily; details prioritize their hero photo. Images are served from the app's own origin with content-hashed URLs, immutable HTTP caching, and a bounded runtime cache. The entire photo collection is deliberately excluded from service-worker precaching.

Existing owner-uploaded photos take precedence. Missing or failed photos fall back without a broken-image icon. Source-linked credits appear in venue details.

## Loading

- Removed the blocking Google Fonts stylesheet; the interface uses its existing system-font stack.
- Deferred the 774 KB offline catalog JavaScript until after app initialization. Returning visitors with a valid catalog cache do not import it through the catalog hook.
- Moved error reporting to a deferred, tree-shaken module.
- Corrected chunk grouping that pulled Leaflet into the initial page. Map code is now loaded when a map surface opens.
- Deferred service-worker registration until page load, reducing competition from offline precaching.
- Reduced the catalog refresh timeout from 12 to 6 seconds. Cached or fallback content remains available, and successful backend responses (including empty results) stay authoritative.
- Enabled offscreen card rendering containment and asynchronous photo decoding.

These are verified dependency and payload improvements, not a claim of a measured end-to-end speed multiplier. First-load time still depends on the network, device, database and map tile service.

## Validation

ESLint, all 41 automated tests and the production build passed. Tests check shipped photo variants, byte limits, real catalog IDs, source links, owner-image precedence and unsafe URL handling. Production preview verified desktop photos, responsive image selection, a shared single-place plan with its map and photo, source credits and a 390 px phone layout without horizontal overflow. A separate build with Supabase disabled loaded all 69 New York places and their local photos from the fallback catalog. No browser errors were observed in that preview's shared-plan check.
