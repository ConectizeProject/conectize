import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { blingClientIdFromMetadata } from '@/lib/integrations/bling/app-credentials'

const PLATFORM_ID = 'bling'

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const clientId = String(body?.clientId || body?.client_id || '').trim()
  const clientSecret = String(body?.clientSecret || body?.client_secret || '').trim()

  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'client_id_required' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from('hub_connections')
    .select('id, api_key, metadata')
    .eq('platform_id', PLATFORM_ID)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const previousMetadata = existing?.metadata && typeof existing.metadata === 'object'
    ? (existing.metadata as Record<string, unknown>)
    : {}
  const previousClientId = blingClientIdFromMetadata(previousMetadata)
  const previousSecret = String(existing?.api_key || '').trim()

  if (!clientSecret && !previousSecret) {
    return NextResponse.json({ ok: false, error: 'client_secret_required' }, { status: 400 })
  }

  const nextSecret = clientSecret || previousSecret
  const credentialsChanged = previousClientId !== clientId || (Boolean(clientSecret) && clientSecret !== previousSecret)
  const now = new Date().toISOString()
  const metadata: Record<string, unknown> = {
    ...previousMetadata,
    blingClientId: clientId,
  }

  if (credentialsChanged) {
    metadata.blingReconnectRequired = false
    metadata.blingReconnectReason = null
    metadata.blingReconnectAt = null
    metadata.blingLastRefreshError = null
  }

  const payload: Record<string, unknown> = {
    platform_id: PLATFORM_ID,
    organization_id: auth.organizationId,
    api_key: nextSecret,
    metadata,
    updated_at: now,
  }

  if (credentialsChanged || !existing) {
    payload.access_token = null
    payload.refresh_token = null
    payload.token_expires_at = null
  }

  const dbError = existing?.id
    ? (await auth.supabase
      .from('hub_connections')
      .update(payload)
      .eq('id', existing.id)
      .eq('organization_id', auth.organizationId)).error
    : (await auth.supabase
      .from('hub_connections')
      .insert({
        ...payload,
        created_by: auth.userId,
      })).error

  if (dbError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    clientId,
    hasClientSecret: true,
    credentialsChanged,
  })
}
