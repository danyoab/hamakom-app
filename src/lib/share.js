import { siteOrigin } from './seo'
import { planShareQuery } from './routes'
import { cityName } from './translations'

/** Share text + optional URL via Web Share API, falling back to WhatsApp. */
export async function shareContent({ title, text, url }) {
  const absoluteUrl = url?.startsWith('http') ? url : url ? `${siteOrigin()}${url}` : null
  const message = absoluteUrl ? `${text}\n${absoluteUrl}` : text
  try {
    if (navigator.share) {
      await navigator.share({
        title: title || 'HaMakom',
        text: message,
        ...(absoluteUrl ? { url: absoluteUrl } : {}),
      })
      return true
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  return true
}

export function sharePlanMessage(plan, lang, answers = null) {
  const isHe = lang === 'he'
  const stopNames = (plan.stops || []).slice(0, 3)
    .map((s) => (isHe ? s.name_he : s.name_en)).filter(Boolean)
  const city = cityName(plan.city, lang)
  const stopsLine = stopNames.join(isHe ? ' ← ' : ' → ') || city
  const title = isHe ? plan.title_he : plan.title_en
  const duration = isHe ? plan.duration_text_he : plan.duration_text_en
  const where = [city, duration].filter(Boolean).join(' · ')
  const text = isHe
    ? `✨ תוכנית ערב מ-HaMakom:\n\n🌟 ${title}\n📍 ${where}\n\n${stopsLine}\n\n💛 תכננו את שלכם ב-hamakom.app`
    : `✨ Date night from HaMakom:\n\n🌟 ${title}\n📍 ${where}\n\n${stopsLine}\n\n💛 Plan yours at hamakom.app`
  // Link straight to THIS plan when we have the answers that built it —
  // a recipient who lands on the homepage instead never sees the plan.
  const query = planShareQuery(answers)
  return { title, text, url: query ? `/plan?${query}` : '/' }
}

export function shareLocationMessage(loc, lang) {
  const isHe = lang === 'he'
  const name = isHe ? loc.name_he || loc.name : loc.name
  const city = isHe ? loc.city_he || loc.city : loc.city
  const slug = loc.slug || loc.id
  const text = isHe
    ? `📍 ${name} · ${city}\nמקום לדייט מ-HaMakom`
    : `📍 ${name} · ${city}\nA HaMakom date spot`
  return { title: name, text, url: `/location/${encodeURIComponent(slug)}` }
}
