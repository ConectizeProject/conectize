import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { blingClientIdFromMetadata } from '@/lib/integrations/bling/app-credentials'

const PLATFORM_ID = 'bling'

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as {
    clientId?: string
    client_id?: string
    clientSecret?: string
    client_secret?: string
    connectionId?: string
  } | null
  const clientId = String(body?.clientId || body?.client_id || '').trim()
  const clientSecret = String(body?.clientSecret || body?.client_secret || '').trim()
  const connectionId = String(body?.connectionId || '').trim()

  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'client_id_required' }, { status: 400 })
  }

  const existingQuery = auth.supabase
    .from('hub_connections')
    .select('id, api_key, metadata')
    .eq('platform_id', PLATFORM_ID)
    .eq('organization_id', auth.organizationId)

  const { data: existing, error: existingError } = connectionId
    ? await existingQuery.eq('id', connectionId).maybeSingle()
    : { data: null, error: null }

  if (existingError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (connectionId && !existing?.id) {
    return NextResponse.json({ ok: false, error: 'connection_not_found' }, { status: 404 })
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

  let savedId = existing?.id || ''
  if (existing?.id) {
    const { error: updateError } = await auth.supabase
      .from('hub_connections')
      .update(payload)
      .eq('id', existing.id)
      .eq('organization_id', auth.organizationId)
    if (updateError) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
  } else {
    const { data: inserted, error: insertError } = await auth.supabase
      .from('hub_connections')
      .insert({
        ...payload,
        created_by: auth.userId,
      })
      .select('id')
      .single()
    if (insertError || !inserted?.id) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    savedId = String(inserted.id)
  }

  return NextResponse.json({
    ok: true,
    connectionId: savedId,
    clientId,
    hasClientSecret: true,
    credentialsChanged: credentialsChanged || !existing?.id,
  })
}
