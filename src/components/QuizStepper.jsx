import { useMemo, useState } from 'react'

export default function QuizStepper({ lang, font, cityOptions = [], onComplete, onBack }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [chosen, setChosen] = useState(null)
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'

  const questions = useMemo(() => {
    const cityChoices = cityOptions.map((city) => ({
      value: city,
      en: city,
      he: city,
    }))

    return [
      {
        id: 'length',
        en: 'How big should this date feel?',
        he: 'כמה גדול הדייט הזה צריך להרגיש?',
        suben: 'Pick the pace that feels right.',
        subhe: 'בחרו את הקצב שמרגיש נכון.',
        options: [
          { value: 'short',  en: 'Quick and light',   he: 'קליל וקצר',        suben: 'A lighter evening, no overcommitting', subhe: 'ערב קליל בלי להרגיש מחויבות גדולה' },
          { value: 'medium', en: 'Balanced night',    he: 'ערב מאוזן',         suben: 'Enough shape to feel like a real plan', subhe: 'מספיק מבנה כדי להרגיש כמו תוכנית אמיתית' },
          { value: 'long',   en: 'Make a night of it', he: 'לעשות מזה ערב',   suben: 'More time, more flow, more room to stretch', subhe: 'יותר זמן, יותר זרימה, יותר מקום להאריך' },
        ],
      },
      {
        id: 'focus',
        en: 'What kind of night do you want?',
        he: 'איזה ערב אתם רוצים?',
        suben: 'Pick the vibe that feels right.',
        subhe: 'בחרו את הוייב שמרגיש נכון.',
        options: [
          { value: 'food-drink',  en: 'Great food & drinks',    he: 'אוכל ושתייה טובים',  suben: 'The meal is the plan',                    subhe: 'הארוחה היא התוכנית' },
          { value: 'atmosphere',  en: 'Somewhere with a vibe',  he: 'מקום עם אווירה',      suben: 'Setting, mood, and intimacy',              subhe: 'מקום, מצב רוח ואינטימיות' },
          { value: 'outdoors',    en: 'Outside or active',       he: 'בחוץ או פעיל',        suben: 'Air, movement, views — not a restaurant', subhe: 'אוויר, תנועה, נוף — לא מסעדה' },
        ],
      },
      {
        id: 'city',
        en: 'What city should this be near?',
        he: 'ליד איזו עיר הדייט צריך להיות?',
        suben: 'Pick local if distance matters, or stay flexible.',
        subhe: 'בחרו מקומי אם מרחק חשוב, או השאירו גמיש.',
        options: [
          ...cityChoices,
          { value: 'flexible', en: "I'm flexible", he: 'אני גמיש/ה', suben: 'Just give me the best match', subhe: 'פשוט תנו לי את ההתאמה הכי טובה' },
        ],
      },
      {
        id: 'seriousness',
        en: 'How serious is this date?',
        he: 'כמה הדייט הזה רציני?',
        suben: 'This changes the tone more than people admit.',
        subhe: 'זה משנה את הטון יותר ממה שאנשים מודים.',
        options: [
          { value: 'just-met',        en: 'Just met',                  he: 'הרגע הכרנו',        suben: 'Keep it low pressure',       subhe: 'לשמור על אפס לחץ' },
          { value: 'getting-to-know', en: 'Getting to know each other', he: 'מכירים אחד את השני', suben: 'More time, better conversation', subhe: 'יותר זמן, יותר שיחה' },
          { value: 'getting-serious', en: 'Getting serious',            he: 'זה נהיה רציני',      suben: 'Make it feel intentional',   subhe: 'לתת לזה להרגיש מכוון' },
        ],
      },
    ]
  }, [cityOptions])

  const question = questions[step]
  const pct = Math.round(((step + 1) / questions.length) * 100)

  const handleSelect = (value) => {
    if (chosen !== null) return
    setChosen(value)
    const nextAnswers = { ...answers, [question.id]: value }
    setTimeout(() => {
      setChosen(null)
      setAnswers(nextAnswers)
      if (step < questions.length - 1) setStep((current) => current + 1)
      else onComplete(nextAnswers)
    }, 240)
  }

  const handleBack = () => {
    if (step > 0) setStep((current) => current - 1)
    else onBack()
  }

  const isCityStep = question.id === 'city'

  return (
    <div
      dir={dir}
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#0D1117 0%,#111827 100%)',
        color: '#E8DCC8',
        fontFamily: font,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, background: '#1F2937', zIndex: 100 }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#C9A84C 0%,#E8B84B 100%)',
            transition: 'width 0.25s ease',
          }}
        />
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}
          aria-label="Back"
        >
          {isHe ? '→' : '←'}
        </button>
        <div style={{ fontSize: 12, color: '#6B7280', letterSpacing: '0.12em' }}>
          {step + 1} / {questions.length}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 24px 32px' }}>
        <div style={{ width: '100%', maxWidth: 500, margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 14 }}>
              {isHe ? 'דייט ב־60 שניות' : 'Date in 60 Seconds'}
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.16, fontWeight: 700, marginBottom: 8 }}>
              {isHe ? question.he : question.en}
            </div>
            <div style={{ fontSize: 14, color: '#9CA3AF' }}>
              {isHe ? question.subhe : question.suben}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {question.options.map((option) => {
              const isChosen = chosen === option.value
              const showSub = !isCityStep && option.suben
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  disabled={chosen !== null}
                  style={{
                    background: isChosen ? '#1A2420' : '#161B27',
                    border: `1px solid ${isChosen ? '#C9A84C' : '#2A2F3E'}`,
                    borderRadius: 16,
                    padding: showSub ? '15px 18px' : '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: chosen !== null ? 'default' : 'pointer',
                    textAlign: isHe ? 'right' : 'left',
                    fontFamily: 'inherit',
                    color: '#E8DCC8',
                    transform: isChosen ? 'scale(0.985)' : 'scale(1)',
                    transition: 'all 0.16s ease',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `2px solid ${isChosen ? '#C9A84C' : '#4B5563'}`,
                      background: isChosen ? '#C9A84C' : 'transparent',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.16s ease',
                    }}
                  >
                    {isChosen && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0D1117', display: 'block' }} />
                    )}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>
                      {isHe ? option.he : option.en}
                    </span>
                    {showSub && (
                      <span style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                        {isHe ? option.subhe : option.suben}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
