import { priceLevel } from '../lib/markets.js'
import { useEffect, useRef, useState } from 'react'
import { CATEGORY_EMOJI, getCategoryColor, getMapsUrl } from '../lib/constants'
import { shareContent, shareLocationMessage } from '../lib/share'
import Icon from './Icon.jsx'
import FeedbackModal from './FeedbackModal'
import FeedbackStrip from './FeedbackStrip'
import VenueFoodDetails from './VenueFoodDetails.jsx'
import { certificateExpired, hasVerifiedKashrut, isFoodVenue, safeExternalUrl } from '../lib/venuePreferences.js'

export default function DetailView({ loc, lang, tx, font, saved, onToggleSave, onBack, showSave = true, dateFeedback, setDateFeedback, onMapOpen, onReserve, onPhone, onShare, onClaim, onClaimViewed }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const name = lang === 'he' ? loc.name_he || loc.name : loc.name
  const city = lang === 'he' ? loc.city_he || loc.city : loc.city
  const desc = lang === 'he' ? loc.description_he || loc.description : loc.description
  const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
  const color = getCategoryColor(loc.category)
  const mapsUrl = getMapsUrl(loc.maps_query)
  const showImg = loc.image_url && !imgFailed
  const kashrut = getKashrutDisplay(loc, lang)
  const claimViewSent = useRef(false)
  const heading = useRef(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    heading.current?.focus({ preventScroll: true })
  }, [loc.id])

  useEffect(() => {
    if (claimViewSent.current) return
    claimViewSent.current = true
    onClaimViewed?.(loc)
  }, [loc, onClaimViewed])

  const handleShare = async () => {
    onShare?.(loc)
    await shareContent(shareLocationMessage(loc, lang))
  }

  return (
    <div className="ui-detail" dir={tx.dir} style={{ minHeight: '100vh', background: 'var(--ui-bg)', color: 'var(--ui-text)', fontFamily: font }}>
      <div className="ui-detail-photo" style={{ position: 'relative', height: 220, background: showImg ? '#000' : `${color}22`, overflow: 'hidden' }}>
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
            top: 'calc(14px + var(--hm-sat, 0px))',
            [lang === 'he' ? 'right' : 'left']: 16,
            background: 'rgba(13,17,23,0.55)',
            border: '1px solid rgba(255,253,247,0.5)',
            borderRadius: 8,
            color: '#ffffff',
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

      <div className="ui-detail-content">
        <div style={{ marginBottom: 6, fontSize: 11, color, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {CATEGORY_EMOJI[loc.category]} {tx.categories[loc.category]}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h1 ref={heading} tabIndex={-1} style={{ fontFamily: "var(--ui-font)", fontSize: 30, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>{name}</h1>
          {showSave ? (
            <button className="ui-icon-button" onClick={onToggleSave} aria-pressed={saved} aria-label={lang === 'he' ? saved ? 'הסרה מהשמורים' : 'שמירת המקום' : saved ? 'Remove from saved' : 'Save this place'}><Icon name={saved ? 'check' : 'bookmark'} /></button>
          ) : null}
        </div>
        <div style={{ fontSize: 15, color: 'var(--ui-accent)', marginTop: 4, fontStyle: 'normal' }}>{city}</div>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ui-muted)' }}>{['CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(loc.business_status)
          ? (lang === 'he' ? 'המקום מדווח כסגור. בחרו מקום אחר.' : 'This venue is reported closed. Choose another place.')
          : (lang === 'he' ? 'בדקו שעות פתיחה, זמינות וכשרות עם המקום לפני ההגעה.' : 'Confirm opening hours, availability and kashrut with the venue before going.')}</p>
        {loc.formatted_address && <div style={{ fontSize: 13, marginTop: 6 }}>{loc.formatted_address}</div>}
        <VenueFoodDetails loc={loc} lang={lang} />
        {safeExternalUrl(loc.details_source_url) && <p className="ui-footnote"><a href={safeExternalUrl(loc.details_source_url)} target="_blank" rel="noopener noreferrer">{lang === 'he' ? 'מקור פרטי המקום' : 'Venue information source'} ↗</a>{loc.details_checked_at ? ` · ${loc.details_checked_at.slice(0, 10)}` : ''}</p>}

        {loc.opening_hours?.weekday_text?.length > 0 && <details style={{ marginTop: 14, fontSize: 13, lineHeight: 1.7 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{lang === 'he' ? 'שעות פתיחה שפורסמו' : 'Published opening hours'}</summary>
          {loc.opening_hours.weekday_text.map((line, i) => <div key={i}>{line}</div>)}
          <div style={{ color: 'var(--ui-muted)', fontSize: 12 }}>{lang === 'he' ? 'בחגים ובשבת ייתכנו שינויים. יש לאשר עם המקום.' : 'Holiday and Shabbat hours can vary. Confirm with the venue.'}</div>
        </details>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {loc.is_partner ? (
            <div style={{ marginTop: 8, display: 'inline-block', background: '#F6EEDA', border: '1px solid #D8C49A', borderRadius: 999, padding: '4px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ui-accent)' }}>{tx.partnerBadge}</span>
            </div>
          ) : null}
          {kashrut ? (
            kashrut.status !== 'verified' ? (
              <div style={{ marginTop: 8, display: 'inline-block', background: '#F2EBDB', border: '1px solid #E6DCC8', borderRadius: 999, padding: '4px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-muted)' }}>{kashrut.label}</span>
              </div>
            ) : (
              <div style={{ marginTop: 8, display: 'inline-block', background: '#E9F0E4', border: '1px solid #C7DCBC', borderRadius: 999, padding: '4px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4F7144' }}>✓ {kashrut.label}</span>
              </div>
            )
          ) : null}
        </div>

        <p className="ui-footnote">{stages.filter(stage => tx.dateLabels[String(stage)]).map(stage => tx.dateLabels[String(stage)]).join(' · ')}</p>

        <div style={{ height: 1, background: 'var(--ui-border)', margin: '20px 0' }} />

        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ui-muted)', fontStyle: 'normal' }}>{desc}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
          <InfoBox label={tx.priceRange} value={priceLevel(loc, lang)} />
          <InfoBox label={tx.location} value={city} />
        </div>

        <div className="ui-detail-actions">
          {mapsUrl && <a className="ui-button ui-button-primary" href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={() => onMapOpen?.(loc)}><Icon name="pin" size={18} />{tx.openMaps}</a>}
          <button className="ui-button ui-button-secondary" onClick={handleShare}><Icon name="share" size={18} />{lang === 'he' ? 'שיתוף' : 'Share'}</button>
          {safeExternalUrl(loc.reservation_url) && <a className="ui-text-button" href={safeExternalUrl(loc.reservation_url)} target="_blank" rel="noopener noreferrer" onClick={() => onReserve?.(loc)}>{tx.reserveButton}<Icon name="arrow" size={16} /></a>}
          {loc.phone && <a className="ui-text-button" href={`tel:${String(loc.phone).replace(/[^+\d]/g, '')}`} onClick={() => onPhone?.(loc)}>{lang === 'he' ? 'התקשרו למקום' : 'Call the venue'}</a>}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ui-muted)', marginBottom: 8, textTransform: 'uppercase' }}>{tx.goodFor}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {loc.occasion?.map((tag) => (
              <span key={tag} style={{ background: '#F2EBDB', border: '1px solid #E6DCC8', borderRadius: 16, padding: '4px 12px', fontSize: 12, color: 'var(--ui-muted)' }}>
                {tx.occasions[tag] || tag}
              </span>
            ))}
          </div>
        </div>

        {isFoodVenue(loc) && <div style={{ marginTop: 24, background: 'var(--ui-surface)', borderRadius: 10, padding: 18, border: '1px solid #EBE2D0' }}>
          <div style={{ fontSize: 11, color: 'var(--ui-accent)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>{tx.importantNote}</div>
          <p style={{ fontSize: 13, color: 'var(--ui-muted)', margin: 0, lineHeight: 1.6 }}>{tx.kashrusNote}</p>
          {kashrut?.meta ? <p style={{ fontSize: 11.5, color: 'var(--ui-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>{kashrut.meta}</p> : null}
        </div>}

        <aside style={{ marginTop: 18, padding: '16px 18px', borderRadius: 14, background: '#f5f5f7', border: '1px solid #E6D8B8' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ui-text)', marginBottom: 4 }}>
            {lang === 'he' ? 'זה העסק שלכם?' : 'Own or manage this venue?'}
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#7E7361', lineHeight: 1.5 }}>
            {lang === 'he'
              ? 'אמתו את הפרטים, עדכנו כשרות והזמנות, וקבלו נתוני ביצועים.'
              : 'Claim the listing, verify details and kashrut, and receive performance reporting.'}
          </p>
          <button
            type="button"
            onClick={() => onClaim?.(loc)}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ui-accent)', fontFamily: font, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
          >
            {lang === 'he' ? 'תבעו או עדכנו את הרישום ←' : 'Claim or update this listing →'}
          </button>
        </aside>

        {setDateFeedback ? (
          <details className="ui-more-options"><summary>{lang === 'he' ? 'כבר ביקרתם? איך היה?' : 'Been here? How was it?'}</summary><FeedbackStrip lang={lang} font={font} loc={loc} dateFeedback={dateFeedback} setDateFeedback={setDateFeedback} /></details>
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

function getKashrutDisplay(loc, lang) {
  const isHe = lang === 'he'
  let status = loc.kashrut_status || (/not certified/i.test(loc.kashrus || '') ? 'not_certified' : 'unknown')
  if (certificateExpired(loc)) status = 'expired'
  if (status === 'verified' && !hasVerifiedKashrut(loc)) status = 'unknown'
  if (status === 'unknown') return loc.kashrus ? { status: 'unknown', label: `${loc.kashrus} · ${isHe ? 'לא מאומת' : 'unverified'}`, meta: null } : null
  if (status === 'not_certified') {
    return { status, label: isHe ? 'ללא תעודת כשרות מאומתת' : 'No verified certification', meta: null }
  }
  if (status === 'expired') {
    return { status, label: isHe ? 'אימות הכשרות פג — יש לבדוק מחדש' : 'Kashrut verification expired — recheck required', meta: null }
  }
  const authority = loc.kashrut_authority || loc.kashrus
  if (!authority) return null
  const checked = loc.kashrut_last_verified_at
    ? new Date(loc.kashrut_last_verified_at).toLocaleDateString(isHe ? 'he-IL' : 'en-IL', { year: 'numeric', month: 'short', day: 'numeric' })
    : null
  const expiry = loc.kashrut_certificate_expiry
    ? new Date(`${loc.kashrut_certificate_expiry}T00:00:00`).toLocaleDateString(isHe ? 'he-IL' : 'en-IL', { year: 'numeric', month: 'short', day: 'numeric' })
    : null
  const parts = []
  if (checked) parts.push(isHe ? `נבדק לאחרונה: ${checked}` : `Last checked: ${checked}`)
  if (expiry) parts.push(isHe ? `תוקף תעודה: ${expiry}` : `Certificate expiry: ${expiry}`)
  return { status, label: authority, meta: parts.join(' · ') || null }
}

function InfoBox({ label, value }) {
  return (
    <div style={{ background: 'var(--ui-surface)', border: '1px solid #EBE2D0', borderRadius: 8, padding: '11px 14px' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--ui-muted)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--ui-text)' }}>{value}</div>
    </div>
  )
}
