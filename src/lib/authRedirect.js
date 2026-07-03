import { isNativeApp, NATIVE_AUTH_REDIRECT } from './native'

const ALLOWED_REDIRECT_ORIGINS = new Set([
  'https://hamakom.app',
  'https://www.hamakom.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
])

export function getAuthRedirectUrl() {
  // Inside the native shell, auth must return through the custom URL scheme
  // so the deep-link listener can complete the session.
  if (isNativeApp()) return NATIVE_AUTH_REDIRECT
  const configured = import.meta.env.VITE_PUBLIC_APP_URL
  if (configured) return configured
  if (typeof window === 'undefined') return 'https://hamakom.app'
  const { origin } = window.location
  return ALLOWED_REDIRECT_ORIGINS.has(origin) ? origin : 'https://hamakom.app'
}
