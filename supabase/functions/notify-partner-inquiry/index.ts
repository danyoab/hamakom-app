import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  if (!req.headers.get('Authorization')?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { inquiryId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!body.inquiryId || !/^[0-9a-f-]{36}$/i.test(body.inquiryId)) {
    return new Response(JSON.stringify({ error: 'Invalid inquiry id' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!botToken || !chatId || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Notification service is not configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: inquiry, error } = await admin
    .from('partner_inquiries')
    .select('id,business_name,contact_name,phone,email,city,message,location_id,inquiry_type,source,utm_source,utm_medium,utm_campaign,created_at,notified_at')
    .eq('id', body.inquiryId)
    .maybeSingle()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!inquiry) {
    return new Response(JSON.stringify({ error: 'Inquiry not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (inquiry.notified_at) {
    return new Response(JSON.stringify({ ok: true, alreadyNotified: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const lines = [
    `<b>🤝 New HaMakom ${inquiry.inquiry_type === 'claim' ? 'listing claim' : 'partner lead'}</b>`,
    `<b>Business:</b> ${escapeHtml(inquiry.business_name)}`,
  ]
  if (inquiry.city) lines.push(`<b>City:</b> ${escapeHtml(inquiry.city)}`)
  if (inquiry.contact_name) lines.push(`<b>Contact:</b> ${escapeHtml(inquiry.contact_name)}`)
  if (inquiry.phone) lines.push(`<b>Phone:</b> ${escapeHtml(inquiry.phone)}`)
  if (inquiry.email) lines.push(`<b>Email:</b> ${escapeHtml(inquiry.email)}`)
  if (inquiry.location_id) lines.push(`<b>Location ID:</b> ${escapeHtml(inquiry.location_id)}`)
  if (inquiry.source) lines.push(`<b>Source:</b> ${escapeHtml(inquiry.source)}`)
  if (inquiry.utm_source || inquiry.utm_campaign) {
    lines.push(`<b>Campaign:</b> ${escapeHtml([inquiry.utm_source, inquiry.utm_medium, inquiry.utm_campaign].filter(Boolean).join(' / '))}`)
  }
  if (inquiry.message) lines.push(`<b>Message:</b> ${escapeHtml(inquiry.message)}`)

  const telegram = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!telegram.ok) {
    return new Response(JSON.stringify({ error: 'Telegram API failed', detail: await telegram.text() }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await admin.from('partner_inquiries').update({ notified_at: new Date().toISOString() }).eq('id', inquiry.id)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

