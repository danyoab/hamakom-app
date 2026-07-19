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
          <p style={{ color: '#6E6450' }}>Something went wrong. Please refresh the page.</p>
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
