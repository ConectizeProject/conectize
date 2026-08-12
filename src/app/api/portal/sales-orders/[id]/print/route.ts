import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { buildSalesOrderCupomHtml } from '@/lib/sales-orders/fetch-sales-order-cupom-html'

export async function GET (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return new Response('Não autorizado', { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return new Response('ID inválido', { status: 400 })
  }

  const preview = new URL(request.url).searchParams.get('preview') === '1'
  const result = await buildSalesOrderCupomHtml(
    auth.supabase,
    auth.organizationId,
    orderId,
    { autoPrint: !preview }
  )
  if (result.status === 404) {
    return new Response('Pedido não encontrado', { status: 404 })
  }
  if (result.status !== 200 || !result.html) {
    return new Response('Erro ao gerar cupom', { status: 500 })
  }

  return new Response(result.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
