import { useState } from 'react'
import { CATEGORY_EMOJI, getCategoryColor } from '../lib/constants'

export default function Card({ loc, lang, tx, saved, onToggleSave, onClick, showSave = true }) {
  const [hovered, setHovered] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const isHe = lang === 'he'
  const name = isHe ? loc.name_he || loc.name : loc.name
  const city = isHe ? loc.city_he || loc.city : loc.city
  const color = getCategoryColor(loc.category)
  const showImg = loc.image_url && !imgFailed
  const priceLabel = tx.priceLabels[loc.price]?.split(' ')[0] || ''

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#161B27',
        border: `1px solid ${hovered ? '#3A4055' : '#2A2F3E'}`,
        borderRadius: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
        boxShadow: hovered ? '0 6px 18px rgba(0,0,0,0.35)' : 'none',
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          background: showImg ? '#0B0F17' : `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {showImg ? (
          <img
            src={loc.image_url}
            alt={name}
            onError={() => setImgFailed(true)}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 36 }}>{CATEGORY_EMOJI[loc.category]}</span>
        )}

        {loc.featured ? (
          <div
            style={{
              position: 'absolute',
              top: 8,
              [isHe ? 'right' : 'left']: 8,
              background: 'rgba(201,168,76,0.92)',
              color: '#0D1117',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            {isHe ? 'מומלץ' : 'Featured'}
          </div>
        ) : null}

        {showSave ? (
          <button
            onClick={(event) => {
              event.stopPropagation()
              onToggleSave?.()
            }}
            aria-label={saved ? 'Remove from saved' : 'Save this place'}
            style={{
              position: 'absolute',
              top: 6,
              [isHe ? 'left' : 'right']: 6,
              background: 'rgba(13,17,23,0.55)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              border: 'none',
              borderRadius: 999,
              padding: '4px 9px',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              color: saved ? '#C9A84C' : '#E8DCC8',
            }}
          >
            {saved ? '♥' : '♡'}
          </button>
        ) : null}
      </div>

      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#E8DCC8',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span aria-hidden>{CATEGORY_EMOJI[loc.category]}</span>
          <span style={{ color: '#C9A84C' }}>{city}</span>
          {priceLabel ? (
            <>
              <span style={{ color: '#4B5563' }}>·</span>
              <span style={{ color: '#B8A990', fontWeight: 600, letterSpacing: '0.04em' }}>{priceLabel}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
