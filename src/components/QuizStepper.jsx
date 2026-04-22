import { useMemo, useState } from 'react'

export default function QuizStepper({ lang, font, cityOptions = [], onComplete, onBack }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [chosen, setChosen] = useState(null)
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'

  const questions = useMemo(() => {
    const cityChoices = cityOptions.map((city, index) => ({
      value: city,
      icon: ['◫', '◪', '◩', '◨', '◧', '◬'][index % 6],
      en: city,
      he: city,
      suben: `Prefer plans around ${city}`,
      subhe: `העדפה לתוכניות באזור ${city}`,
    }))

    return [
      {
        id: 'when',
        icon: '○',
        en: 'When are you planning this date?',
        he: 'מתי אתם מתכננים את הדייט?',
        suben: 'We will give you one answer, not more options.',
        subhe: 'אנחנו ניתן לכם תשובה אחת, לא עוד אפשרויות.',
        options: [
          { value: 'tonight', icon: '◐', en: 'Tonight', he: 'הערב', suben: 'Fast, easy, executable', subhe: 'מהיר, קל, אפשר לצאת לדרך' },
          { value: 'thursday-night', icon: '◑', en: 'Thursday Night', he: 'חמישי בלילה', suben: 'A classic date night before Shabbat', subhe: 'לילה קלאסי לדייט לפני שבת' },
          { value: 'planning-ahead', icon: '◒', en: 'Planning ahead', he: 'מתכננים מראש', suben: 'Worth making room for', subhe: 'שווה לפנות לזה זמן' },
        ],
      },
      {
        id: 'length',
        icon: '◔',
        en: 'How big should this date feel?',
        he: 'כמה גדול הדייט הזה צריך להרגיש?',
        suben: 'Pick the pace that feels right for tonight.',
        subhe: 'בחרו את הקצב שמרגיש נכון לערב הזה.',
        options: [
          { value: 'short', icon: '◐', en: 'Quick and light', he: 'קליל וקצר', suben: 'A lighter evening without overcommitting', subhe: 'ערב קליל בלי להרגיש מחויבות גדולה' },
          { value: 'medium', icon: '◑', en: 'Balanced night', he: 'ערב מאוזן', suben: 'Enough shape to feel like a real plan', subhe: 'מספיק מבנה כדי להרגיש כמו תוכנית אמיתית' },
          { value: 'long', icon: '●', en: 'Make a night of it', he: 'לעשות מזה ערב', suben: 'More time, more flow, more room to stretch', subhe: 'יותר זמן, יותר זרימה, יותר מקום להאריך' },
        ],
      },
      {
        id: 'focus',
        icon: '◎',
        en: 'What matters most?',
        he: 'מה הכי חשוב לכם?',
        suben: 'Pick the one thing the night should deliver.',
        subhe: 'בחרו את הדבר האחד שהערב צריך לספק.',
        options: [
          { value: 'atmosphere', icon: '✦', en: 'Atmosphere', he: 'אווירה', suben: 'Mood, intimacy, and setting', subhe: 'וייב, אינטימיות ומקום' },
          { value: 'food-drink', icon: '◌', en: 'Food & Drink', he: 'אוכל ושתייה', suben: 'Great taste, easy flow', subhe: 'טעם טוב וזרימה' },
          { value: 'activity', icon: '◇', en: 'Activity', he: 'פעילות', suben: 'Something to do together', subhe: 'משהו לעשות ביחד' },
          { value: 'outdoors', icon: '△', en: 'Outdoors', he: 'בחוץ', suben: 'Air, movement, and views', subhe: 'אוויר, תנועה ונוף' },
        ],
      },
      {
        id: 'city',
        icon: '⌖',
        en: 'What city should this be near?',
        he: 'ליד איזו עיר הדייט צריך להיות?',
        suben: 'Pick local if distance matters, or stay flexible.',
        subhe: 'בחרו מקומי אם מרחק חשוב, או השאירו את זה גמיש.',
        options: [
          ...cityChoices,
          { value: 'flexible', icon: '◎', en: "I'm flexible", he: 'אני גמיש/ה', suben: 'Just give me the best match', subhe: 'פשוט תנו לי את ההתאמה הכי טובה' },
        ],
      },
      {
        id: 'seriousness',
        icon: '◍',
        en: 'How serious is this date?',
        he: 'כמה הדייט הזה רציני?',
        suben: 'This changes the tone more than people admit.',
        subhe: 'זה משנה את הטון יותר ממה שאנשים מודים.',
        options: [
          { value: 'just-met', icon: '○', en: 'Just met', he: 'הרגע הכרנו', suben: 'Keep it low pressure', subhe: 'לשמור על אפס לחץ' },
          { value: 'getting-to-know', icon: '◔', en: 'Getting to know each other', he: 'מכירים אחד את השני', suben: 'More time, better conversation', subhe: 'יותר זמן, יותר שיחה' },
          { value: 'getting-serious', icon: '●', en: 'Getting serious', he: 'זה נהיה רציני', suben: 'Make it feel intentional', subhe: 'לתת לזה להרגיש מכוון' },
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

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 24px 32px' }}>
        <div style={{ width: '100%', maxWidth: 500 }}>
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{question.icon}</div>
            <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>
              {isHe ? 'דייט ב־60 שניות' : 'Date in 60 Seconds'}
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.16, fontWeight: 700, marginBottom: 8 }}>{isHe ? question.he : question.en}</div>
            <div style={{ fontSize: 14, color: '#9CA3AF' }}>{isHe ? question.subhe : question.suben}</div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {question.options.map((option) => {
              const isChosen = chosen === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  disabled={chosen !== null}
                  style={{
                    background: isChosen ? 'linear-gradient(135deg,#1D2B1E 0%,#18231B 100%)' : '#161B27',
                    border: `1px solid ${isChosen ? '#C9A84C' : '#2A2F3E'}`,
                    borderRadius: 18,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: chosen !== null ? 'default' : 'pointer',
                    textAlign: isHe ? 'right' : 'left',
                    fontFamily: 'inherit',
                    color: '#E8DCC8',
                    transform: isChosen ? 'scale(0.985)' : 'scale(1)',
                    transition: 'all 0.16s ease',
                  }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, color: isChosen ? '#C9A84C' : '#E8DCC8' }}>{option.icon}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 600, marginBottom: 3 }}>{isHe ? option.he : option.en}</span>
                    <span style={{ display: 'block', fontSize: 12, color: '#9CA3AF' }}>{isHe ? option.subhe : option.suben}</span>
                  </span>
                  <span style={{ opacity: isChosen ? 1 : 0, color: '#C9A84C', fontSize: 16 }}>✓</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
