import { NextRequest } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { buildOrderPrintAndLabelHtml, requestOriginFromNext } from '@/lib/orders/fetch-order-for-print-html'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const origin = requestOriginFromNext(request)
  const preview = new URL(request.url).searchParams.get('preview') === '1'
  const result = await buildOrderPrintAndLabelHtml(auth.supabase, orderId, origin, {
    cupomAutoPrint: !preview,
  })
  if (result.status === 404) {
    return new Response('Ordem não encontrada', { status: 404 })
  }
  if (result.status !== 200 || !result.cupomHtml) {
    return new Response('Erro ao gerar cupom', { status: 500 })
  }

  return new Response(result.cupomHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
