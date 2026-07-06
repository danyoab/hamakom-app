import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

registerSW({ immediate: true })

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) {
    Sentry.captureException(error, { extra: info })
  }
  render() {
    if (this.state.error) return (
      <div style={{ background: '#0D1117', color: '#E8DCC8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Heebo', system-ui, sans-serif", padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>המקום</div>
          <p style={{ color: '#9CA3AF', margin: '0 0 6px' }}>Something went wrong. Please refresh the page.</p>
          <p style={{ color: '#9CA3AF', margin: '0 0 20px' }} dir="rtl">משהו השתבש. רעננו את הדף.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#C9A84C', color: '#0D1117', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Refresh · רענון
          </button>
        </div>
      </div>
    )
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
