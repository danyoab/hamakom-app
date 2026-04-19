import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase = null

try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey)
  }
} catch (e) {
  console.error('Supabase init failed:', e)
}

export { supabase }
