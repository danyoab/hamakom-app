const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const appConfig = {
  hasSupabaseUrl: Boolean(supabaseUrl),
  hasSupabaseAnonKey: Boolean(supabaseAnonKey),
  hasSupabaseConfig: Boolean(supabaseUrl && supabaseAnonKey),
}

export function getDeploymentWarnings() {
  const warnings = []

  if (!appConfig.hasSupabaseConfig) {
    warnings.push('Supabase env vars are missing. Auth, analytics, feedback, and cloud data will not work in production.')
  }

  return warnings
}

export function isAdminUser(authUser) {
  return authUser?.app_metadata?.role === 'admin'
}
