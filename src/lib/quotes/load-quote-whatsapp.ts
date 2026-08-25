import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'
import { getSiteUrl } from '@/lib/utils/site-url'
import {
  listEvolutionHubsForOrganization,
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
  type EvolutionHubRow,
} from '@/lib/whatsapp/evolution-hub-config'
import { pickEvolutionHubForAutoMessages } from '@/lib/whatsapp/evolution-auto-messages'
import { buildQuoteMessage } from '@/lib/quotes/quote-share-message'
import { getQuoteStatusLabel } from '@/lib/quotes/quote-status'

type QuoteCustomer = {
  is_company?: boolean | null
  full_name?: string | null
  company_name?: string | null
  trade_name?: string | null
  mobile_phone?: string | null
  contact_phone?: string | null
}

export type QuoteWhatsappContext = {
  quoteId: string
  organizationId: string
  displayNumber: string
  title: string
  status: string
  statusLabel: string
  validUntil: string | null
  shareToken: string | null
  link: string
  customerName: string
  toTarget: string
  organizationName: string
  totalCents: number
  evolutionReady: EvolutionHubRow | null
}

function firstRel<T> (value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function customerFullName (customer: QuoteCustomer | null): string {
  if (!customer) return ''
  if (customer.is_company) {
    return String(
      customer.company_name || customer.trade_name || customer.full_name || '',
    ).trim()
  }
  return String(customer.full_name || customer.company_name || '').trim()
}

function pickEvolutionHubForSend (
  hubs: EvolutionHubRow[],
): EvolutionHubRow | null {
  const ready = hubs.filter((h) => {
    const instanceName = String(h.metadata.instance_name || '').trim()
    const apiKey = resolveEvolutionApiKey(h.access_token)
    const baseUrl = resolveEvolutionApiBaseUrl(h.metadata)
    return Boolean(instanceName && apiKey && baseUrl)
  })
  if (ready.length === 0) return null
  const withAutoMessages = ready.filter(
    (h) => h.metadata.auto_messages_enabled === true,
  )
  const pool = withAutoMessages.length > 0 ? withAutoMessages : ready
  return (
    pool.find((h) => h.metadata.preferred_for_messages === true) ?? pool[0]
  )
}

async function ensureShareToken (
  supabase: SupabaseClient,
  quoteId: string,
  current: string | null,
): Promise<string | null> {
  const existing = String(current || '').trim()
  if (existing) return existing
  const token = randomUUID()
  const { error } = await supabase
    .from('quotes')
    .update({ share_token: token })
    .eq('id', quoteId)
  if (error) {
    console.error('[quote-whatsapp] share_token', error)
    return null
  }
  return token
}

export async function loadQuoteWhatsappContext (
  supabase: SupabaseClient,
  quoteIdRaw: string,
): Promise<QuoteWhatsappContext | null> {
  const quoteId = String(quoteIdRaw || '').trim()
  if (!quoteId) return null

  const { data: quote, error } = await supabase
    .from('quotes')
    .select(
      `id, organization_id, display_number, title, status, valid_until, share_token, items_total_cents,
       customers ( full_name, company_name, trade_name, is_company, mobile_phone, contact_phone )`,
    )
    .eq('id', quoteId)
    .maybeSingle()

  if (error) {
    console.error('[quote-whatsapp] fetch', error)
    return null
  }
  if (!quote) return null

  const organizationId = String(quote.organization_id || '').trim()
  if (!organizationId) return null

  const customer = firstRel(
    quote.customers as QuoteCustomer | QuoteCustomer[] | null,
  )
  const phoneRaw = String(
    customer?.mobile_phone || customer?.contact_phone || '',
  ).trim()
  const toTarget = formatPhoneForWhatsApp(phoneRaw)

  const shareToken = await ensureShareToken(
    supabase,
    quoteId,
    quote.share_token != null ? String(quote.share_token) : null,
  )
  const origin = getSiteUrl().replace(/\/$/, '')
  const link = shareToken ? `${origin}/orcamento/${shareToken}` : ''

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle()

  const evolutionHubs = await listEvolutionHubsForOrganization(
    supabase,
    organizationId,
  )
  const fullName = customerFullName(customer)
  const status = String(quote.status || '')

  return {
    quoteId,
    organizationId,
    displayNumber: String(quote.display_number ?? ''),
    title: String(quote.title || '').trim(),
    status,
    statusLabel: getQuoteStatusLabel(status),
    validUntil: quote.valid_until != null ? String(quote.valid_until).slice(0, 10) : null,
    shareToken,
    link,
    customerName: fullName,
    toTarget,
    organizationName: String(org?.name || '').trim(),
    totalCents: Math.max(0, Number(quote.items_total_cents) || 0),
    evolutionReady: pickEvolutionHubForSend(evolutionHubs) ?? pickEvolutionHubForAutoMessages(evolutionHubs),
  }
}

export function buildShareQuoteWhatsappMessage (ctx: QuoteWhatsappContext): string {
  return buildQuoteMessage({
    displayNumber: ctx.displayNumber,
    title: ctx.title,
    customerName: ctx.customerName,
    status: ctx.statusLabel,
    validUntil: ctx.validUntil,
    totalCents: ctx.totalCents,
    quoteHref: ctx.link,
    organizationName: ctx.organizationName,
  })
}
