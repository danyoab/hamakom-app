import { useState } from 'react'
import { CATEGORY_EMOJI, DATE_STAGE_BADGE, getCategoryColor, getMapsUrl, getWhatsAppUrl, getInviteUrl } from '../lib/constants'

export default function DetailView({ loc, lang, tx, font, saved, onToggleSave, onBack }) {
  const [imgFailed, setImgFailed] = useState(false)
  const name   = lang === 'he' ? (loc.name_he  || loc.name)  : loc.name
  const city   = lang === 'he' ? (loc.city_he  || loc.city)  : loc.city
  const desc   = lang === 'he' ? (loc.description_he || loc.description) : loc.description
  const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
  const color  = getCategoryColor(loc.category)
  const mapsUrl   = getMapsUrl(loc.maps_query)
  const waUrl     = getWhatsAppUrl(name, city, lang)
  const inviteUrl = getInviteUrl(name, city, lang)
  const showImg   = loc.image_url && !imgFailed

  return (
    <div dir={tx.dir} style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font }}>

      {/* ── Hero image ─── */}
      <div style={{ position: 'relative', height: 220, background: showImg ? '#000' : `${color}22`, overflow: 'hidden' }}>
        {showImg
          ? <img
              src={loc.image_url}
              alt={name}
              onError={() => setImgFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
            />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, opacity: 0.3 }}>
              {CATEGORY_EMOJI[loc.category]}
            </div>
        }
        {/* Gradient overlay so text on top is readable */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,17,23,0.55) 0%, rgba(13,17,23,0.1) 40%, rgba(13,17,23,0.8) 100%)' }} />
        {/* Back button floated over image */}
        <button
          onClick={onBack}
          style={{
            position: 'absolute', top: 14, [lang === 'he' ? 'right' : 'left']: 16,
            background: 'rgba(13,17,23,0.65)', border: '1px solid #2A2F3E',
            borderRadius: 8, color: '#C9A84C', cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit', padding: '6px 12px',
            backdropFilter: 'blur(4px)',
          }}
        >
          {tx.back}
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>
        {/* Category */}
        <div style={{ marginBottom: 6, fontSize: 11, color: getCategoryColor(loc.category), letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {CATEGORY_EMOJI[loc.category]} {tx.categories[loc.category]}
        </div>

        {/* Name + heart */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ fontSize: 30, fontWeight: 400, margin: 0, lineHeight: 1.1 }}>{name}</h2>
          <button
            onClick={onToggleSave}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, padding: 4, flexShrink: 0 }}
          >
            {saved ? '❤️' : '🤍'}
          </button>
        </div>
        <div style={{ fontSize: 15, color: '#C9A84C', marginTop: 4, fontStyle: 'italic' }}>{city}</div>

        {/* Kashrus */}
        {loc.kashrus && (
          <div style={{ marginTop: 8, display: 'inline-block', background: '#1A3A2A', border: '1px solid #2D6A4F', borderRadius: 6, padding: '4px 12px' }}>
            <span style={{ fontSize: 12, color: '#4ADE80' }}>✓ {loc.kashrus}</span>
          </div>
        )}

        {/* Date stage badges */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {stages.map(s => (
            <div
              key={s}
              style={{ background: DATE_STAGE_BADGE[s]?.bg, border: `1px solid ${DATE_STAGE_BADGE[s]?.text}`, borderRadius: 8, padding: '5px 12px' }}
            >
              <div style={{ fontSize: 12, color: DATE_STAGE_BADGE[s]?.text, fontWeight: 600 }}>{tx.dateLabels[String(s)]}</div>
              <div style={{ fontSize: 10, color: DATE_STAGE_BADGE[s]?.text, opacity: 0.75 }}>{tx.dateDesc[String(s)]}</div>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: '#2A2F3E', margin: '20px 0' }} />

        {/* Description */}
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#D1C4A8', fontStyle: 'italic' }}>{desc}</p>

        {/* Info boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
          <InfoBox label={tx.priceRange} value={tx.priceLabels[loc.price]} />
          <InfoBox label={tx.location}   value={city} />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10,
                padding: '13px 16px', textDecoration: 'none', color: '#C9A84C',
                fontSize: 14, fontFamily: font,
              }}
            >
              <span>📍 {name}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{tx.openMaps}</span>
            </a>
          )}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#0d2618', border: '1px solid #1a4d2e', borderRadius: 10,
              padding: '13px 16px', textDecoration: 'none', color: '#4ADE80',
              fontSize: 14, fontFamily: font,
            }}
          >
            <span>💬 {tx.whatsapp}</span>
            <span style={{ fontSize: 18 }}>→</span>
          </a>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#1A0D26', border: '1px solid #4A1D6E', borderRadius: 10,
              padding: '13px 16px', textDecoration: 'none', color: '#C084FC',
              fontSize: 14, fontFamily: font,
            }}
          >
            <span>💌 {tx.inviteToDate}</span>
            <span style={{ fontSize: 18 }}>→</span>
          </a>
        </div>

        {/* Occasion tags */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>
            {tx.goodFor}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {loc.occasion?.map(tag => (
              <span
                key={tag}
                style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#9CA3AF' }}
              >
                {tx.occasions[tag] || tag}
              </span>
            ))}
          </div>
        </div>

        {/* Kashrus note */}
        <div style={{ marginTop: 24, background: '#161B27', borderRadius: 10, padding: 18, border: '1px solid #2A2F3E' }}>
          <div style={{ fontSize: 11, color: '#C9A84C', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
            {tx.importantNote}
          </div>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>{tx.kashrusNote}</p>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ label, value }) {
  return (
    <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 8, padding: '11px 14px' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.15em', color: '#6B7280', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#E8DCC8' }}>{value}</div>
    </div>
  )
}
