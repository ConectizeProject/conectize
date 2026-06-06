import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  findEvolutionHubByConnectionId,
  findEvolutionHubByInstance,
  type WhatsappEvolutionHubMetadata,
  WHATSAPP_EVOLUTION_PLATFORM_ID,
} from '@/lib/whatsapp/evolution-hub-config'
import { analyzeEvolutionWebhookPayload } from '@/lib/whatsapp/parse-evolution-webhook'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico: hub (por connection_id ou primeira instância), env e webhooks 24h.
 */
export async function GET (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const connectionId = url.searchParams.get('connection_id')?.trim() || ''

  let hubRow: { id: string; metadata: unknown } | null = null

  if (connectionId) {
    const { data } = await auth.supabase
      .from('hub_connections')
      .select('id, metadata')
      .eq('id', connectionId)
      .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
      .eq('organization_id', auth.organizationId)
      .maybeSingle()
    hubRow = data
  } else {
    const { data } = await auth.supabase
      .from('hub_connections')
      .select('id, metadata')
      .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    hubRow = data
  }

  const meta = (hubRow?.metadata as WhatsappEvolutionHubMetadata | null) || {}
  const instanceName = String(meta.instance_name || '').trim()

  let serviceOk = false
  let hubByInstance: Awaited<ReturnType<typeof findEvolutionHubByInstance>> = null
  try {
    const svc = createSupabaseServiceClient()
    serviceOk = true
    if (connectionId) {
      hubByInstance = await findEvolutionHubByConnectionId(svc, connectionId, auth.organizationId)
    } else if (instanceName) {
      hubByInstance = await findEvolutionHubByInstance(svc, instanceName)
    }
  } catch {
    serviceOk = false
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let webhookQuery = auth.supabase
    .from('integration_webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', auth.organizationId)
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
    .gte('created_at', since)

  if (instanceName) {
    webhookQuery = webhookQuery.eq('external_id', instanceName)
  }

  const { count: webhookCount } = await webhookQuery

  let lastWebhookQuery = auth.supabase
    .from('integration_webhooks')
    .select('event_type, external_id, created_at, payload')
    .eq('organization_id', auth.organizationId)
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
    .order('created_at', { ascending: false })
    .limit(1)

  if (instanceName) {
    lastWebhookQuery = lastWebhookQuery.eq('external_id', instanceName)
  }

  const { data: lastWebhook } = await lastWebhookQuery.maybeSingle()

  let lastPayloadAnalysis: ReturnType<typeof analyzeEvolutionWebhookPayload> | null = null
  if (lastWebhook?.payload && typeof lastWebhook.payload === 'object') {
    lastPayloadAnalysis = analyzeEvolutionWebhookPayload(
      lastWebhook.payload as Record<string, unknown>,
    )
  }

  let convQuery = auth.supabase
    .from('whatsapp_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', auth.organizationId)

  if (hubRow?.id) {
    convQuery = convQuery.eq('hub_connection_id', hubRow.id)
  }

  const { count: convCount } = await convQuery

  const hints: string[] = []

  if (!serviceOk) {
    hints.push(
      'SUPABASE_SERVICE_ROLE_KEY ausente ou inválida no Next — o webhook não grava mensagens.',
    )
  }
  if (!instanceName) {
    hints.push('Salve o hub com o nome da instância (ex.: conectize-prod).')
  } else if (!hubByInstance && serviceOk) {
    hints.push(
      `O servidor não encontrou hub para a instância "${instanceName}" — confira o nome exato na Evolution.`,
    )
  }
  if ((webhookCount ?? 0) === 0) {
    hints.push(
      instanceName
        ? `Nenhum webhook da instância "${instanceName}" nas últimas 24h. Se a Evolution está no Docker, use http://host.docker.internal:3000/... em vez de localhost.`
        : 'Nenhum webhook Evolution chegou nas últimas 24h nesta organização. Se a Evolution está no Docker, use http://host.docker.internal:3000/... em vez de localhost.',
    )
  } else if ((convCount ?? 0) === 0) {
    hints.push(
      'Webhooks chegaram, mas não há conversas nesta instância — confira a análise do último payload abaixo.',
    )
  }
  if (lastPayloadAnalysis?.from_me === true) {
    hints.push(
      'O último webhook era mensagem enviada por você (fromMe). Envie do outro celular para testar entrada.',
    )
  }
  if (
    lastPayloadAnalysis &&
    lastPayloadAnalysis.is_messages_upsert &&
    lastPayloadAnalysis.parsed_inbound_count === 0 &&
    lastPayloadAnalysis.from_me !== true
  ) {
    hints.push(
      `Último MESSAGES_UPSERT não virou inbox (tipo: ${lastPayloadAnalysis.message_type || 'desconhecido'}). Tente enviar texto simples.`,
    )
  }
  if (
    lastPayloadAnalysis?.instance &&
    instanceName &&
    lastPayloadAnalysis.instance.trim().toLowerCase() !== instanceName.toLowerCase()
  ) {
    hints.push(
      `Instância no webhook ("${lastPayloadAnalysis.instance}") difere do hub ("${instanceName}").`,
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || ''

  return NextResponse.json({
    ok: true,
    organization_id: auth.organizationId,
    hub: {
      connection_id: hubRow?.id ?? null,
      saved: Boolean(hubRow?.id),
      instance_name: instanceName,
      service_finds_hub: Boolean(hubByInstance),
    },
    env: {
      has_evolution_api_url: Boolean(process.env.WHATSAPP_EVOLUTION_API_URL?.trim()),
      has_evolution_api_key: Boolean(process.env.WHATSAPP_EVOLUTION_API_KEY?.trim()),
      has_service_role: serviceOk,
      webhook_secret_configured: Boolean(process.env.WHATSAPP_EVOLUTION_WEBHOOK_SECRET?.trim()),
      next_public_site_url: siteUrl || null,
    },
    last_24h: {
      integration_webhooks: webhookCount ?? 0,
      whatsapp_conversations: convCount ?? 0,
      last_webhook: lastWebhook
        ? {
            event_type: lastWebhook.event_type,
            instance: lastWebhook.external_id,
            at: lastWebhook.created_at,
          }
        : null,
      last_payload_analysis: lastPayloadAnalysis,
    },
    hints,
  })
}
