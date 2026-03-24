import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

const OPEN_STATUSES = [
  'orcamento', 'aguardando_aprovacao', 'aprovado',
  'aguardando_pecas', 'em_manutencao', 'aguardando_retirada',
] as const

const FINALIZED_STATUSES = [
  'finalizada', 'finalizada_sem_conserto', 'finalizada_sem_aprovacao', 'cancelada',
] as const

const FINANCIAL_KEYWORDS = /faturamento|receita|financeiro|financeiros|lucro|custo total|valor total|vendas em|faturamento do|receita do|resumo financeiro|custos|faturamento do mês|receita do mês/i

async function fetchOrderStats(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const [openRes, closedRes, todayRes] = await Promise.all([
    supabase.from('service_orders').select('id', { count: 'exact', head: true }).in('status', [...OPEN_STATUSES]),
    supabase.from('service_orders').select('id', { count: 'exact', head: true }).in('status', [...FINALIZED_STATUSES]),
    supabase
      .from('service_orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
      .lt('created_at', new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T00:00:00.000Z'),
  ])

  const openCount = openRes.count ?? 0
  const closedCount = closedRes.count ?? 0
  const createdToday = todayRes.count ?? 0

  const { data: byStatus } = await supabase
    .from('service_orders')
    .select('status')
    .in('status', [...OPEN_STATUSES, ...FINALIZED_STATUSES])

  const countByStatus: Record<string, number> = {}
  for (const row of byStatus || []) {
    const s = (row as { status: string }).status
    countByStatus[s] = (countByStatus[s] || 0) + 1
  }

  return {
    ordens_abertas: openCount,
    ordens_finalizadas_total: closedCount,
    ordens_criadas_hoje: createdToday,
    por_status: countByStatus,
  }
}

async function fetchCustomerCount(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
  return { total_clientes: count ?? 0 }
}

/** Detecta se a pergunta pede resumo/detalhe de ordem e extrai display_number se houver */
function parseOrderRequest(message: string): { wantSummary: boolean; displayNumber: number | null } {
  const lower = message.toLowerCase().trim()
  const resumo = /\b(resum(a|e|o)|detalhe(s)?|fale\s+(da|sobre)|conte\s+(da|sobre)|última(s)?|uma\s+os|uma\s+ordem)\b/i.test(lower)
  const osNum = message.match(/\b(?:os|ordem|#)\s*(\d{1,8})\b/i)
  const num = osNum ? parseInt(osNum[1], 10) : null
  return { wantSummary: resumo || num !== null, displayNumber: num ?? null }
}

/** Busca uma ou mais ordens para resumo: por display_number ou últimas N */
async function fetchOrdersForSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  message: string
): Promise<Array<Record<string, unknown>>> {
  const { wantSummary, displayNumber } = parseOrderRequest(message)
  if (!wantSummary) return []

  let query = supabase
    .from('service_orders')
    .select(
      'id, display_number, status, title, created_at, closed_at, services, services_total_cents, services_cost_total_cents, brand, model, customer_description, receiving_notes, customers(full_name, company_name, trade_name), device_models(model, device_types(name, device_brands(name)))'
    )
    .order('created_at', { ascending: false })

  if (displayNumber !== null) {
    query = query.eq('display_number', displayNumber).limit(1)
  } else {
    query = query.limit(5)
  }

  const { data: rows } = await query

  if (!rows || rows.length === 0) return []

  return rows.map((row: Record<string, unknown>) => {
    const cust = row.customers as Record<string, unknown> | null
    const name = cust
      ? (String(cust.company_name || cust.trade_name || cust.full_name || '').trim() || 'Cliente')
      : 'Cliente'
    const dm = row.device_models as Record<string, unknown> | null
    const dt = dm?.device_types as Record<string, unknown> | null
    const db = dt?.device_brands as Record<string, unknown> | null
    const device =
      row.brand && row.model
        ? `${row.brand} ${row.model}`
        : dm?.model && db?.name
          ? `${db.name} ${dm.model}`
          : (row.brand || row.model || dt?.name || '')?.toString() || 'Aparelho não informado'
    return {
      display_number: row.display_number,
      status: row.status,
      title: row.title,
      cliente: name,
      aparelho: device,
      created_at: row.created_at,
      closed_at: row.closed_at ?? null,
      descricao_cliente: (row.customer_description as string)?.slice(0, 300) || null,
      observacoes_recebimento: (row.receiving_notes as string)?.slice(0, 200) || null,
      services: row.services,
      valor_total_centavos: row.services_total_cents,
      custo_total_centavos: row.services_cost_total_cents,
    }
  })
}

async function fetchFinancialSummary(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const fromIso = startOfMonth.toISOString()
  const toIso = endOfMonth.toISOString()

  const { data: closed } = await supabase
    .from('service_orders')
    .select('services_total_cents, services_cost_total_cents')
    .in('status', [...FINALIZED_STATUSES])
    .gte('closed_at', fromIso)
    .lte('closed_at', toIso)

  let faturamento_cents = 0
  let custo_cents = 0
  for (const o of closed || []) {
    const g = (o as { services_total_cents?: number }).services_total_cents ?? 0
    const c = (o as { services_cost_total_cents?: number }).services_cost_total_cents ?? 0
    if (Number.isFinite(g)) faturamento_cents += Number(g)
    if (Number.isFinite(c)) custo_cents += Number(c)
  }

  const qtd_finalizadas_mes = closed?.length ?? 0
  return {
    periodo: `${startOfMonth.toLocaleDateString('pt-BR')} a ${endOfMonth.toLocaleDateString('pt-BR')}`,
    ordens_finalizadas_no_mes: qtd_finalizadas_mes,
    faturamento_total_centavos: faturamento_cents,
    custo_total_centavos: custo_cents,
    lucro_centavos: faturamento_cents - custo_cents,
  }
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const message = String(body?.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 })
  }

  const isFinancialQuestion = FINANCIAL_KEYWORDS.test(message)
  if (isFinancialQuestion && auth.role !== 'admin') {
    return NextResponse.json({
      ok: false,
      error: 'forbidden',
      reply: 'Relatórios financeiros são restritos a administradores. Faça perguntas sobre ordens, clientes ou operação.',
    }, { status: 403 })
  }

  const { data: connection } = await auth.supabase
    .from('hub_connections')
    .select('api_key, metadata')
    .eq('platform_id', 'chatgpt')
    .not('api_key', 'is', null)
    .maybeSingle()

  const apiKey = connection?.api_key ?? process.env.OPENAI_API_KEY ?? null
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'no_openai_key',
      reply: 'Configure a chave do ChatGPT no HUB (Integrações) ou a variável OPENAI_API_KEY para usar o chat com dados.',
    }, { status: 503 })
  }

  const metadata = (connection?.metadata as { model?: string } | null) || {}
  const model = metadata.model || 'gpt-4o-mini'

  const [orderStats, customerStats, ordersForSummary] = await Promise.all([
    fetchOrderStats(auth.supabase),
    fetchCustomerCount(auth.supabase),
    fetchOrdersForSummary(auth.supabase, message),
  ])

  let financialData: Record<string, unknown> | null = null
  if (auth.role === 'admin') {
    financialData = await fetchFinancialSummary(auth.supabase)
  }

  const dataContext: Record<string, unknown> = {
    ordens: orderStats,
    clientes: customerStats,
    ...(financialData ? { financeiro: financialData } : {}),
  }
  if (ordersForSummary.length > 0) {
    dataContext.ordens_para_resumo = ordersForSummary
  }

  const systemPrompt = `Você é um assistente da Conectize (assistência técnica). Responda em português brasileiro, de forma objetiva e amigável.
Use APENAS os dados fornecidos abaixo para responder. Se não houver dado para a pergunta, diga que não tem essa informação no momento.
Valores financeiros e valores de ordens estão em centavos; ao mencionar, converta para reais (ex.: 15000 centavos = R$ 150,00).
Quando existir "ordens_para_resumo", use esses dados para resumir ou detalhar a(s) ordem(ns) conforme a pergunta do usuário (ex.: resumo da OS, última ordem, detalhes da ordem X). Inclua número da OS, cliente, aparelho, status, datas e um resumo dos serviços/valor quando relevante.
Dados atuais:
${JSON.stringify(dataContext, null, 2)}`

  const isNewModel = /^gpt-5|^o\d|^o\d-/.test(model)
  const apiBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
  }
  if (isNewModel) {
    apiBody.max_completion_tokens = 1200
  } else {
    apiBody.max_tokens = 1200
    apiBody.temperature = 0.3
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(apiBody),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.code || 'Erro na API OpenAI'
      return NextResponse.json({
        ok: false,
        error: 'openai_error',
        reply: `Não foi possível obter resposta: ${errMsg}. Verifique a conexão no HUB ou OPENAI_API_KEY.`,
      }, { status: 502 })
    }

    const msg = data?.choices?.[0]?.message
    let text = ''
    if (typeof msg?.content === 'string') text = msg.content.trim()
    else if (Array.isArray(msg?.content)) {
      const parts = (msg.content as Array<{ type?: string; text?: string }>)
        .filter((p) => p?.type === 'text' && p.text)
        .map((p) => p.text)
      text = parts.join('\n').trim()
    }

    if (!text) {
      return NextResponse.json({
        ok: false,
        error: 'empty_response',
        reply: 'A IA não retornou resposta. Tente reformular a pergunta.',
      }, { status: 502 })
    }

    return NextResponse.json({ ok: true, reply: text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao chamar a IA'
    return NextResponse.json({
      ok: false,
      error: 'request_failed',
      reply: `Erro: ${msg}. Tente novamente.`,
    }, { status: 502 })
  }
}
