import { Capacitor } from '@capacitor/core'

// True only inside the packaged Android/iOS Capacitor shell. On the regular
// web build (Vercel / browser) this is always false, so every native-only
// code path stays disabled and the web flow is untouched.
export function isNativeApp() {
  try {
    return Capacitor?.isNativePlatform?.() ?? false
  } catch {
    return false
  }
}

// Custom URL scheme used to bring auth callbacks back into the native app.
// Must match the intent-filter (Android) and CFBundleURLTypes (iOS) entries,
// and must be registered as a redirect URL in the Supabase Auth settings.
export const NATIVE_AUTH_REDIRECT = 'app.hamakom://auth-callback'
