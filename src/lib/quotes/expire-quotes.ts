import type { SupabaseClient } from '@supabase/supabase-js'
import { saoPauloYmd } from '@/lib/quotes/quote-dates'
import { effectiveQuoteStatus, QUOTE_EXPIRE_ELIGIBLE_SET } from '@/lib/quotes/quote-status'

function logQuoteExpireIssue (scope: string, error: { message?: string; code?: string } | null) {
  const message = String(error?.message || '').trim()
  const code = String(error?.code || '').trim()
  if (!message && !code) return
  console.warn(`[quotes] ${scope}: ${code}${code && message ? ' ' : ''}${message}`.trim())
}

export async function expireOverdueQuoteById (
  supabase: SupabaseClient,
  quoteId: string,
): Promise<string | null> {
  const today = saoPauloYmd()
  const { data, error } = await supabase
    .from('quotes')
    .select('id, status, valid_until')
    .eq('id', quoteId)
    .maybeSingle()

  if (error) {
    logQuoteExpireIssue('expire one select', error)
    return null
  }
  if (!data) return null

  const status = String(data.status || '')
  const validUntil = String(data.valid_until || '').slice(0, 10)
  const next = effectiveQuoteStatus(status, validUntil, today)
  if (next === 'expirado' && QUOTE_EXPIRE_ELIGIBLE_SET.has(status)) {
    const { error: upErr } = await supabase
      .from('quotes')
      .update({ status: 'expirado' })
      .eq('id', quoteId)
    if (upErr) {
      logQuoteExpireIssue('expire one update', upErr)
    }
    return 'expirado'
  }
  return status
}
