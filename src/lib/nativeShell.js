import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNativeApp } from './native'

let backHandler = null

/** App registers a handler; return true if the back press was consumed. */
export function setNativeBackHandler(fn) {
  backHandler = fn
}

function parseAppPath(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.pathname
  } catch {
    const schemeIndex = url.indexOf('://')
    if (schemeIndex === -1) return null
    const pathStart = url.indexOf('/', schemeIndex + 3)
    return pathStart === -1 ? '/' : url.slice(pathStart).split('?')[0].split('#')[0]
  }
}

/** Splash, status bar, hardware back, and universal-link routing in the native shell. */
export function initNativeShell({ onRoute } = {}) {
  if (!isNativeApp()) return () => {}

  void (async () => {
    try {
      await StatusBar.setStyle({ style: Style.Light })
      await StatusBar.setBackgroundColor({ color: '#F7F2E8' })
    } catch {
      // Status bar API varies by platform/version.
    }
    try {
      await SplashScreen.hide()
    } catch {
      // Splash may already be hidden.
    }
  })()

  const listeners = []

  listeners.push(
    CapApp.addListener('backButton', () => {
      if (backHandler?.()) return
      CapApp.exitApp()
    }),
  )

  if (onRoute) {
    listeners.push(
      CapApp.addListener('appUrlOpen', ({ url }) => {
        if (!url || url.includes('auth-callback')) return
        const path = parseAppPath(url)
        if (!path) return
        onRoute(path)
      }),
    )
  }

  return () => {
    for (const p of listeners) void p.then((l) => l.remove())
  }
}
