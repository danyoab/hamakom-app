# Locations enrichment pipeline

## What it does
`scripts/enrich-locations.mjs` calls Google Places API (New) for each row in `locations`, pulling:

| Field | Source | Purpose |
|---|---|---|
| `google_place_id`, `business_status` | Places API | Stable anchor; flags permanent closures |
| `formatted_address`, `lat`, `lng` | Places API | Address + map pins |
| `opening_hours`, `phone`, `website` | Places API | Contact + scheduling |
| `google_rating`, `google_price_level` | Places API | Recommendation signal |
| `photo_refs[]`, `image_attribution` | Places API | Hero images (resolved via Places media endpoint at render time) |
| `confidence_score`, `verification_status`, `missing_fields` | Derived | Trust/decision-engine inputs |
| `last_enriched_at`, `enrichment_source` | Set by script | Re-run logic |

Curated/decision-engine fields (`vibe_tags`, `romantic_score`, `conversation_score`, etc.) are NOT populated by the API — they're admin-curated.

## Running

```bash
# one-time setup
echo "GOOGLE_PLACES_KEY=..." >> .env
echo "SUPABASE_SERVICE_KEY=..." >> .env

npm run enrich:dry        # safe preview, 5 rows
npm run enrich            # full run

# common flags
node --env-file=.env scripts/enrich-locations.mjs --city='Tel Aviv'
node --env-file=.env scripts/enrich-locations.mjs --ids=217,218,219
node --env-file=.env scripts/enrich-locations.mjs --stale-days=14   # re-enrich rows older than 14d
node --env-file=.env scripts/enrich-locations.mjs --force            # ignore freshness
node --env-file=.env scripts/enrich-locations.mjs --reset-checkpoint # start clean
```

## Resilience guarantees

- **Checkpoint**: `logs/enrichment-checkpoint.json` persists `processed[]` after every row. Re-running resumes where it stopped — safe to Ctrl-C.
- **Retry**: 429 / 5xx responses are retried up to 3× with exponential backoff (500ms / 1s / 2s).
- **Run log**: every run inserts into `enrichment_runs` with totals. Per-row failures land in `enrichment_failures` with the reason.
- **Manual-edit preservation**: each row has a `manual_edits` jsonb of shape `{ "fields": ["description","price"] }`. The script reads this and **skips any listed field** when updating. Admin UI should `array_append` to this when a curator edits a field.

## Cost

Places API "Text Search" + FieldMask (id, businessStatus, location, photos, rating, etc.) ≈ $17–32/1000 calls. For all 317 rows you'll hit roughly $5–10 — well inside Google's $200/month free credit. Set a billing alert anyway.

## What to run after

1. **Re-image rows the API didn't find** — they land in `enrichment_failures` with `not_found_on_google`. Edit `maps_query` to be more specific (e.g. include street name) and re-run on those IDs only.
2. **Cache photos** — see [Photo caching pipeline](#photo-caching-pipeline) below.
3. **Score curation**: `vibe_tags`, `romantic_score`, etc. need human input. Build an admin batch-curate view that ingests one row at a time.

## Photo caching pipeline

`scripts/cache-photos.mjs` resolves `photo_refs[0]` → downloads the bytes server-side → uploads to the existing `location-images` Supabase Storage bucket → saves the public URL back into `image_url`. The Google API key never reaches the browser.

### What it touches

| Row state | Action |
|---|---|
| `image_url IS NULL/''` AND `photo_refs[0]` exists | **Cached** → `image_url` filled with Storage URL |
| `image_url` already set (admin upload or Wikimedia etc.) | **Skipped** — never overwritten |
| `manual_edits.fields` contains `'image_url'` | **Skipped** — curator lock honored |
| `business_status = 'CLOSED_PERMANENTLY'` | **Skipped** |
| `photo_refs` empty/null | **Skipped** |

Path scheme: admin uploads land at `location-images/{id}.{ext}` (root) — the cache script writes to `location-images/cached/{id}.{ext}` (sub-prefix). The two never collide and either path is a valid `image_url`.

### Running

```bash
# requires the same .env as enrich
npm run cache:photos:dry      # preview 5 rows
npm run cache:photos          # full pass

# flags
node --env-file=.env scripts/cache-photos.mjs --limit=20
node --env-file=.env scripts/cache-photos.mjs --ids=217,218,219
node --env-file=.env scripts/cache-photos.mjs --max-height=1200
node --env-file=.env scripts/cache-photos.mjs --reset-checkpoint
```

### Resilience

- **Checkpoint**: `logs/photo-cache-checkpoint.json` — successful rows only. Failures stay out so a plain re-run automatically retries them.
- **Retry**: 3× exponential backoff on 429/5xx for both the Places media call and the photo download.
- **Run log**: every run gets a row in `enrichment_runs` with `source='photo_cache'`. Per-row failures land in `enrichment_failures` with `reason` prefixed `photo_cache:`.
- **Attribution preserved**: `image_attribution` is set by the enrichment script and never overwritten by the cache script.
- **Confidence bumped**: each cached row gets +15 to `confidence_score` (capped at 100) and `'image_url'` is removed from `missing_fields`.

### Operating expectations

- Cost: Places media endpoint is ~$7/1000 calls. Caching all 102 empty rows ≈ $0.70.
- Bandwidth: storage upload at default `maxHeightPx=800` averages ~80-150 kb per photo.
- Storage growth: ~10-15 MB total for the current backlog.
- Re-running after admin uploads is safe — already-filled `image_url` rows are filtered out at the SQL layer.

## Audit queries

```sql
-- High-level health
select round(avg(confidence_score)) avg_conf,
       count(*) filter (where confidence_score >= 80) high,
       count(*) filter (where confidence_score < 60) low,
       count(*) filter (where business_status='CLOSED_PERMANENTLY') closed
from locations where status='approved';

-- Rows that need admin attention
select id, name, city, confidence_score, missing_fields
from locations
where status='approved' and confidence_score < 70
order by confidence_score asc;

-- Most recent run
select * from enrichment_runs order by id desc limit 1;

-- Failures from latest run
select l.name, l.city, ef.reason
from enrichment_failures ef
join locations l on l.id = ef.location_id
where ef.run_id = (select max(id) from enrichment_runs);
```
