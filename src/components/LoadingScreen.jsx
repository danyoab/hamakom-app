import { useState, useEffect } from 'react'

const STEPS_EN = [
  "Analyzing your date style…",
  "Matching with hidden gems…",
  "Finding your perfect spots…",
  "Almost ready…",
]
const STEPS_HE = [
  "מנתח את סגנון הדייט שלך…",
  "מתאים אותך למקומות מוסתרים…",
  "מוצא את המקומות המושלמים עבורך…",
  "כמעט מוכן…",
]

export default function LoadingScreen({ lang, font, onComplete }) {
  const [progress, setProgress] = useState(0)
  const [msgIdx,   setMsgIdx]   = useState(0)
  const isHe  = lang === 'he'
  const steps = isHe ? STEPS_HE : STEPS_EN

  useEffect(() => {
    const TOTAL_MS  = 3000
    const TICK_MS   = 40
    const BASE_STEP = 100 / (TOTAL_MS / TICK_MS)
    let current = 0
    let done    = false

    const id = setInterval(() => {
      // Non-linear: fast start, stalls near 90, then jumps to 100
      const jitter  = Math.random() * BASE_STEP * 0.6
      const dampen  = current > 88 ? 0.15 : 1
      current = Math.min(current + (BASE_STEP + jitter) * dampen, 100)

      setProgress(current)
      setMsgIdx(Math.min(Math.floor((current / 100) * steps.length), steps.length - 1))

      if (current >= 100 && !done) {
        done = true
        clearInterval(id)
        setTimeout(onComplete, 350)
      }
    }, TICK_MS)

    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      dir={isHe ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh', background: '#0D1117', color: '#E8DCC8',
        fontFamily: font, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 28px',
      }}
    >
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 320 }}>

        {/* Pulsing orb */}
        <div style={{
          width: 84, height: 84, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 36%, #E8C96A, #8B6010)',
          margin: '0 auto 36px',
          boxShadow: `0 0 ${20 + Math.round(progress * 0.3)}px rgba(201,168,76,0.35)`,
          animation: 'hamakomPulse 1.8s ease-in-out infinite',
        }} />

        <div style={{
          fontSize: 17, color: '#E8DCC8', marginBottom: 6, minHeight: 26,
          transition: 'opacity 0.25s ease',
        }}>
          {steps[msgIdx]}
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 36 }}>
          {isHe ? 'מכין את התוצאות האישיות שלך' : 'Preparing your personalized results'}
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 4, background: '#1F2937', borderRadius: 2 }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #C9A84C 0%, #E8B84B 100%)',
            borderRadius: 2,
            width: `${progress}%`,
            transition: 'width 0.08s linear',
          }} />
        </div>

        <div style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>
          {Math.round(progress)}%
        </div>
      </div>

      <style>{`
        @keyframes hamakomPulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.07); opacity: 0.88; }
        }
      `}</style>
    </div>
  )
}
