import { useState } from 'react'

const QUESTIONS = [
  {
    id: 'stage',
    icon: '💫',
    en: "What stage are you at?",
    he: "באיזה שלב אתם?",
    suben: "Be honest — it shapes everything",
    subhe: "תהיו כנים — זה משנה הכל",
    options: [
      { value: 1, icon: '👋', en: "Just met",              he: "הכרנו לאחרונה",        suben: "First date energy",     subhe: "אנרגיית דייט ראשון" },
      { value: 2, icon: '😊', en: "Getting to know each other", he: "מכירים אחד את השני", suben: "A few dates in",     subhe: "כמה דייטים" },
      { value: 3, icon: '🔥', en: "Getting serious",       he: "מתרציניים",             suben: "Real connection built", subhe: "קשר אמיתי כבר יש" },
    ],
  },
  {
    id: 'vibe',
    icon: '✨',
    en: "What's the vibe for this date?",
    he: "מה האווירה שאתם מחפשים?",
    suben: "Go with your gut",
    subhe: "סמכו על האינסטינקט",
    options: [
      { value: 'romantic',    icon: '🌹', en: "Romantic & intimate",  he: "רומנטי ואינטימי",   suben: "Candles, quiet, magic",   subhe: "נרות, שקט, קסם" },
      { value: 'fun',         icon: '😄', en: "Fun & playful",        he: "כיפי ושובבי",       suben: "Laughs guaranteed",       subhe: "צחוק מובטח" },
      { value: 'casual',      icon: '🌿', en: "Chill & easy",         he: "נינוח ורגוע",       suben: "No pressure, just enjoy",  subhe: "בלי לחץ" },
      { value: 'adventurous', icon: '🏔️', en: "Active & adventurous", he: "פעיל והרפתקני",    suben: "Move together",           subhe: "בתנועה ביחד" },
    ],
  },
  {
    id: 'budget',
    icon: '💰',
    en: "What's your budget per person?",
    he: "מה התקציב שלכם לאדם?",
    suben: "We'll only show what fits",
    subhe: "נציג רק מה שמתאים",
    options: [
      { value: 1, icon: '🤌', en: "Free or cheap", he: "חינמי או זול",     suben: "Under ₪50",  subhe: "עד ₪50" },
      { value: 2, icon: '😌', en: "Mid-range",     he: "בינוני",           suben: "₪50–150",    subhe: "₪50–150" },
      { value: 3, icon: '✨', en: "Happy to spend", he: "מוכן/ת להשקיע",  suben: "₪150–300",   subhe: "₪150–300" },
      { value: 4, icon: '🎉', en: "Go all out",    he: "חגיגה גדולה",      suben: "₪300+",      subhe: "₪300+" },
    ],
  },
  {
    id: 'kashrus',
    icon: '✡️',
    en: "How important is kashrut?",
    he: "כמה חשוב לכם כשרות?",
    suben: "We'll filter accordingly",
    subhe: "נסנן בהתאם",
    options: [
      { value: 'strict', icon: '🕍', en: "Strictly kosher only",   he: "כשר בלבד",             suben: "Mehadrin, certified",   subhe: "מהדרין, עם תעודה" },
      { value: 'prefer', icon: '🙂', en: "Prefer kosher-friendly", he: "עדיף כשר-ידידותי",     suben: "When possible",         subhe: "כשאפשר" },
      { value: 'none',   icon: '🤷', en: "Not a factor",           he: "לא רלוונטי",            suben: "Show me everything",    subhe: "הראה לי הכל" },
    ],
  },
  {
    id: 'city',
    icon: '📍',
    en: "What city are you usually in?",
    he: "באיזו עיר אתם בדרך כלל?",
    suben: "We'll prioritize nearby spots",
    subhe: "נתעדף מקומות קרובים",
    options: [
      { value: 'Jerusalem',   icon: '🏛️', en: "Jerusalem",      he: "ירושלים" },
      { value: 'Tel Aviv',    icon: '🌊', en: "Tel Aviv",       he: "תל אביב" },
      { value: "Modi'in",     icon: '🌆', en: "Modi'in",        he: "מודיעין" },
      { value: 'Beit Shemesh',icon: '☀️', en: "Beit Shemesh",  he: "בית שמש" },
      { value: 'other',       icon: '🗺️', en: "Somewhere else", he: "מקום אחר" },
    ],
  },
  {
    id: 'ambiance',
    icon: '🎯',
    en: "One word that speaks to you:",
    he: "מילה אחת שמדברת אליכם:",
    suben: "Don't overthink it",
    subhe: "אל תחשבו יותר מדי",
    options: [
      { value: 'views',    icon: '👁️', en: "Views",    he: "נוף",     suben: "Stunning scenery",    subhe: "נוף מרהיב" },
      { value: 'creative', icon: '🎨', en: "Creative", he: "יצירתי",  suben: "Unique & artsy",      subhe: "ייחודי ואמנותי" },
      { value: 'upscale',  icon: '💎', en: "Upscale",  he: "מפואר",   suben: "Wow them",            subhe: "תשאיר רושם" },
      { value: 'unique',   icon: '⚡', en: "Unique",   he: "ייחודי",  suben: "Off the beaten path", subhe: "מחוץ למסלול" },
    ],
  },
]

export default function QuizStepper({ lang, font, onComplete, onBack }) {
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [chosen, setChosen]   = useState(null) // tracks tapped option for animation
  const isHe  = lang === 'he'
  const dir   = isHe ? 'rtl' : 'ltr'
  const q     = QUESTIONS[step]
  const pct   = Math.round(((step + 1) / QUESTIONS.length) * 100)

  const handleSelect = (value) => {
    if (chosen !== null) return
    setChosen(value)
    const next = { ...answers, [q.id]: value }
    setTimeout(() => {
      setChosen(null)
      setAnswers(next)
      if (step < QUESTIONS.length - 1) setStep(s => s + 1)
      else onComplete(next)
    }, 360)
  }

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1)
    else onBack()
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font, display: 'flex', flexDirection: 'column' }}>

      {/* Progress strip */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: '#1F2937', zIndex: 100 }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #C9A84C 0%, #E8B84B 100%)',
          width: `${pct}%`,
          transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Top bar */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}
          aria-label="Back"
        >
          {isHe ? '→' : '←'}
        </button>
        <div style={{ fontSize: 12, color: '#6B7280', letterSpacing: '0.12em' }}>
          {step + 1} / {QUESTIONS.length}
        </div>
      </div>

      {/* Question area */}
      <div style={{ flex: 1, padding: '28px 24px 32px', display: 'flex', flexDirection: 'column', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 50, marginBottom: 14, lineHeight: 1 }}>{q.icon}</div>
          <div style={{ fontSize: 21, fontWeight: 600, color: '#E8DCC8', lineHeight: 1.3, marginBottom: 6 }}>
            {isHe ? q.he : q.en}
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            {isHe ? q.subhe : q.suben}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map(opt => {
            const isChosen = chosen === opt.value
            return (
              <button
                key={String(opt.value)}
                onClick={() => handleSelect(opt.value)}
                disabled={chosen !== null}
                style={{
                  background: isChosen ? 'linear-gradient(135deg, #1C2E20, #1E3825)' : '#161B27',
                  border: `1.5px solid ${isChosen ? '#C9A84C' : '#2A2F3E'}`,
                  borderRadius: 14,
                  padding: '13px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: chosen !== null ? 'default' : 'pointer',
                  textAlign: isHe ? 'right' : 'left',
                  fontFamily: 'inherit',
                  transform: isChosen ? 'scale(0.975)' : 'scale(1)',
                  transition: 'all 0.18s ease',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, color: isChosen ? '#C9A84C' : '#E8DCC8', fontWeight: 500, lineHeight: 1.2 }}>
                    {isHe ? opt.he : opt.en}
                  </div>
                  {(opt.suben || opt.subhe) && (
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {isHe ? opt.subhe : opt.suben}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 16, color: '#C9A84C', opacity: isChosen ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>✓</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
