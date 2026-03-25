'use client'

import { useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

/**
 * Uma instância do cliente Supabase no browser (env ausente → null).
 */
export function useSupabaseBrowserClient (): SupabaseClient | null {
  return useMemo(() => {
    try {
      return createSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])
}
