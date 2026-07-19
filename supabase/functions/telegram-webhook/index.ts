// Two-way relay for the @Hamakombot Telegram bot.
//
// Anyone who messages the bot (e.g. a Play Store closed-test tester) has
// their message forwarded to Daniel's chat. Daniel's own chat is never
// relayed back to itself, to avoid an echo loop.
//
// Required env (already set for notify-report; reused here):
//   TELEGRAM_BOT_TOKEN  - from @BotFather
//   TELEGRAM_CHAT_ID    - Daniel's numeric chat id
//   WEBHOOK_SECRET      - shared secret, also used as the Telegram
//                         `secret_token` so incoming POSTs can be verified
//
// One-time setup: GET this function's URL with ?setup=<WEBHOOK_SECRET> to
// register it with Telegram's setWebhook API. Safe to call more than once.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

Deno.serve(async (req) => {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (!botToken || !chatId || !webhookSecret) {
    return new Response('Telegram credentials not configured', { status: 500 })
  }

  const url = new URL(req.url)

  // One-time (idempotent) registration step, triggered by a plain GET.
  // Gated by its own key (TELEGRAM_SETUP_KEY) rather than WEBHOOK_SECRET,
  // since secrets are write-only and the caller triggering setup needs a
  // value it can actually know ahead of time.
  if (req.method === 'GET') {
    const setupKey = Deno.env.get('TELEGRAM_SETUP_KEY')
    if (!setupKey || url.searchParams.get('setup') !== setupKey) {
      return new Response('Unauthorized', { status: 401 })
    }
    const selfUrl = `${url.origin}${url.pathname}`
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: selfUrl, secret_token: webhookSecret }),
    })
    const body = await tgRes.json()
    return new Response(JSON.stringify(body), {
      status: tgRes.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let update: {
    message?: {
      chat?: { id?: number }
      from?: { first_name?: string; username?: string }
      text?: string
    }
  }
  try {
    update = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const message = update.message
  const senderChatId = message?.chat?.id
  if (!message || senderChatId === undefined) {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Don't relay Daniel's own chat back to himself.
  if (String(senderChatId) === chatId) {
    return new Response(JSON.stringify({ ok: true, self: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const who = message.from?.username
    ? `@${message.from.username}`
    : message.from?.first_name || 'A tester'
  const text = message.text || '[non-text message]'

  const relayText = [
    `💬 <b>Tester feedback</b> from ${escapeHtml(who)}`,
    escapeHtml(text),
  ].join('\n')

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: relayText, parse_mode: 'HTML' }),
  })

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: senderChatId,
      text: 'Thanks for testing HaMakom! Your feedback was passed along. 🙏',
    }),
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
