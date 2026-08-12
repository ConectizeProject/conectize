import type { createSupabaseServerClient } from '@/lib/supabase/server'

type PortalSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

export type TradeInDeviceInput = {
  device_name: string
  imei: string | null
  info: string | null
  condition: string | null
  value_cents: number
}

export type TradeInDeviceRecord = TradeInDeviceInput & {
  id: string
  received_device_id: string | null
  sort_order: number
}

function cleanText (value: unknown): string {
  return String(value ?? '').trim()
}

function toCents (value: unknown, alreadyCents = false): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return alreadyCents ? Math.round(value) : Math.round(value * 100)
  }
  const s = String(value).trim().replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(s)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

export function parseTradeInDevices (
  body: Record<string, unknown>,
): { ok: true; lines: TradeInDeviceInput[] } | { ok: false; error: string } {
  const raw = body.trade_in_devices
  if (raw === undefined || raw === null) {
    return { ok: true, lines: [] }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'invalid_trade_in_devices' }
  }

  const lines: TradeInDeviceInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'invalid_trade_in_devices' }
    }
    const o = item as Record<string, unknown>
    const deviceName = cleanText(o.device_name)
    if (!deviceName) {
      return { ok: false, error: 'trade_in_name_required' }
    }
    const valueCents = toCents(o.value_cents ?? o.value, !!o.value_cents)
    if (valueCents === null || valueCents <= 0) {
      return { ok: false, error: 'trade_in_value_required' }
    }
    lines.push({
      device_name: deviceName,
      imei: cleanText(o.imei) || null,
      info: cleanText(o.info) || null,
      condition: cleanText(o.condition) || null,
      value_cents: valueCents,
    })
  }

  return { ok: true, lines }
}

export async function loadTradeInsForSaleDevice (
  supabase: PortalSupabase,
  saleDeviceId: string,
): Promise<TradeInDeviceRecord[]> {
  const { data, error } = await supabase
    .from('resale_device_trade_ins')
    .select('id, device_name, imei, info, condition, value_cents, received_device_id, sort_order')
    .eq('sale_device_id', saleDeviceId)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id as string,
    device_name: (row.device_name as string) || '',
    imei: (row.imei as string | null) ?? null,
    info: (row.info as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
    value_cents: Number(row.value_cents) || 0,
    received_device_id: (row.received_device_id as string | null) ?? null,
    sort_order: Number(row.sort_order) || 0,
  }))
}

function isMissingTableError (err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || '').toLowerCase()
  return (
    code === '42P01'
    || code === 'PGRST205'
    || msg.includes('resale_device_trade_ins')
    || (msg.includes('relation') && msg.includes('does not exist'))
  )
}

export async function insertTradeInDevicesOnSale (opts: {
  supabase: PortalSupabase
  organizationId: string
  saleDeviceId: string
  saleDate: string | null
  lines: TradeInDeviceInput[]
}): Promise<
  | { ok: true }
  | { ok: false; error: string; step?: string; detail?: string }
> {
  const { supabase, organizationId, saleDeviceId, saleDate, lines } = opts
  if (lines.length === 0) return { ok: true }

  const purchaseDate = saleDate || new Date().toISOString().slice(0, 10)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const { data: inserted, error: deviceErr } = await supabase
      .from('resale_devices')
      .insert({
        organization_id: organizationId,
        device_name: line.device_name,
        imei: line.imei,
        info: line.info,
        condition: line.condition,
        purchase_value_cents: line.value_cents,
        purchase_date: purchaseDate,
        sold: false,
        stock_type: 'seminovo',
        advertised: false,
        tested: false,
        image_gallery_paths: [],
      })
      .select('id')
      .single()

    if (deviceErr || !inserted?.id) {
      console.error('[resale-trade-in device insert]', {
        organizationId,
        saleDeviceId,
        lineIndex: i,
        deviceErr,
      })
      return {
        ok: false,
        error: 'trade_in_device_failed',
        step: 'resale_devices',
        detail: deviceErr?.message,
      }
    }

    const { error: linkErr } = await supabase.from('resale_device_trade_ins').insert({
      organization_id: organizationId,
      sale_device_id: saleDeviceId,
      received_device_id: inserted.id,
      device_name: line.device_name,
      imei: line.imei,
      info: line.info,
      condition: line.condition,
      value_cents: line.value_cents,
      sort_order: i,
    })

    if (linkErr) {
      console.error('[resale-trade-in link insert]', {
        organizationId,
        saleDeviceId,
        receivedDeviceId: inserted.id,
        lineIndex: i,
        linkErr,
      })
      if (isMissingTableError(linkErr)) {
        return {
          ok: false,
          error: 'trade_in_table_missing',
          step: 'resale_device_trade_ins',
          detail: linkErr.message,
        }
      }
      return {
        ok: false,
        error: 'trade_in_link_failed',
        step: 'resale_device_trade_ins',
        detail: linkErr.message,
      }
    }
  }

  return { ok: true }
}

export function sumTradeInCents (lines: TradeInDeviceInput[]): number {
  return lines.reduce((acc, l) => acc + l.value_cents, 0)
}
