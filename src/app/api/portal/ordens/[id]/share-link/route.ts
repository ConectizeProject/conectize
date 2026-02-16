import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/portal/ordens/[id]/share-link
 * Retorna o link público da OS. Requer autenticação (staff).
 * Gera share_token se ainda não existir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const isStaff = role === 'admin' || role === 'staff'
  if (!isStaff) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data: order } = await supabase
    .from('service_orders')
    .select('id, share_token')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 })

  let token = order.share_token
  if (!token) {
    try {
      const serviceClient = createSupabaseServiceClient()
      token = crypto.randomUUID()
      const { error } = await serviceClient
        .from('service_orders')
        .update({ share_token: token })
        .eq('id', id)
      if (error) {
        console.error('[share-link] update error:', error)
        return NextResponse.json({ error: 'Erro ao gerar link' }, { status: 500 })
      }
    } catch (e) {
      console.error('[share-link] service client error:', e)
      return NextResponse.json({ error: 'Erro ao gerar link' }, { status: 500 })
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const baseUrl = siteUrl || 'http://localhost:3000'
  const url = `${baseUrl}/os/${token}`

  return NextResponse.json({ url })
}
