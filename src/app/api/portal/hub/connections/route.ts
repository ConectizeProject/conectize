import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('hub_connections')
    .select('id, platform_id, metadata, created_at')
    .order('platform_id')

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, connections: data || [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const platformId = String(body?.platform_id || body?.platformId || '').trim()
  const apiKey = String(body?.api_key || body?.apiKey || '').trim()
  const model = String(body?.model || '').trim() || null

  const allowedPlatforms = ['chatgpt']
  if (!platformId || !allowedPlatforms.includes(platformId)) {
    return NextResponse.json({ ok: false, error: 'platform_invalid' }, { status: 400 })
  }

  // Se já existe conexão e só está atualizando o modelo, não precisa de api_key
  const { data: existing } = await auth.supabase
    .from('hub_connections')
    .select('api_key, metadata')
    .eq('platform_id', platformId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!existing && !apiKey) {
    return NextResponse.json({ ok: false, error: 'api_key_required' }, { status: 400 })
  }

  // Preserva metadata existente e atualiza apenas o modelo se fornecido
  const existingMetadata = (existing?.metadata as Record<string, unknown> | null) || {}
  const metadata: Record<string, unknown> = { ...existingMetadata }
  if (platformId === 'chatgpt' && model) {
    metadata.model = model
  }

  const updateData: Record<string, unknown> = {
    platform_id: platformId,
    organization_id: auth.organizationId,
    updated_at: new Date().toISOString(),
    metadata,
  }

  if (apiKey) {
    updateData.api_key = apiKey
  } else if (existing) {
    // Mantém a api_key existente se não foi fornecida
    updateData.api_key = existing.api_key
  }
  if (!existing) {
    updateData.created_by = auth.userId
    updateData.access_token = null
    updateData.refresh_token = null
    updateData.token_expires_at = null
  }

  let data: { id: string; platform_id: string } | null = null
  let error: { message?: string } | null = null

  if (existing) {
    const res = await auth.supabase
      .from('hub_connections')
      .update(updateData)
      .eq('platform_id', platformId)
      .eq('organization_id', auth.organizationId)
      .select('id, platform_id')
      .single()
    data = res.data
    error = res.error
  } else {
    const res = await auth.supabase
      .from('hub_connections')
      .insert(updateData)
      .select('id, platform_id')
      .single()
    data = res.data
    error = res.error
  }

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, connection: data })
}
