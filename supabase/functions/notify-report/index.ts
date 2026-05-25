// Receives a Supabase database webhook on problem_reports INSERT
// and forwards the report to a Telegram chat via the Bot API.
//
// Required env (set with `supabase secrets set ...`):
//   TELEGRAM_BOT_TOKEN  - from @BotFather
//   TELEGRAM_CHAT_ID    - your numeric chat id (get from @userinfobot)
//   WEBHOOK_SECRET      - shared secret; the DB webhook must send this in
//                         the `x-webhook-secret` header

const REPORT_TYPE_LABELS: Record<string, string> = {
  wrong_info: 'Wrong / outdated info',
  closed: 'Place is closed',
  not_kosher: 'Kashrus info incorrect',
  bug: 'App bug',
  suggestion: 'Feature suggestion',
  other: 'Other',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const expectedSecret = Deno.env.get('WEBHOOK_SECRET')
  if (!expectedSecret || req.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!botToken || !chatId) {
    return new Response('Telegram credentials not configured', { status: 500 })
  }

  let payload: { record?: Record<string, unknown>; type?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (payload.type !== 'INSERT' || !payload.record) {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const r = payload.record as {
    type?: string
    message?: string | null
    email?: string | null
    location_id?: string | null
    location_name?: string | null
    created_at?: string | null
  }

  const typeLabel = REPORT_TYPE_LABELS[r.type ?? ''] ?? r.type ?? 'Unknown'
  const lines = [
    `<b>🚨 New Hamakom report</b>`,
    `<b>Type:</b> ${escapeHtml(typeLabel)}`,
  ]
  if (r.location_name) lines.push(`<b>Location:</b> ${escapeHtml(r.location_name)}`)
  if (r.message) lines.push(`<b>Message:</b> ${escapeHtml(r.message)}`)
  if (r.email) lines.push(`<b>From:</b> ${escapeHtml(r.email)}`)
  if (r.created_at) lines.push(`<i>${escapeHtml(r.created_at)}</i>`)

  const text = lines.join('\n')

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!tgRes.ok) {
    const errBody = await tgRes.text()
    return new Response(
      JSON.stringify({ error: 'Telegram API failed', detail: errBody }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
