const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const adminPin = import.meta.env.VITE_ADMIN_PIN || '1234'

export const appConfig = {
  hasSupabaseUrl: Boolean(supabaseUrl),
  hasSupabaseAnonKey: Boolean(supabaseAnonKey),
  hasSupabaseConfig: Boolean(supabaseUrl && supabaseAnonKey),
  isDefaultAdminPin: adminPin === '1234',
  adminPin,
}

export function getDeploymentWarnings() {
  const warnings = []

  if (!appConfig.hasSupabaseConfig) {
    warnings.push('Supabase env vars are missing. Auth, analytics, feedback, and cloud data will not work in production.')
  }

  if (appConfig.isDefaultAdminPin) {
    warnings.push('VITE_ADMIN_PIN is still using the default 1234. Change it before deployment.')
  }

  return warnings
}
