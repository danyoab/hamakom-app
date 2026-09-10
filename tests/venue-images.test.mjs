import test from 'node:test'
import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { VENUE_PHOTOS } from '../src/data/venuePhotos.js'
import { imageProps, venuePhoto } from '../src/lib/venueImages.js'
import { NEW_YORK_LOCATIONS } from '../src/data/newYorkLocations.js'

test('reviewed photos have real catalog IDs, source links and small shipped variants', () => {
  const ids = new Set(NEW_YORK_LOCATIONS.map(r => String(r.id)))
  for (const [id, photo] of Object.entries(VENUE_PHOTOS)) {
    assert.ok(ids.has(id))
    assert.match(photo.source, /^https:\/\//)
    assert.ok(photo.widths.length >= 1)
    for (const width of photo.widths) {
      assert.ok(width <= photo.width)
      const file = new URL(`../public${photo.base}-${width}.webp`, import.meta.url)
      const bytes = statSync(file).size
      assert.ok(bytes > 0 && bytes < 250000, `${id} ${width}: ${bytes} bytes`)
    }
    assert.ok(imageProps(photo).srcSet.includes('w'))
  }
})

test('owner photos take priority, missing photos are safe, and URLs cannot execute code', () => {
  const id = Number(Object.keys(VENUE_PHOTOS)[0])
  assert.equal(venuePhoto({ id, image_url: 'https://example.com/owner.webp' }).src, 'https://example.com/owner.webp')
  assert.equal(venuePhoto({ id, image_url: 'javascript:alert(1)' }), VENUE_PHOTOS[id])
  assert.equal(venuePhoto({ id: -1 }), null)
  assert.equal(venuePhoto(undefined), null)
  assert.deepEqual(imageProps(null), {})
  assert.equal(imageProps({ src: 'https://example.com/photo.jpg' }).srcSet, undefined)
})
