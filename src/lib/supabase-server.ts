import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { Database } from '@/integrations/supabase/types'

const CANONICAL_SUPABASE_URL = 'https://ecjbflirovcqqoqnzlsc.supabase.co'
const CANONICAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjamJmbGlyb3ZjcXFvcW56bHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MTc4NjYsImV4cCI6MjEwMzQ5Mzg2Nn0.OAzMLYJ1GutPxHJ0xxn_CuSnxqawYa9DdLYwlUj6nBk'

export const createClient = cache(async () => {
  const cookieStore = await cookies()

  const rawUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

  const isLegacyOrEmpty = !rawUrl || rawUrl.includes('mbskxsigmaduwywvluin')
  const url = isLegacyOrEmpty ? CANONICAL_SUPABASE_URL : rawUrl
  const key = isLegacyOrEmpty ? CANONICAL_SUPABASE_ANON_KEY : rawKey

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
  })
