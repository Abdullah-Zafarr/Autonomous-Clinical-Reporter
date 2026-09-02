import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase = createBrowserClient<Database>(url, key)
