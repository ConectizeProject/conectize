import type { SupabaseClient } from '@supabase/supabase-js'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

const SYSTEM = `Você é o assistente virtual da Conectize (assistência técnica de celulares e eletrônicos no Brasil).
Responda em português brasileiro, de forma educada e objetiva.
Se o cliente pedir orçamento, use APENAS os preços da lista "Produtos e serviços cadastrados" fornecida no contexto. Não invente valores.
Se não houver item adequado na lista, diga que um atendente confirmará o valor e peça para aguardar.
Para aprovação de orçamento, só considere confirmado se o cliente responder de forma clara (ex.: "aprovo", "pode fazer", "fechado").
Quando precisar registrar dados para abrir ordem de serviço, ao final da mensagem inclua uma linha exatamente neste formato (uma linha só, JSON minificado):
DRAFT_OS_JSON:{"full_name":"","cpf":"","device_description":"","issue_description":""}
Preencha apenas os campos que o cliente já informou; use string vazia para os demais. Não repita essa linha se não estiver coletando dados para OS.`

function formatMoneyBr (cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

async function loadProductContext (supabase: SupabaseClient, userMessage: string): Promise<string> {
  const words = userMessage
    .split(/[\s,.;:!?]+/)
    .map((w) => w.replace(/%/g, '').trim())
    .filter((w) => w.length > 2)
    .slice(0, 4)
  const formatRow = (p: { name: string; kind: string; sale_price_cents: number | null }) =>
    `- ${p.name} (${p.kind === 'service' ? 'serviço' : 'produto'}): ${formatMoneyBr(p.sale_price_cents)}`

  let q = supabase.from('products').select('name, kind, sale_price_cents').order('name').limit(40)
  if (words.length > 0) {
    const orFilter = words.map((w) => `name.ilike.%${w}%`).join(',')
    q = q.or(orFilter)
  }
  const { data: rows } = await q
  const list = (rows || []) as Array<{ name: string; kind: string; sale_price_cents: number | null }>
  if (list.length > 0) {
    return list.map(formatRow).join('\n')
  }
  const { data: fallback } = await supabase
    .from('products')
    .select('name, kind, sale_price_cents')
    .order('name')
    .limit(25)
  const fb = (fallback || []) as typeof list
  return fb.map(formatRow).join('\n')
}

function parseDraftLine (assistantText: string): Record<string, string> | null {
  const lines = assistantText.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line.startsWith('DRAFT_OS_JSON:')) continue
    const raw = line.slice('DRAFT_OS_JSON:'.length).trim()
    try {
      const o = JSON.parse(raw) as Record<string, unknown>
      if (!o || typeof o !== 'object') return null
      return {
        full_name: String(o.full_name ?? ''),
        cpf: String(o.cpf ?? ''),
        device_description: String(o.device_description ?? ''),
        issue_description: String(o.issue_description ?? ''),
      }
    } catch {
      return null
    }
  }
  return null
}

function stripDraftLine (assistantText: string): string {
  return assistantText
    .split('\n')
    .filter((l) => !l.trim().startsWith('DRAFT_OS_JSON:'))
    .join('\n')
    .trim()
}

export type OrchestratorResult = {
  replyText: string
  draftPatch: Record<string, string> | null
}

export async function runWhatsappAiReply (opts: {
  supabase: SupabaseClient
  openaiApiKey: string
  model: string
  userMessage: string
  history: ChatTurn[]
}): Promise<OrchestratorResult | { error: string }> {
  const { supabase, openaiApiKey, model, userMessage, history } = opts
  const productBlock = await loadProductContext(supabase, userMessage)
  const ctx = `Produtos e serviços cadastrados (referência de preços):\n${productBlock || '(nenhum cadastrado)'}`
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: `${SYSTEM}\n\n${ctx}` },
    ...history.slice(-12).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ]
  const isNewModel = /^gpt-5|^o\d|^o\d-/.test(model)
  const apiBody: Record<string, unknown> = {
    model,
    messages,
  }
  if (isNewModel) {
    apiBody.max_completion_tokens = 900
  } else {
    apiBody.max_tokens = 900
    apiBody.temperature = 0.4
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(apiBody),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.code || 'openai_error'
      return { error: String(errMsg) }
    }
    const message = data?.choices?.[0]?.message
    const rawContent = message?.content
    let text = ''
    if (typeof rawContent === 'string') text = rawContent.trim()
    else if (Array.isArray(rawContent)) {
      const texts: string[] = []
      for (const p of rawContent) {
        const part = p as { type?: string; text?: string } | null
        if (!part) continue
        if ((part.type === 'text' || part.type === 'output_text') && part.text) texts.push(String(part.text))
      }
      text = texts.join('\n').trim()
    }
    if (!text) return { error: 'empty_response' }
    const draftPatch = parseDraftLine(text)
    const replyText = stripDraftLine(text) || 'Olá! Como podemos ajudar?'
    return { replyText, draftPatch }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'request_failed' }
  }
}

export { parseDraftLine, stripDraftLine }
