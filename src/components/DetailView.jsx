import { useState } from 'react'
import { CATEGORY_EMOJI, DATE_STAGE_BADGE, getCategoryColor, getInviteUrl, getMapsUrl, getWhatsAppUrl } from '../lib/constants'
import FeedbackModal from './FeedbackModal'
import FeedbackStrip from './FeedbackStrip'

export default function DetailView({ loc, lang, tx, font, saved, onToggleSave, onBack, showSave = true, dateFeedback, setDateFeedback, onMapOpen, onReserve }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const name = lang === 'he' ? loc.name_he || loc.name : loc.name
  const city = lang === 'he' ? loc.city_he || loc.city : loc.city
  const desc = lang === 'he' ? loc.description_he || loc.description : loc.description
  const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
  const color = getCategoryColor(loc.category)
  const mapsUrl = getMapsUrl(loc.maps_query)
  const waUrl = getWhatsAppUrl(name, city, lang)
  const inviteUrl = getInviteUrl(name, city, lang)
  const showImg = loc.image_url && !imgFailed

  return (
    <div dir={tx.dir} style={{ minHeight: '100vh', background: '#F7F2E8', color: '#241E16', fontFamily: font }}>
      <div style={{ position: 'relative', height: 220, background: showImg ? '#000' : `${color}22`, overflow: 'hidden' }}>
        {showImg ? (
          <img src={loc.image_url} alt={name} onError={() => setImgFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, opacity: 0.3 }}>
            {CATEGORY_EMOJI[loc.category]}
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,17,23,0.55) 0%, rgba(13,17,23,0.1) 40%, rgba(13,17,23,0.8) 100%)' }} />
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 14,
            [lang === 'he' ? 'right' : 'left']: 16,
            background: 'rgba(13,17,23,0.55)',
            border: '1px solid rgba(255,253,247,0.5)',
            borderRadius: 8,
            color: '#F4ECD8',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '6px 12px',
            backdropFilter: 'blur(4px)',
          }}
        >
          {tx.back}
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 6, fontSize: 11, color, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {CATEGORY_EMOJI[loc.category]} {tx.categories[loc.category]}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ fontFamily: "'Spectral','Frank Ruhl Libre',Georgia,serif", fontSize: 30, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>{name}</h2>
          {showSave ? (
            <button onClick={onToggleSave} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, padding: 4, flexShrink: 0 }}>
              {saved ? '♥' : '♡'}
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: 15, color: '#9A7A28', marginTop: 4, fontStyle: 'italic' }}>{city}</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {loc.is_partner ? (
            <div style={{ marginTop: 8, display: 'inline-block', background: '#F6EEDA', border: '1px solid #D8C49A', borderRadius: 999, padding: '4px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9A7A28' }}>{tx.partnerBadge}</span>
            </div>
          ) : null}
          {loc.kashrus ? (
            /not certified/i.test(loc.kashrus) ? (
              <div style={{ marginTop: 8, display: 'inline-block', background: '#F2EBDB', border: '1px solid #E6DCC8', borderRadius: 999, padding: '4px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7F6C' }}>{lang === 'he' ? 'ללא תעודת כשרות' : 'Not certified'}</span>
              </div>
            ) : (
              <div style={{ marginTop: 8, display: 'inline-block', background: '#E9F0E4', border: '1px solid #C7DCBC', borderRadius: 999, padding: '4px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4F7144' }}>✓ {loc.kashrus}</span>
              </div>
            )
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {stages.map((stage) => (
            <div key={stage} style={{ background: DATE_STAGE_BADGE[stage]?.bg, border: `1px solid ${DATE_STAGE_BADGE[stage]?.text}`, borderRadius: 8, padding: '5px 12px' }}>
              <div style={{ fontSize: 12, color: DATE_STAGE_BADGE[stage]?.text, fontWeight: 600 }}>{tx.dateLabels[String(stage)]}</div>
              <div style={{ fontSize: 10, color: DATE_STAGE_BADGE[stage]?.text, opacity: 0.75 }}>{tx.dateDesc[String(stage)]}</div>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: '#EBE2D0', margin: '20px 0' }} />

        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#6E6450', fontStyle: 'italic' }}>{desc}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
          <InfoBox label={tx.priceRange} value={tx.priceLabels[loc.price]} />
          <InfoBox label={tx.location} value={city} />
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {loc.is_partner && loc.reservation_url ? (
            <a
              href={loc.reservation_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onReserve?.(loc)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#9A7A28',
                border: '1px solid #9A7A28',
                borderRadius: 10,
                padding: '13px 16px',
                textDecoration: 'none',
                color: '#F7F2E8',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: font,
              }}
            >
              <span>🗓 {tx.reserveButton}</span>
              <span style={{ fontSize: 18 }}>→</span>
            </a>
          ) : null}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onMapOpen?.(loc)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FFFFFF',
                border: '1px solid #EBE2D0',
                borderRadius: 10,
                padding: '13px 16px',
                textDecoration: 'none',
                color: '#9A7A28',
                fontSize: 14,
                fontFamily: font,
              }}
            >
              <span>📍 {name}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{tx.openMaps}</span>
            </a>
          ) : null}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#E9F0E4',
              border: '1px solid #C7DCBC',
              borderRadius: 10,
              padding: '13px 16px',
              textDecoration: 'none',
              color: '#2F6B3F',
              fontSize: 14,
              fontFamily: font,
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F3EDFA',
              border: '1px solid #E0D0F0',
              borderRadius: 10,
              padding: '13px 16px',
              textDecoration: 'none',
              color: '#7A4F9A',
              fontSize: 14,
              fontFamily: font,
            }}
          >
            <span>💌 {tx.inviteToDate}</span>
            <span style={{ fontSize: 18 }}>→</span>
          </a>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#A99A85', marginBottom: 8, textTransform: 'uppercase' }}>{tx.goodFor}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {loc.occasion?.map((tag) => (
              <span key={tag} style={{ background: '#F2EBDB', border: '1px solid #E6DCC8', borderRadius: 16, padding: '4px 12px', fontSize: 12, color: '#8A7F6C' }}>
                {tx.occasions[tag] || tag}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, background: '#FFFFFF', borderRadius: 10, padding: 18, border: '1px solid #EBE2D0' }}>
          <div style={{ fontSize: 11, color: '#9A7A28', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>{tx.importantNote}</div>
          <p style={{ fontSize: 13, color: '#8A7F6C', margin: 0, lineHeight: 1.6 }}>{tx.kashrusNote}</p>
        </div>

        {setDateFeedback ? (
          <FeedbackStrip lang={lang} font={font} loc={loc} dateFeedback={dateFeedback} setDateFeedback={setDateFeedback} />
        ) : null}

        <button
          onClick={() => setShowReport(true)}
          style={{ background: 'none', border: 'none', color: '#B0A48E', cursor: 'pointer', fontSize: 12, fontFamily: font, marginTop: 24, padding: '4px 0', textDecoration: 'underline', textDecorationColor: 'rgba(75,85,99,0.4)', textUnderlineOffset: 3 }}
        >
          {lang === 'he' ? 'דווח על בעיה במקום זה' : 'Report a problem with this place'}
        </button>
      </div>

      {showReport ? (
        <FeedbackModal
          lang={lang}
          font={font}
          locationName={name}
          locationId={loc.id}
          onClose={() => setShowReport(false)}
        />
      ) : null}
    </div>
  )
}

function InfoBox({ label, value }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 8, padding: '11px 14px' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.15em', color: '#A99A85', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#241E16' }}>{value}</div>
    </div>
  )
}
