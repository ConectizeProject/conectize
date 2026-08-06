import { NextRequest } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { PAYMENT_METHOD_TYPES, type PaymentMethodType } from '@/lib/pdv/cash-close-summary'
import { buildCashCloseReportHtmlForSession } from '@/lib/pdv/fetch-cash-close-report-html'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return new Response('Não autorizado', { status: auth.status })
  }

  const params = request.nextUrl.searchParams
  const sessionId = parseOptionalUuid(params.get('session_id'))
  const sellerName = String(params.get('seller') || '').trim() || null

  const countedCashRaw = params.get('counted_cash')
  const countedCashCents = countedCashRaw != null && countedCashRaw !== ''
    ? Math.max(0, Number(countedCashRaw) || 0)
    : null

  const countedByMethod: Partial<Record<PaymentMethodType, number>> = {}
  for (const type of PAYMENT_METHOD_TYPES) {
    if (type === 'dinheiro') continue
    const raw = params.get(`counted_${type}`)
    if (raw == null || raw === '') continue
    countedByMethod[type] = Math.max(0, Number(raw) || 0)
  }

  const result = await buildCashCloseReportHtmlForSession(auth, {
    sessionId,
    sellerName,
    countedCashCents,
    countedByMethod: Object.keys(countedByMethod).length > 0 ? countedByMethod : null,
  })

  if (result.status !== 200 || !result.html) {
    const message =
      result.error === 'cash_not_open'
        ? 'Caixa não está aberto'
        : result.error === 'session_not_found'
          ? 'Sessão não encontrada'
          : 'Erro ao gerar relatório'
    return new Response(message, { status: result.status })
  }

  return new Response(result.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
