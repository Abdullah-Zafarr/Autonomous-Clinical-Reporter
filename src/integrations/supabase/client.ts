import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

const CANONICAL_SUPABASE_URL = 'https://ecjbflirovcqqoqnzlsc.supabase.co'
const CANONICAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjamJmbGlyb3ZjcXFvcW56bHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MTc4NjYsImV4cCI6MjEwMzQ5Mzg2Nn0.OAzMLYJ1GutPxHJ0xxn_CuSnxqawYa9DdLYwlUj6nBk'

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

const isLegacyOrEmpty = !rawUrl || rawUrl.includes('mbskxsigmaduwywvluin')
const url = isLegacyOrEmpty ? CANONICAL_SUPABASE_URL : rawUrl
const key = isLegacyOrEmpty ? CANONICAL_SUPABASE_ANON_KEY : rawKey

export const supabase = createBrowserClient<Database>(url, key)
