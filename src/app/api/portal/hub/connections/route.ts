import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase, userId: user.id }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
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
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const platformId = String(body?.platform_id || body?.platformId || '').trim()
  const apiKey = String(body?.api_key || body?.apiKey || '').trim()

  const allowedPlatforms = ['chatgpt']
  if (!platformId || !allowedPlatforms.includes(platformId)) {
    return NextResponse.json({ ok: false, error: 'platform_invalid' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'api_key_required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('hub_connections')
    .upsert(
      {
        platform_id: platformId,
        api_key: apiKey,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        metadata: {},
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'platform_id' }
    )
    .select('id, platform_id')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, connection: data })
}
