import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import * as Sentry from '@sentry/react'
import App from './App.jsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}

registerSW({ immediate: true })

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) {
    Sentry.captureException(error, { extra: info })
  }
  render() {
    if (this.state.error) return (
      <div style={{ background: '#F7F2E8', color: '#241E16', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Heebo', system-ui, sans-serif", padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>המקום</div>
          <p style={{ color: '#6E6450', margin: '0 0 6px' }}>Something went wrong.</p>
          <p style={{ color: '#6E6450', margin: '0 0 20px' }} dir="rtl">משהו השתבש.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#241E16', color: '#F4ECD8', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Try again · נסו שוב
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
