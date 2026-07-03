import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNativeApp, NATIVE_AUTH_REDIRECT } from './native'

// Pull Supabase tokens out of a deep-link callback URL. Supabase's default
// (implicit) flow returns them in the URL fragment; PKCE returns a `code`
// query param. We support both so the web flow can stay on its current setup.
function parseAuthCallback(url) {
  if (!url) return null
  const hashIndex = url.indexOf('#')
  if (hashIndex !== -1) {
    const params = new URLSearchParams(url.slice(hashIndex + 1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) return { type: 'tokens', access_token, refresh_token }
  }
  const queryIndex = url.indexOf('?')
  if (queryIndex !== -1) {
    const params = new URLSearchParams(url.slice(queryIndex + 1))
    const code = params.get('code')
    if (code) return { type: 'code', code }
  }
  return null
}

// Registers a deep-link listener that finishes sign-in when the OS reopens the
// app at app.hamakom://auth-callback. No-op on the web build.
export function initNativeAuth(supabase) {
  if (!isNativeApp() || !supabase) return () => {}

  const listenerPromise = CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.includes('auth-callback')) return
    const parsed = parseAuthCallback(url)
    try {
      if (parsed?.type === 'tokens') {
        await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        })
      } else if (parsed?.type === 'code') {
        await supabase.auth.exchangeCodeForSession(parsed.code)
      }
    } catch (err) {
      console.error('Native auth callback failed:', err)
    } finally {
      try {
        await Browser.close()
      } catch {
        // Browser may already be closed; ignore.
      }
    }
  })

  return () => {
    void listenerPromise.then((listener) => listener.remove())
  }
}

// Native Google sign-in: open the provider page in the system browser and let
// the deep-link listener above complete the session on return.
export async function signInWithGoogleNative(supabase) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (data?.url) await Browser.open({ url: data.url })
}
