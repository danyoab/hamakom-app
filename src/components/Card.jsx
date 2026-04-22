import { useState } from 'react'
import { CATEGORY_EMOJI, DATE_STAGE_BADGE, getCategoryColor } from '../lib/constants'

export default function Card({ loc, lang, tx, saved, onToggleSave, onClick, showSave = true }) {
  const [hovered, setHovered] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const name = lang === 'he' ? loc.name_he || loc.name : loc.name
  const city = lang === 'he' ? loc.city_he || loc.city : loc.city
  const desc = lang === 'he' ? loc.description_he || loc.description : loc.description
  const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
  const color = getCategoryColor(loc.category)
  const showImg = loc.image_url && !imgFailed

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#1A2035' : '#161B27',
        border: `1px solid ${hovered ? '#3A4055' : '#2A2F3E'}`,
        borderRadius: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        borderLeft: lang === 'en' ? `3px solid ${color}` : undefined,
        borderRight: lang === 'he' ? `3px solid ${color}` : undefined,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
        display: 'flex',
        alignItems: 'stretch',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 68,
          flexShrink: 0,
          background: showImg ? 'transparent' : `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {showImg ? (
          <img
            src={loc.image_url}
            alt={name}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          CATEGORY_EMOJI[loc.category]
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, padding: '11px 10px 11px 9px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#E8DCC8', lineHeight: 1.25, wordBreak: 'break-word' }}>{name}</div>
            <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 3, lineHeight: 1.2 }}>{city}</div>
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, maxWidth: '42%' }}>
            {stages.map((stage) => (
              <span
                key={stage}
                style={{
                  background: DATE_STAGE_BADGE[stage]?.bg,
                  color: DATE_STAGE_BADGE[stage]?.text,
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 999,
                  fontWeight: 600,
                }}
              >
                {tx.dateLabels[String(stage)]}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
          {loc.featured ? (
            <span style={{ background: '#3A2A0A', color: '#C9A84C', fontSize: 9, padding: '2px 6px', borderRadius: 999, fontWeight: 700 }}>
              Featured
            </span>
          ) : null}
        </div>

        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 5, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {CATEGORY_EMOJI[loc.category]} {tx.categories[loc.category] || loc.category} · {tx.priceLabels[loc.price]}
          {loc.kashrus ? <span style={{ marginInlineStart: 6, color: '#4ADE80', fontSize: 10 }}>✓ {loc.kashrus}</span> : null}
        </div>

        <div
          style={{
            fontSize: 12,
            color: '#9CA3AF',
            fontStyle: 'italic',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {desc}
        </div>
      </div>

      {showSave ? (
        <button
          onClick={(event) => {
            event.stopPropagation()
            onToggleSave?.()
          }}
          aria-label={saved ? 'Remove from saved' : 'Save this place'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            padding: '4px 8px',
            transition: 'transform 0.1s',
            alignSelf: 'center',
            transform: saved ? 'scale(1.15)' : 'scale(1)',
            flexShrink: 0,
          }}
        >
          {saved ? '♥' : '♡'}
        </button>
      ) : null}
    </div>
  )
}
