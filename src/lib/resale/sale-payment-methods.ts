type LooseRecord = Record<string, unknown>

export type SalePaymentRow = {
  payment_method_id: string
  value_cents?: number | null
  installments?: number
}

/** Extrai id da forma de pagamento de vários formatos (API, imports, camelCase). */
function pickPaymentMethodId (e: LooseRecord): string | null {
  const v =
    e.payment_method_id ??
    e.paymentMethodId ??
    e.paymentMethod_id ??
    e.pm_id ??
    e.uuid ??
    e.payment_method
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function normalizeArrayElement (e: unknown): unknown {
  if (typeof e === 'string') {
    const t = e.trim()
    if (!t) return null
    try {
      const p = JSON.parse(t) as unknown
      return p != null && typeof p === 'object' ? p : e
    } catch {
      return e
    }
  }
  return e
}

function pickInstallments (e: LooseRecord): number | undefined {
  const raw = e.installments ?? e.installment
  if (raw == null) return undefined
  return Math.max(1, Math.min(24, Number(raw) || 1))
}

function pickValueCents (e: LooseRecord): number | null {
  const raw = e.value_cents ?? e.valueCents
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (Number.isNaN(n) || n < 0) return null
  return Math.round(n)
}

/** Aceita jsonb como array, string JSON (inclusive dupla codificação) ou objeto com chaves "0","1",… */
export function coerceRawSalePaymentsToArray (raw: unknown): unknown[] {
  let cur: unknown = raw
  let guard = 0
  while (typeof cur === 'string' && guard++ < 6) {
    const t = cur.trim()
    if (!t) return []
    try {
      cur = JSON.parse(t) as unknown
    } catch {
      return []
    }
  }
  if (cur == null) return []
  if (Array.isArray(cur)) {
    return cur
      .map(normalizeArrayElement)
      .filter((e) => e != null && typeof e === 'object' && !Array.isArray(e))
  }
  if (typeof cur === 'object' && !Array.isArray(cur)) {
    const o = cur as Record<string, unknown>
    const keys = Object.keys(o).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b))
    if (keys.length > 0) {
      return keys
        .map((k) => normalizeArrayElement(o[k]))
        .filter((e) => e != null && typeof e === 'object' && !Array.isArray(e))
    }
  }
  return []
}

export function mapLooseEntryToSalePaymentRow (e: unknown): SalePaymentRow | null {
  if (e == null || typeof e !== 'object' || Array.isArray(e)) return null
  const o = e as LooseRecord
  const payment_method_id = pickPaymentMethodId(o)
  if (!payment_method_id) return null
  const installments = pickInstallments(o)
  const value_cents = pickValueCents(o)
  return {
    payment_method_id,
    installments: installments ?? 1,
    value_cents,
  }
}

type DeviceLike = {
  sale_payment_methods?: unknown
  payment_method_id?: string | null
  payment_installments?: number | null
}

/** Lista para exibição no termo: jsonb completo ou legado só com payment_method_id. */
export function getSalePaymentListFromDevice (device: DeviceLike): SalePaymentRow[] {
  const fromRaw = coerceRawSalePaymentsToArray(device.sale_payment_methods)
  const mapped = fromRaw
    .map(mapLooseEntryToSalePaymentRow)
    .filter((x): x is SalePaymentRow => x != null)
  if (mapped.length > 0) return mapped
  if (device.payment_method_id && String(device.payment_method_id).trim()) {
    return [{
      payment_method_id: String(device.payment_method_id).trim(),
      installments: device.payment_installments != null ? Math.max(1, Number(device.payment_installments) || 1) : 1,
      value_cents: null,
    }]
  }
  return []
}

/**
 * Normaliza o payload PATCH. `undefined` = não alterar coluna; array (incl. []) = gravar.
 * Formatos inválidos (não-array) não apagam o que já está no banco.
 */
export function normalizeSalePaymentMethodsForPersistence (
  raw: unknown
): Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }> | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return undefined
  if (Array.isArray(raw)) {
    return raw
      .filter((e) => e && typeof e === 'object')
      .map((e) => {
        const o = e as LooseRecord
        const payment_method_id = pickPaymentMethodId(o)
        if (!payment_method_id) return null
        const installments = pickInstallments(o)
        const value_cents = pickValueCents(o)
        return {
          payment_method_id,
          installments: installments ?? 1,
          value_cents: value_cents != null ? Math.max(0, value_cents) : null,
        }
      })
      .filter((e) => e != null)
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return undefined
    try {
      const p = JSON.parse(t) as unknown
      return normalizeSalePaymentMethodsForPersistence(p)
    } catch {
      return undefined
    }
  }
  return undefined
}
