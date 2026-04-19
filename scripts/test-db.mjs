import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZW5icGtneG5qcmtuZWJiaXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDU3NzIsImV4cCI6MjA5MjE4MTc3Mn0.qm-_69lIl9YN8-Ecrpj0Vd3LaxFbnCklNodcT2kJwCY'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

const anon    = createClient(SUPABASE_URL, ANON_KEY,    { auth: { persistSession: false } })
const service = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null

let passed = 0, failed = 0
function ok(label)  { console.log(`  ✓ ${label}`); passed++ }
function fail(label, err) { console.error(`  ✗ ${label}:`, err?.message || err); failed++ }

// ── 1. Read approved locations (anon) ────────────────────────────────────────
console.log('\n1. Read locations (anon key)')
{
  const { data, error } = await anon
    .from('locations')
    .select('id, name, city, status')
    .eq('status', 'approved')
    .limit(5)
  if (error) fail('select approved', error)
  else if (!data.length) fail('select approved', 'returned 0 rows')
  else ok(`fetched ${data.length} approved locations (first: ${data[0].name})`)
}

// ── 2. Anon cannot read non-approved rows (RLS check) ────────────────────────
console.log('\n2. RLS — anon cannot see non-approved rows')
{
  const { data, error } = await anon
    .from('locations')
    .select('id')
    .eq('status', 'pending')
  if (error) fail('rls check', error)
  else if (data.length > 0) fail('rls check', `saw ${data.length} non-approved rows (RLS not working)`)
  else ok('confirmed 0 non-approved rows visible to anon')
}

// ── 3. Submit a suggestion (anon) ────────────────────────────────────────────
console.log('\n3. Submit a suggestion (anon key)')
let testSubId = null
{
  const { data, error } = await anon
    .from('pending_submissions')
    .insert([{
      name: '_Test Café (delete me)',
      city: 'Tel Aviv',
      category: 'Cafés & Restaurants',
      why: 'Automated test submission',
      price: 2,
      date_stage: [1, 2],
    }])
    .select('id')
    .single()
  if (error) fail('insert submission', error)
  else { testSubId = data.id; ok(`inserted submission id=${testSubId}`) }
}

// ── 4. Admin reads pending (anon key — RLS allows it) ────────────────────────
console.log('\n4. Admin reads pending submissions')
{
  const { data, error } = await anon
    .from('pending_submissions')
    .select('id, name, status')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })
    .limit(5)
  if (error) fail('read pending', error)
  else ok(`saw ${data.length} pending submission(s)`)
}

// ── 5. Approve submission (anon key) ─────────────────────────────────────────
console.log('\n5. Approve submission → insert into locations')
let insertedLocId = null
if (testSubId) {
  const { data: sub } = await anon
    .from('pending_submissions')
    .select('*')
    .eq('id', testSubId)
    .single()

  if (sub) {
    const { data: loc, error: locErr } = await anon
      .from('locations')
      .insert([{
        name: sub.name,
        city: sub.city,
        category: sub.category,
        occasion: ['casual'],
        date_stage: sub.date_stage || [1, 2],
        price: sub.price || 2,
        kashrus: sub.kashrus || null,
        description: sub.why || null,
        status: 'approved',
      }])
      .select('id')
      .single()

    const { error: updErr } = await anon
      .from('pending_submissions')
      .update({ status: 'approved' })
      .eq('id', testSubId)

    if (locErr || updErr) fail('approve', locErr || updErr)
    else { insertedLocId = loc.id; ok(`approved → new location id=${insertedLocId}`) }
  } else {
    fail('approve', 'could not find test submission')
  }
}

// ── 6. Reject another submission ─────────────────────────────────────────────
console.log('\n6. Reject a submission')
{
  const { data: sub2, error: insErr } = await anon
    .from('pending_submissions')
    .insert([{ name: '_Test Reject (delete me)', city: 'Haifa', category: 'Parks & Outdoors', price: 1 }])
    .select('id')
    .single()

  if (insErr) fail('insert for reject test', insErr)
  else {
    const { error: rejErr } = await anon
      .from('pending_submissions')
      .update({ status: 'rejected' })
      .eq('id', sub2.id)
    if (rejErr) fail('reject', rejErr)
    else ok(`rejected submission id=${sub2.id}`)
  }
}

// ── 7. Cleanup test data ──────────────────────────────────────────────────────
console.log('\n7. Cleanup test rows')
if (service) {
  if (insertedLocId) {
    const { error } = await service.from('locations').delete().eq('id', insertedLocId)
    if (error) fail('delete test location', error)
    else ok(`deleted test location id=${insertedLocId}`)
  }
  const { error } = await service
    .from('pending_submissions')
    .delete()
    .like('name', '_Test%')
  if (error) fail('delete test submissions', error)
  else ok('deleted test submissions')
} else {
  console.log('  (skipped — no service key; delete _Test rows manually in Supabase)')
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────`)
console.log(`  ${passed} passed  |  ${failed} failed`)
if (failed > 0) process.exit(1)
