import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/integrations/supabase/types'

export function createClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
  return createBrowserClient<Database>(url, key)
}
