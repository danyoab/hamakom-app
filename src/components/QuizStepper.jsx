import { useMemo, useState } from 'react'
import { t } from '../lib/translations'

const ACCENT = '#9A7A28'   // gold for eyebrows (readable on cream)
const GOLD   = '#C9A84C'   // bright gold for dots / fills
const BG     = '#F7F2E8'
const PANEL  = '#FFFFFF'
const BORDER = '#EBE2D0'
const TEXT   = '#241E16'
const MUTED  = '#8A7F6C'
const SERIF  = "'Spectral','Frank Ruhl Libre',Georgia,serif"
const INK    = '#241E16'

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

  // Quiz order is intentional:
  //   1. city — hardest constraint, scopes everything downstream
  //   2. seriousness — sets the whole evening's tone
  //   3. length — optional pacing override (skippable; engine infers it)
  // We intentionally do NOT ask "what kind of experience?" here: the results
  // page's vibe tabs already let people pick (and switch) the vibe live, so the
  // quiz leads with the strongest plan across all vibes instead of forcing the
  // choice up front.
  const questions = useMemo(() => [
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
      id: 'length',
      en: 'How long? (optional)',
      he: 'כמה זמן? (אופציונלי)',
      suben: 'Skip if you trust us to pace it.',
      subhe: 'דלגו אם אתם סומכים עלינו על הקצב.',
      type: 'standard',
      skippable: true,
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

  const handleSkip = () => {
    if (!question.skippable || chosen !== null) return
    const nextAnswers = { ...answers } // no value for this question
    if (step < total - 1) {
      setAnswers(nextAnswers)
      setStep(s => s + 1)
    } else {
      onComplete({ ...nextAnswers, when: 'planning-ahead' })
    }
  }

  return (
    <div
      dir={dir}
      style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: font, display: 'flex', flexDirection: 'column' }}
    >
      {/* Gold progress bar */}
      <div style={{ position: 'fixed', top: 'var(--hm-sat, 0px)', left: 0, right: 0, height: 3, background: '#E7DECB', zIndex: 100 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${GOLD} 0%,#E0BE58 100%)`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Nav row */}
      <div style={{ padding: 'calc(22px + var(--hm-sat, 0px)) 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={handleBack}
          style={{ color: '#5A5142', cursor: 'pointer', fontSize: 17, width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: font, background: PANEL, border: `1px solid ${BORDER}` }}
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
                background: i === step ? GOLD : i < step ? GOLD : '#E0D6C2',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        <div style={{ width: 28 }} />
      </div>

      {/* Question content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 18px 36px' }}>
        <div key={step} className="hm-step-fade" style={{ width: '100%', maxWidth: 520 }}>

          {/* Question header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: ACCENT, textTransform: 'uppercase', marginBottom: 10 }}>
              {isHe ? `שאלה ${step + 1} מתוך ${total}` : `Step ${step + 1} of ${total}`}
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 6vw, 30px)', fontWeight: 600, lineHeight: 1.12, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              {isHe ? question.he : question.en}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
              {isHe ? question.subhe : question.suben}
            </p>
          </div>

          {question.skippable ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button
                onClick={handleSkip}
                disabled={chosen !== null}
                style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: chosen !== null ? 'default' : 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
              >
                {isHe ? 'דלג — אנחנו נחליט' : 'Skip — let us pace it'}
              </button>
            </div>
          ) : null}

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
                    className="hm-lift"
                    style={{
                      position: 'relative',
                      height: 100,
                      borderRadius: 16,
                      overflow: 'hidden',
                      border: `1px solid ${isChosen ? ACCENT : BORDER}`,
                      cursor: chosen !== null ? 'default' : 'pointer',
                      padding: 0,
                      background: isFlexible ? PANEL : '#EDE7D9',
                      transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.2s',
                      // Leave the resting transform unset so the `.hm-lift:hover`
                      // rule can apply — an inline transform would win on
                      // specificity and silently kill the hover lift.
                      transform: isChosen ? 'scale(0.97)' : undefined,
                      boxShadow: isChosen
                        ? `0 0 0 1px ${ACCENT}55, 0 8px 22px -10px rgba(201,168,76,0.45)`
                        : '0 4px 14px -12px rgba(40,30,12,0.35)',
                    }}
                  >
                    {/* Photo background */}
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={isHe ? option.he : option.en}
                        className="hm-img-fade"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : null}

                    {/* Gradient overlay — lighter, bottom-weighted so it reads as cream-editorial */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: isFlexible
                        ? 'none'
                        : isChosen
                          ? 'linear-gradient(180deg, rgba(201,168,76,0.10) 30%, rgba(0,0,0,0.60) 100%)'
                          : 'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.52) 100%)',
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
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: INK, fontWeight: 800 }}>
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
                      background: isChosen ? '#FBF4E1' : PANEL,
                      border: `1.5px solid ${isChosen ? GOLD : BORDER}`,
                      borderRadius: 17,
                      padding: '17px 18px',
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
                      boxShadow: isChosen ? `0 6px 18px -10px rgba(201,168,76,0.45)` : '0 4px 14px -12px rgba(40,30,12,0.35)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 16.5, fontWeight: 700, marginBottom: 3, color: isChosen ? ACCENT : TEXT }}>
                        {isHe ? option.he : option.en}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>
                        {isHe ? option.subhe : option.suben}
                      </span>
                    </span>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: isChosen ? GOLD : '#F2EBDB',
                      border: isChosen ? `1px solid ${GOLD}` : '1px solid #E5DCC8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: isChosen ? INK : 'transparent',
                      fontWeight: 800, transition: 'all 0.16s',
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
