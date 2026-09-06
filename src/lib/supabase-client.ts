import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/integrations/supabase/types'
import { getSupabaseConfig } from '@/lib/supabase-config'

export function createClient() {
  const { url, key } = getSupabaseConfig()
  return createBrowserClient<Database>(url, key)
}
