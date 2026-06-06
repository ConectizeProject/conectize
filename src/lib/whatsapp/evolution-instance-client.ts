import { formatEvolutionApiError } from '@/lib/whatsapp/evolution-send-errors'

export type EvolutionConnectionState = 'open' | 'close' | 'connecting' | 'unknown'

export type EvolutionConnectQrResult =
  | {
    ok: true
    state: EvolutionConnectionState
    qr_base64: string | null
    pairing_code: string | null
    instance_name: string
  }
  | {
    ok: false
    error: string
    status?: number
  }

const EVOLUTION_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'SEND_MESSAGE',
  'MESSAGES_DELETE',
] as const

async function evolutionFetch (
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: Record<string, unknown> | null; status: number } | { ok: false; error: string; status: number }> {
  const trimmedBase = baseUrl.replace(/\/$/, '')
  const url = `${trimmedBase}${path.startsWith('/') ? path : `/${path}`}`
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
        ...(init?.headers || {}),
      },
    })
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) {
      return {
        ok: false,
        error: formatEvolutionApiError(data, res.status),
        status: res.status,
      }
    }
    return { ok: true, data, status: res.status }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch_failed'
    return { ok: false, error: msg, status: 0 }
  }
}

export function parseEvolutionConnectionState (data: Record<string, unknown> | null): EvolutionConnectionState {
  if (!data) return 'unknown'
  const inst = data.instance
  if (inst && typeof inst === 'object') {
    const state = String((inst as { state?: unknown }).state || '').trim().toLowerCase()
    if (state === 'open' || state === 'close' || state === 'connecting') return state
  }
  const top = String(data.state || '').trim().toLowerCase()
  if (top === 'open' || top === 'close' || top === 'connecting') return top
  return 'unknown'
}

function parseQrFromConnectPayload (data: Record<string, unknown> | null): {
  qr_base64: string | null
  pairing_code: string | null
} {
  if (!data) return { qr_base64: null, pairing_code: null }
  const pairing = String(data.pairingCode || data.pairing_code || '').trim() || null
  let raw = data.base64 ?? data.qrcode ?? data.qrCode
  if (raw && typeof raw === 'object' && raw !== null) {
    const nested = raw as { base64?: unknown }
    raw = nested.base64
  }
  const base64Str = typeof raw === 'string' ? raw.trim() : ''
  if (!base64Str) return { qr_base64: null, pairing_code: pairing }
  if (base64Str.startsWith('data:image')) return { qr_base64: base64Str, pairing_code: pairing }
  return { qr_base64: `data:image/png;base64,${base64Str}`, pairing_code: pairing }
}

export async function fetchEvolutionConnectionState (opts: {
  baseUrl: string
  apiKey: string
  instanceName: string
}): Promise<{ ok: true; state: EvolutionConnectionState } | { ok: false; error: string; status?: number }> {
  const encoded = encodeURIComponent(opts.instanceName)
  const res = await evolutionFetch(
    opts.baseUrl,
    opts.apiKey,
    `/instance/connectionState/${encoded}`,
    { method: 'GET' },
  )
  if (res.ok === false) {
    return { ok: false, error: res.error, status: res.status }
  }
  return { ok: true, state: parseEvolutionConnectionState(res.data) }
}

async function instanceExists (opts: {
  baseUrl: string
  apiKey: string
  instanceName: string
}): Promise<boolean> {
  const res = await evolutionFetch(opts.baseUrl, opts.apiKey, '/instance/fetchInstances', { method: 'GET' })
  if (!res.ok || !res.data) return false
  const list = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data.instances)
      ? res.data.instances
      : []
  const target = opts.instanceName.trim().toLowerCase()
  return list.some((row) => {
    if (!row || typeof row !== 'object') return false
    const name = String(
      (row as { instanceName?: unknown; name?: unknown }).instanceName
      || (row as { name?: unknown }).name
      || '',
    ).trim().toLowerCase()
    return name === target
  })
}

export async function createEvolutionInstance (opts: {
  baseUrl: string
  apiKey: string
  instanceName: string
  webhookUrl?: string | null
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const body: Record<string, unknown> = {
    instanceName: opts.instanceName.trim(),
    integration: 'WHATSAPP-BAILEYS',
    qrcode: false,
  }
  const webhookUrl = String(opts.webhookUrl || '').trim()
  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: [...EVOLUTION_WEBHOOK_EVENTS],
    }
  }

  const res = await evolutionFetch(opts.baseUrl, opts.apiKey, '/instance/create', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (res.ok === true) return { ok: true }

  const low = res.error.toLowerCase()
  if (
    res.status === 409
    || res.status === 403
    || low.includes('already')
    || low.includes('exist')
  ) {
    return { ok: true }
  }

  return { ok: false, error: res.error, status: res.status }
}

export async function fetchEvolutionConnectQr (opts: {
  baseUrl: string
  apiKey: string
  instanceName: string
  webhookUrl?: string | null
  createIfMissing?: boolean
}): Promise<EvolutionConnectQrResult> {
  const instanceName = opts.instanceName.trim()
  if (!instanceName) {
    return { ok: false, error: 'instance_name_required' }
  }

  const stateRes = await fetchEvolutionConnectionState(opts)
  if (stateRes.ok && stateRes.state === 'open') {
    return {
      ok: true,
      state: 'open',
      qr_base64: null,
      pairing_code: null,
      instance_name: instanceName,
    }
  }

  if (opts.createIfMissing !== false) {
    const exists = await instanceExists(opts)
    if (!exists) {
      const created = await createEvolutionInstance({
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
        instanceName,
        webhookUrl: opts.webhookUrl,
      })
      if (created.ok === false) return { ok: false, error: created.error, status: created.status }
    }
  }

  const encoded = encodeURIComponent(instanceName)
  const connectRes = await evolutionFetch(
    opts.baseUrl,
    opts.apiKey,
    `/instance/connect/${encoded}`,
    { method: 'GET' },
  )

  if (connectRes.ok === false) {
    return { ok: false, error: connectRes.error, status: connectRes.status }
  }

  const { qr_base64, pairing_code } = parseQrFromConnectPayload(connectRes.data)
  const afterState = await fetchEvolutionConnectionState(opts)
  const state = afterState.ok ? afterState.state : 'connecting'

  return {
    ok: true,
    state: state === 'open' ? 'open' : qr_base64 ? 'connecting' : state,
    qr_base64,
    pairing_code,
    instance_name: instanceName,
  }
}
