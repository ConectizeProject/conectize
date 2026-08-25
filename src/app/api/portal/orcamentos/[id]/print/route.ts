import { NextRequest } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import {
  buildQuotePrintHtml,
  requestOriginFromNext,
} from '@/lib/quotes/fetch-quote-for-print-html'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return new Response('Não autorizado', { status: auth.status })
  }

  const { id: rawId } = await params
  const quoteId = parseOptionalUuid(rawId)
  if (!quoteId) {
    return new Response('ID inválido', { status: 400 })
  }

  const origin = requestOriginFromNext(request)
  const result = await buildQuotePrintHtml(auth.supabase, quoteId, origin, {
    includeStatus: true,
  })
  if (result.status === 404) {
    return new Response('Orçamento não encontrado', { status: 404 })
  }
  if (result.status !== 200 || !result.html) {
    return new Response('Erro ao gerar impressão', { status: 500 })
  }

  return new Response(result.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
