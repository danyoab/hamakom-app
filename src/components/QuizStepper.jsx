import { useMemo, useState } from 'react'
import { t } from '../lib/translations'

const ACCENT = '#C9A84C'
const BG     = '#0D1117'
const PANEL  = '#161B27'
const BORDER = '#2A2F3E'
const TEXT   = '#E8DCC8'
const MUTED  = '#9CA3AF'

function slugify(city) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function cityImagePath(city) {
  return `/city-images/${slugify(city)}.jpg`
}

export default function QuizStepper({ lang, font, cityOptions = [], onComplete, onBack }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [chosen, setChosen] = useState(null)
  const isHe = lang === 'he'
  const dir  = isHe ? 'rtl' : 'ltr'

  // 4 questions — no "when" (removed), seriousness moved to Q1
  const questions = useMemo(() => [
    {
      id: 'seriousness',
      en: 'Where are you two at?',
      he: 'איפה אתם בתהליך?',
      suben: 'This shapes the whole evening.',
      subhe: 'זה קובע את הטון של כל הערב.',
      type: 'standard',
      options: [
        { value: 'just-met',          en: 'First few dates',              he: 'עדיין מתחילים',         suben: 'Keep it light, easy, low pressure',      subhe: 'קליל, קל, בלי לחץ' },
        { value: 'getting-to-know',   en: 'Getting to know each other',   he: 'מכירים אחד את השני',   suben: 'More time, better conversations',         subhe: 'יותר זמן, שיחות טובות יותר' },
        { value: 'getting-serious',   en: 'Already close',                he: 'כבר קרובים',            suben: 'Make the evening feel intentional',       subhe: 'לתת לערב להרגיש מכוון' },
      ],
    },
    {
      id: 'focus',
      en: 'What kind of experience?',
      he: 'איזה סוג חוויה?',
      suben: 'Pick the one thing the night should deliver.',
      subhe: 'בחרו את הדבר האחד שהערב צריך לספק.',
      type: 'standard',
      options: [
        { value: 'food-drink',  en: 'Great food and conversation',  he: 'אוכל טוב ושיחה',     suben: 'A place that does the talking for you',       subhe: 'מקום שמדבר בשבילכם' },
        { value: 'activity',    en: 'Something to do together',     he: 'פעילות משותפת',      suben: 'Shared experience, less pressure',             subhe: 'חוויה משותפת, פחות לחץ' },
        { value: 'outdoors',    en: 'Outside and moving',           he: 'בחוץ ובתנועה',       suben: 'Fresh air, views, space to think',             subhe: 'אוויר, נוף, מרחב לחשוב' },
        { value: 'atmosphere',  en: 'Atmosphere and ambiance',      he: 'אווירה ומקום',        suben: 'Somewhere that just feels right',              subhe: 'מקום שפשוט מרגיש נכון' },
      ],
    },
    {
      id: 'city',
      en: 'Which city?',
      he: 'איזו עיר?',
      suben: 'Pick local if distance matters.',
      subhe: 'בחרו מקומי אם מרחק חשוב.',
      type: 'city',
      options: [
        ...cityOptions.map(city => ({
          value: city,
          en: t.en.cities?.[city] || city,
          he: t.he.cities?.[city] || city,
        })),
        { value: 'flexible', en: 'Anywhere', he: 'גמיש/ה' },
      ],
    },
    {
      id: 'length',
      en: 'How long?',
      he: 'כמה זמן?',
      suben: 'Be honest about what your evening can hold.',
      subhe: 'היו כנים לגבי כמה זמן יש לכם.',
      type: 'standard',
      options: [
        { value: 'short',   en: 'Quick and easy',          he: 'קצר וקליל',         suben: '1–2 hours — no overcommitting',          subhe: '1–2 שעות — בלי התחייבות גדולה' },
        { value: 'medium',  en: 'A proper evening',        he: 'ערב מסודר',          suben: '2–3 hours — a real plan with flow',      subhe: '2–3 שעות — תוכנית אמיתית עם זרימה' },
        { value: 'long',    en: 'Make a full night of it', he: 'ערב שלם',            suben: '3+ hours — go all in',                   subhe: '3+ שעות — ללכת על זה לגמרי' },
      ],
    },
  ], [cityOptions])

  const question = questions[step]
  const total    = questions.length
  const pct      = Math.round(((step + 1) / total) * 100)

  const handleSelect = (value) => {
    if (chosen !== null) return
    setChosen(value)
    const nextAnswers = { ...answers, [question.id]: value }

    // City question: advance immediately (photo taps feel instant)
    const delay = question.type === 'city' ? 180 : 220

    setTimeout(() => {
      setChosen(null)
      setAnswers(nextAnswers)
      if (step < total - 1) setStep(s => s + 1)
      else onComplete({ ...nextAnswers, when: 'planning-ahead' })
    }, delay)
  }

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1)
    else onBack()
  }

  const isCityStep = question.id === 'city'

  return (
    <div
      dir={dir}
      style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: font, display: 'flex', flexDirection: 'column' }}
    >
      {/* Gold progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: '#1F2937', zIndex: 100 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${ACCENT} 0%,#E8B84B 100%)`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Nav row */}
      <div style={{ padding: '22px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1, fontFamily: font }}
          aria-label="Back"
        >
          {isHe ? '→' : '←'}
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {questions.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === step ? ACCENT : i < step ? '#4B5563' : '#2A2F3E',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        <div style={{ width: 28 }} />
      </div>

      {/* Question content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 18px 36px' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>

          {/* Question header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: ACCENT, textTransform: 'uppercase', marginBottom: 10 }}>
              {isHe ? `שאלה ${step + 1} מתוך ${total}` : `Step ${step + 1} of ${total}`}
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 8px' }}>
              {isHe ? question.he : question.en}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
              {isHe ? question.subhe : question.suben}
            </p>
          </div>

          {/* City photo grid */}
          {question.type === 'city' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {question.options.map(option => {
                const isFlexible = option.value === 'flexible'
                const isChosen   = chosen === option.value
                const imgUrl     = isFlexible ? null : cityImagePath(option.value)

                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    disabled={chosen !== null}
                    style={{
                      position: 'relative',
                      height: 100,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: `2px solid ${isChosen ? ACCENT : 'transparent'}`,
                      cursor: chosen !== null ? 'default' : 'pointer',
                      padding: 0,
                      background: isFlexible ? PANEL : '#111',
                      transition: 'border-color 0.15s, transform 0.15s',
                      transform: isChosen ? 'scale(0.97)' : 'scale(1)',
                      boxShadow: isChosen ? `0 0 0 1px ${ACCENT}40, 0 4px 16px rgba(201,168,76,0.2)` : 'none',
                    }}
                  >
                    {/* Photo background */}
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={isHe ? option.he : option.en}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : null}

                    {/* Gradient overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: isFlexible
                        ? 'none'
                        : isChosen
                          ? 'linear-gradient(180deg, rgba(201,168,76,0.18) 0%, rgba(0,0,0,0.72) 100%)'
                          : 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.68) 100%)',
                      transition: 'background 0.2s',
                    }} />

                    {/* City name */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      padding: '10px 12px',
                      textAlign: 'center',
                    }}>
                      {isFlexible ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 76, gap: 4 }}>
                          <span style={{ fontSize: 22, color: MUTED }}>◎</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{isHe ? option.he : option.en}</span>
                          <span style={{ fontSize: 11, color: MUTED }}>{isHe ? 'תנו לי את ההתאמה הטובה ביותר' : 'Best match anywhere'}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                          {isHe ? option.he : option.en}
                        </span>
                      )}
                    </div>

                    {/* Selected checkmark */}
                    {isChosen ? (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: BG, fontWeight: 700 }}>
                        ✓
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : (
            /* Standard text option cards */
            <div style={{ display: 'grid', gap: 10 }}>
              {question.options.map(option => {
                const isChosen = chosen === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    disabled={chosen !== null}
                    style={{
                      background: isChosen ? '#161F14' : PANEL,
                      border: `1px solid ${isChosen ? ACCENT : BORDER}`,
                      borderRadius: 14,
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: chosen !== null ? 'default' : 'pointer',
                      textAlign: isHe ? 'right' : 'left',
                      fontFamily: 'inherit',
                      color: TEXT,
                      transform: isChosen ? 'scale(0.985)' : 'scale(1)',
                      transition: 'all 0.16s ease',
                      boxShadow: isChosen ? `0 0 0 1px ${ACCENT}30` : 'none',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 16, fontWeight: 600, marginBottom: 3, color: isChosen ? ACCENT : TEXT }}>
                        {isHe ? option.he : option.en}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
                        {isHe ? option.subhe : option.suben}
                      </span>
                    </span>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: isChosen ? ACCENT : BORDER,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: isChosen ? BG : 'transparent',
                      fontWeight: 700, transition: 'all 0.16s',
                    }}>
                      ✓
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
