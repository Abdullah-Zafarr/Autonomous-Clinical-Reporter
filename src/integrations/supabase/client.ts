import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

import { getSupabaseConfig } from "@/lib/supabase-config"

const { url, key } = getSupabaseConfig()

export const supabase = createBrowserClient<Database>(url, key)
