import { useState } from 'react'
import { CATEGORY_EMOJI, DATE_STAGE_BADGE, getCategoryColor } from '../lib/constants'

export default function Card({ loc, lang, tx, saved, onToggleSave, onClick }) {
  const [hovered, setHovered]   = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const name   = lang === 'he' ? (loc.name_he  || loc.name)  : loc.name
  const city   = lang === 'he' ? (loc.city_he  || loc.city)  : loc.city
  const desc   = lang === 'he' ? (loc.description_he || loc.description) : loc.description
  const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
  const color  = getCategoryColor(loc.category)
  const showImg = loc.image_url && !imgFailed

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#1A2035' : '#161B27',
        border: `1px solid ${hovered ? '#3A4055' : '#2A2F3E'}`,
        borderRadius: 10,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        borderLeft:  lang === 'en' ? `3px solid ${color}` : undefined,
        borderRight: lang === 'he' ? `3px solid ${color}` : undefined,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 80, flexShrink: 0,
        background: showImg ? 'transparent' : `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, position: 'relative', overflow: 'hidden',
      }}>
        {showImg
          ? <img
              src={loc.image_url}
              alt={name}
              onError={() => setImgFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          : CATEGORY_EMOJI[loc.category]
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, padding: '13px 12px 13px 10px' }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#E8DCC8' }}>{name}</span>
          <span style={{ fontSize: 11, color: '#C9A84C' }}>{city}</span>
          {loc.featured && (
            <span style={{ background: '#3A2A0A', color: '#C9A84C', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
              ★ Featured
            </span>
          )}
          {/* Date stage badges */}
          <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
            {stages.map(s => (
              <span
                key={s}
                style={{
                  background: DATE_STAGE_BADGE[s]?.bg,
                  color: DATE_STAGE_BADGE[s]?.text,
                  fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                }}
              >
                {tx.dateLabels[String(s)]}
              </span>
            ))}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
          {CATEGORY_EMOJI[loc.category]} {tx.categories[loc.category] || loc.category} · {tx.priceLabels[loc.price]}
          {loc.kashrus && <span style={{ marginLeft: 6, color: '#4ADE80', fontSize: 10 }}>✓ {loc.kashrus}</span>}
        </div>

        {/* Description */}
        <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>{desc}</div>
      </div>

      {/* Heart */}
      <button
        onClick={e => { e.stopPropagation(); onToggleSave() }}
        aria-label={saved ? 'Remove from saved' : 'Save this place'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, padding: '4px 8px',
          transition: 'transform 0.1s', alignSelf: 'center',
          transform: saved ? 'scale(1.15)' : 'scale(1)',
          flexShrink: 0,
        }}
      >
        {saved ? '❤️' : '🤍'}
      </button>
    </div>
  )
}
