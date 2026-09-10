import { init, captureException } from '@sentry/react'

init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE, tracesSampleRate: 0.1 })
export { captureException }
