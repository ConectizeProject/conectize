import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  buildQuotePrintHtml,
  requestOriginFromNext,
} from '@/lib/quotes/fetch-quote-for-print-html'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!token) {
    return new Response('Link inválido', { status: 400 })
  }

  let supabase
  try {
    supabase = createSupabaseServiceClient()
  } catch {
    return new Response('Indisponível', { status: 503 })
  }

  const { data: quote } = await supabase
    .from('quotes')
    .select('id')
    .eq('share_token', token)
    .maybeSingle()

  if (!quote?.id) {
    return new Response('Orçamento não encontrado', { status: 404 })
  }

  const origin = requestOriginFromNext(request)
  const result = await buildQuotePrintHtml(supabase, quote.id, origin)
  if (result.status !== 200 || !result.html) {
    return new Response('Erro ao gerar impressão', { status: result.status || 500 })
  }

  return new Response(result.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
