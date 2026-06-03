import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  findEvolutionHubByConnectionId,
  isLikelyEvolutionApiKey,
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
  type WhatsappEvolutionHubMetadata,
  WHATSAPP_EVOLUTION_PLATFORM_ID,
} from '@/lib/whatsapp/evolution-hub-config'
import {
  fetchEvolutionConnectQr,
  fetchEvolutionConnectionState,
} from '@/lib/whatsapp/evolution-instance-client'
import { hintForWhatsappSendError } from '@/lib/whatsapp/evolution-send-errors'

export const dynamic = 'force-dynamic'

function publicWebhookUrl (): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim()
  if (!u) return ''
  const base = u.startsWith('http') ? u.replace(/\/$/, '') : `https://${u.replace(/\/$/, '')}`
  return `${base}/api/webhooks/whatsapp-evolution`
}

type ResolvedCreds = {
  instanceName: string
  baseUrl: string
  apiKey: string
}

async function resolveCredentials (
  auth: Awaited<ReturnType<typeof requireAdmin>> & { ok: true },
  body: Record<string, unknown> | null,
): Promise<{ ok: true; creds: ResolvedCreds } | { ok: false; error: string; status: number; hint?: string }> {
  const connectionId = String(body?.connection_id || body?.connectionId || '').trim()
  const instanceFromBody = String(body?.instance_name || body?.instanceName || '').trim()
  const apiKeyFromBody = String(body?.api_key || body?.apiKey || '').trim()
  const baseOverride = String(body?.api_base_url_override || body?.apiBaseUrlOverride || '').trim()

  let meta: WhatsappEvolutionHubMetadata = {}
  let accessToken: string | null = null
  let instanceName = instanceFromBody

  if (connectionId) {
    const hub = await findEvolutionHubByConnectionId(
      auth.supabase,
      connectionId,
      auth.organizationId,
    )
    if (!hub) {
      return { ok: false, error: 'connection_not_found', status: 404 }
    }
    meta = hub.metadata
    accessToken = hub.access_token
    if (!instanceName) {
      instanceName = String(meta.instance_name || '').trim()
    }
  } else if (instanceFromBody) {
    meta = baseOverride ? { api_base_url_override: baseOverride } : {}
  }

  if (!instanceName) {
    return {
      ok: false,
      error: 'instance_name_required',
      status: 400,
      hint: 'Informe o nome da instância Evolution (ex.: conectize-prod).',
    }
  }

  if (baseOverride) {
    meta = { ...meta, api_base_url_override: baseOverride }
  }

  const baseUrl = resolveEvolutionApiBaseUrl(meta)
  const apiKey = apiKeyFromBody && isLikelyEvolutionApiKey(apiKeyFromBody)
    ? apiKeyFromBody
    : resolveEvolutionApiKey(accessToken)

  if (!baseUrl) {
    return {
      ok: false,
      error: 'evolution_url_not_configured',
      status: 400,
      hint: 'Defina WHATSAPP_EVOLUTION_API_URL no servidor ou a URL base no formulário.',
    }
  }

  if (!apiKey) {
    return {
      ok: false,
      error: 'api_key_required',
      status: 400,
      hint: 'Informe a API key da Evolution ou defina WHATSAPP_EVOLUTION_API_KEY no .env.',
    }
  }

  return {
    ok: true,
    creds: { instanceName, baseUrl, apiKey },
  }
}

function errorResponse (error: string, status: number, hint?: string) {
  return NextResponse.json({
    ok: false,
    error,
    hint: hint || hintForWhatsappSendError(error, 'evolution'),
  }, { status })
}

/** GET — estado da conexão (poll após exibir QR). */
export async function GET (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const resolved = await resolveCredentials(auth, params)
  if (!resolved.ok) {
    return errorResponse(resolved.error, resolved.status, resolved.hint)
  }

  const { creds } = resolved
  const stateRes = await fetchEvolutionConnectionState(creds)
  if (!stateRes.ok) {
    return errorResponse(stateRes.error, stateRes.status || 502)
  }

  return NextResponse.json({
    ok: true,
    instance_name: creds.instanceName,
    state: stateRes.state,
    connected: stateRes.state === 'open',
  })
}

/** POST — cria instância (se faltar), gera QR Code para pareamento. */
export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const checkOnly = body?.check_only === true || body?.checkOnly === true
  const resolved = await resolveCredentials(auth, body)
  if (!resolved.ok) {
    return errorResponse(resolved.error, resolved.status, resolved.hint)
  }

  const { creds } = resolved

  if (checkOnly) {
    const stateRes = await fetchEvolutionConnectionState(creds)
    if (!stateRes.ok) {
      return errorResponse(stateRes.error, stateRes.status || 502)
    }
    return NextResponse.json({
      ok: true,
      instance_name: creds.instanceName,
      state: stateRes.state,
      connected: stateRes.state === 'open',
    })
  }

  const webhookUrl = publicWebhookUrl()

  const result = await fetchEvolutionConnectQr({
    ...creds,
    webhookUrl: webhookUrl || undefined,
    createIfMissing: true,
  })

  if (!result.ok) {
    return errorResponse(result.error, result.status || 502)
  }

  return NextResponse.json({
    ok: true,
    instance_name: result.instance_name,
    state: result.state,
    connected: result.state === 'open',
    qr_base64: result.qr_base64,
    pairing_code: result.pairing_code,
    webhook_url: webhookUrl || null,
  })
}
