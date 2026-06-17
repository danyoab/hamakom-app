const ALLOWED_REDIRECT_ORIGINS = new Set([
  'https://hamakom.app',
  'https://www.hamakom.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
])

export function getAuthRedirectUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL
  if (configured) return configured
  if (typeof window === 'undefined') return 'https://hamakom.app'
  const { origin } = window.location
  return ALLOWED_REDIRECT_ORIGINS.has(origin) ? origin : 'https://hamakom.app'
}
