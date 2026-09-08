// Live release verification. --exercise-auth creates two temporary test users,
// tests only their own saved records, and deletes them in finally. No emails.
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_KEY
if (!url || !anonKey) throw new Error('Missing Supabase configuration')
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } }
const publicClient = createClient(url, anonKey, options)
const checks = []
const testUsers = []
const check = (name, pass, details) => { checks.push({ name, pass: Boolean(pass), ...(details ? { details } : {}) }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${details ? `: ${details}` : ''}`) }
const requireOk = (result, action) => { if (result.error) throw new Error(`${action}: ${result.error.code || result.error.status || 'request failed'}`); return result.data }
let admin

try {
  const catalog = requireOk(await publicClient.from('public_location_catalog').select('venue').limit(1), 'public catalog')
  check('Anonymous public catalog', catalog.length > 0)
  const place = catalog[0]?.venue
  if (!place?.id) throw new Error('No published venue to verify')
  check('Public fields exclude internal data', !['notes_internal', 'partner_contact', 'manual_edits', 'created_by'].some(key => key in place))
  const base = await publicClient.from('locations').select('*').limit(1)
  check('Anonymous base table is protected', Boolean(base.error) || base.data.length === 0)
  const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey }, signal: AbortSignal.timeout(15000) })
  const settings = settingsResponse.ok ? await settingsResponse.json() : {}
  check('Auth service and Google provider', settingsResponse.ok && settings.external?.google === true)
  if (!process.argv.includes('--exercise-auth')) {
    check('Authenticated integration exercises', false, 'Run with --exercise-auth before release')
  } else {
    if (!serviceKey) throw new Error('Missing service credential for temporary test users')
    admin = createClient(url, serviceKey, options)
    const clients = []
    for (let i = 0; i < 2; i++) {
      const email = `hamakom-release-${randomUUID()}@example.com`
      const password = randomBytes(28).toString('base64url')
      const created = requireOk(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { release_test: true } }), 'create temporary user')
      testUsers.push(created.user.id)
      const client = createClient(url, anonKey, options)
      requireOk(await client.auth.signInWithPassword({ email, password }), 'temporary sign-in')
      clients.push({ client, email, password, id: created.user.id })
    }
    check('Authenticated sessions', clients.length === 2)
    const a = clients[0]
    const b = clients[1]
    for (const table of ['partner_inquiries', 'problem_reports', 'pending_submissions', 'user_feedback', 'user_preferences', 'user_quiz_results', 'user_subscriptions']) {
      for (const [role, client] of [['anonymous', publicClient], ['new account', b.client]]) {
        const result = await client.from(table).select('*').limit(1)
        check(`${table}: private from ${role}`, result.error?.code === '42501' || (!result.error && result.data.length === 0))
      }
    }
    const planId = `date-v2~${place.id}~walking~~`
    for (const [table, column, value] of [['saved_plans', 'plan_id', planId], ['saved_places', 'location_id', place.id]]) {
      requireOk(await a.client.from(table).upsert({ user_id: a.id, [column]: value }, { onConflict: `user_id,${column}` }), `${table} save`)
      const own = requireOk(await a.client.from(table).select(column).eq('user_id', a.id), `${table} own read`)
      check(`${table}: own record persisted`, own.some(r => String(r[column]) === String(value)))
      const other = requireOk(await b.client.from(table).select(column).eq('user_id', a.id), `${table} isolation read`)
      check(`${table}: other account cannot read`, other.length === 0)
      const anon = await publicClient.from(table).select(column).eq('user_id', a.id)
      check(`${table}: anonymous cannot read`, Boolean(anon.error) || anon.data.length === 0)
      const attempted = await b.client.from(table).insert({ user_id: a.id, [column]: value })
      check(`${table}: other account cannot write`, attempted.error?.code === '42501')
    }
    const device2 = createClient(url, anonKey, options)
    requireOk(await device2.auth.signInWithPassword({ email: a.email, password: a.password }), 'second-device sign-in')
    const restored = requireOk(await device2.from('saved_plans').select('plan_id').eq('user_id', a.id), 'second-device restore')
    check('Saved plan restores on another session', restored.some(r => r.plan_id === planId))
    const privateBase = await a.client.from('locations').select('*').limit(1)
    check('Ordinary account cannot read base location records', Boolean(privateBase.error) || privateBase.data.length === 0)
    const impressionId = randomUUID()
    const sessionId = randomUUID()
    requireOk(await a.client.from('recommendation_impressions').insert({ client_id: impressionId, session_id: sessionId, user_id: a.id, primary_plan_id: planId, quiz_answers: { release_test: true } }), 'test impression')
    const storedImpression = requireOk(await admin.from('recommendation_impressions').select('id').eq('client_id', impressionId).single(), 'impression ID')
    requireOk(await a.client.from('analytics_events').insert({ session_id: sessionId, user_id: a.id, event_name: 'release_test' }), 'test event')
    for (const table of ['analytics_events', 'recommendation_impressions', 'recommendation_outcomes', 'analytics_summary', 'plan_popularity', 'location_popularity']) {
      for (const [role, client] of [['anonymous', publicClient], ['ordinary account', b.client]]) {
        const result = await client.from(table).select('*').limit(1)
        check(`${table}: private from ${role}`, result.error?.code === '42501' || (!result.error && result.data.length === 0))
      }
    }
    const patch = (client, session, fields) => client.rpc('record_recommendation_outcome', { p_impression_id: impressionId, p_session_id: session, p_patch: fields })
    check('Outcome rejects another session', requireOk(await patch(a.client, randomUUID(), { saved: true }), 'outcome isolation') === false)
    check('Outcome rejects another account', requireOk(await patch(b.client, sessionId, { saved: true }), 'outcome account isolation') === false)
    check('Outcome accepts its owner', requireOk(await patch(a.client, sessionId, { saved: true }), 'outcome save') === true)
    requireOk(await patch(a.client, sessionId, { shared: true }), 'outcome partial update')
    const outcome = requireOk(await admin.from('recommendation_outcomes').select('saved,shared').eq('recommendation_impression_id', storedImpression.id).single(), 'outcome verification')
    check('Outcome partial updates preserve earlier fields', outcome.saved && outcome.shared)
    const invalid = await patch(a.client, sessionId, { rating: 99 })
    check('Outcome rejects invalid rating', Boolean(invalid.error))
    const removed = await a.client.functions.invoke('delete-account', { body: {} })
    check('Account deletion endpoint', !removed.error && removed.data?.success === true)
    const stillExists = await admin.auth.admin.getUserById(a.id)
    check('Deleted user no longer exists', (stillExists.error?.status === 404 || stillExists.error?.code === 'user_not_found') && !stillExists.data?.user)
    for (const table of ['saved_plans', 'saved_places', 'analytics_events', 'recommendation_impressions']) {
      const remaining = requireOk(await admin.from(table).select('id').eq('user_id', a.id), 'cascade check')
      check(`${table}: deletion cascades`, remaining.length === 0)
    }
    const deletedOutcome = requireOk(await admin.from('recommendation_outcomes').select('id').eq('recommendation_impression_id', storedImpression.id), 'outcome cascade')
    check('Recommendation outcome deletion cascades', deletedOutcome.length === 0)
  }
} catch (error) {
  check('Release verification completed', false, error.message)
} finally {
  if (admin) {
    for (const id of testUsers) {
      const existing = await admin.auth.admin.getUserById(id)
      if (existing.data?.user) {
        const result = await admin.auth.admin.deleteUser(id)
        check('Temporary user cleanup', !result.error)
      }
    }
  }
  const report = { checkedAt: new Date().toISOString(), project: new URL(url).hostname, checks, passed: checks.length > 0 && checks.every(c => c.pass) }
  mkdirSync('reports', { recursive: true })
  writeFileSync('reports/release-verification.json', `${JSON.stringify(report, null, 2)}\n`)
  if (!report.passed) process.exitCode = 1
}
