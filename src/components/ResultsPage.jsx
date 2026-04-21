import { useState } from 'react'
import { getMatchReasons } from '../lib/quiz'
import { CATEGORY_EMOJI, getCategoryColor, getMapsUrl } from '../lib/constants'

export default function ResultsPage({ lang, font, results, answers, personalityTags, onBrowseAll, onRetakeQuiz }) {
  const isHe = lang === 'he'
  const dir  = isHe ? 'rtl' : 'ltr'
  const tags = isHe ? personalityTags.he : personalityTags.en

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0D1117 0%, #131A10 100%)',
        borderBottom: '1px solid #2A2F3E',
        padding: '28px 24px 20px',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 8 }}>
            {isHe ? '🎉 התוצאות שלך' : '🎉 Your results'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#E8DCC8', margin: '0 0 6px', lineHeight: 1.2 }}>
            {isHe ? 'תוכנית הדייט המושלמת שלך' : 'Your perfect date plan'}
          </h1>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 14px' }}>
            {isHe
              ? `מצאנו ${results.length} מקומות שמתאימים בדיוק לסגנון שלך`
              : `We found ${results.length} spots matched exactly to your style`}
          </p>

          {/* Personality tag pills */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  background: '#1A2030', border: '1px solid #C9A84C', borderRadius: 20,
                  padding: '3px 10px', fontSize: 12, color: '#C9A84C',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Result cards ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 20px' }}>
        {results.map((loc, i) => (
          <ResultCard key={loc.id} loc={loc} rank={i + 1} lang={lang} isHe={isHe} answers={answers} />
        ))}

        {/* ── Bottom actions ──────────────────────────────────────────── */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onBrowseAll}
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E8B84B)',
              color: '#0D1117', border: 'none', borderRadius: 12,
              padding: '14px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isHe ? 'עיין בכל המקומות →' : 'Browse all places →'}
          </button>
          <button
            onClick={onRetakeQuiz}
            style={{
              background: 'none', border: '1.5px solid #2A2F3E', borderRadius: 12,
              padding: '13px', fontSize: 14, color: '#9CA3AF',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isHe ? '🔄 קח את הבוחן מחדש' : '🔄 Retake the quiz'}
          </button>
        </div>

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

function ResultCard({ loc, rank, lang, isHe, answers }) {
  const [copied,    setCopied]    = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const name = isHe ? (loc.name_he || loc.name) : loc.name
  const city = isHe ? (loc.city_he || loc.city) : loc.city
  const desc = isHe ? (loc.description_he || loc.description) : loc.description
  const reasons  = getMatchReasons(loc, answers, lang)
  const color    = getCategoryColor(loc.category)
  const showImg  = loc.image_url && !imgFailed

  const handleShare = async () => {
    const text = isHe
      ? `רעיון מושלם לדייט: ${name} ב${city} 💫\nhamakom.app`
      : `Perfect date idea: ${name} in ${city} 💫\nhamakom.app`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'HaMakom', text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }

  return (
    <div style={{
      background: '#161B27',
      border: `1px solid #2A2F3E`,
      borderRadius: 14,
      marginBottom: 12,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Image or colour band */}
      <div style={{ height: 160, background: showImg ? '#000' : `${color}22`, overflow: 'hidden', position: 'relative' }}>
        {showImg
          ? <img src={loc.image_url} alt={name} onError={() => setImgFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, opacity: 0.25 }}>
              {CATEGORY_EMOJI[loc.category]}
            </div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(22,27,39,0.95) 100%)' }} />
        {/* Rank badge */}
        <div style={{
          position: 'absolute', top: 10, [isHe ? 'left' : 'right']: 10,
          background: color, color: '#0D1117',
          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px',
        }}>
          #{rank}
        </div>
        {/* Name pinned to bottom of image */}
        <div style={{ position: 'absolute', bottom: 10, [isHe ? 'right' : 'left']: 14, paddingInlineEnd: 50 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#E8DCC8', lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#C9A84C', marginTop: 2 }}>{city}</div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
      {/* Name & city (shown only when no image) */}
      {!showImg && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{CATEGORY_EMOJI[loc.category] || '📍'}</span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#E8DCC8', lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#C9A84C', marginTop: 2 }}>{city}</div>
        </div>
      </div>}

      {/* Description */}
      {desc && (
        <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 10 }}>
          {desc.length > 120 ? desc.slice(0, 120) + '…' : desc}
        </div>
      )}

      {/* Why-it-matches pills */}
      {reasons.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {reasons.map((r, i) => (
            <span key={i} style={{
              background: '#0F1A12', border: `1px solid ${color}44`,
              borderRadius: 20, padding: '3px 10px',
              fontSize: 11, color: color, fontWeight: 500,
            }}>
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Kashrus badge */}
      {loc.kashrus && (
        <div style={{
          display: 'inline-block',
          background: '#0F1A12', border: '1px solid #4ADE8044',
          borderRadius: 6, padding: '2px 8px',
          fontSize: 11, color: '#4ADE80', marginBottom: 10,
        }}>
          ✡️ {loc.kashrus}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {loc.maps_query && (
          <a
            href={getMapsUrl(loc.maps_query)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, background: '#1F2937', border: '1px solid #374151',
              borderRadius: 8, padding: '9px 12px', textAlign: 'center',
              fontSize: 13, color: '#E8DCC8', textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            📍 {isHe ? 'מפות' : 'Maps'}
          </a>
        )}
        <button
          onClick={handleShare}
          style={{
            flex: 1, background: '#1F2937', border: '1px solid #374151',
            borderRadius: 8, padding: '9px 12px',
            fontSize: 13, color: copied ? '#4ADE80' : '#E8DCC8',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'color 0.2s',
          }}
        >
          {copied
            ? (isHe ? '✓ הועתק!' : '✓ Copied!')
            : (isHe ? '📤 שתף' : '📤 Share')}
        </button>
      </div>
      </div>{/* end card body */}
    </div>
  )
}
