import { MarketProvider } from './lib/MarketContext.jsx'
import './product.css'
import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

const sentry = import.meta.env.VITE_SENTRY_DSN
  ? import('./lib/errorReporting.js').catch(() => null) : Promise.resolve(null)

// Let the first page finish loading before the offline worker prefetches assets.
registerSW({ immediate: false })
// Retire the previous blanket API cache, which could retain authenticated
// responses. Only the explicitly selected public catalog is cached now.
if ('caches' in window) void caches.delete('supabase-api').catch(() => {})

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) {
    void sentry.then(client => client?.captureException(error, { extra: info }))
  }
  render() {
    if (this.state.error) return (
      <div style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--ui-font)", padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>המקום</div>
          <p style={{ color: 'var(--ui-muted)' }}>Something went wrong. Please refresh the page.</p>
        </div>
      </div>
    )
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <MarketProvider><App /></MarketProvider>
    </ErrorBoundary>
  </StrictMode>
)
