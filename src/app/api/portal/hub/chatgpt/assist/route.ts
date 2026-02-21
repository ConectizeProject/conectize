import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalized = role === 'customer' ? 'user' : role
  if (normalized === 'user') return { ok: false as const, status: 403, error: 'forbidden' }

  return { ok: true as const, supabase }
}

const ASSIST_SYSTEM = `Você é um assistente da Conectize, assistência técnica de celulares e eletrônicos.
Sua tarefa é ajudar a criar ou editar ordens de serviço (OS).
Responda sempre em português brasileiro, de forma objetiva e profissional.
Para "suggest_title": retorne apenas um título curto (máx. ~50 caracteres) para a OS, baseado na descrição do defeito/solicitação. Sem aspas nem explicação.
Para "improve_description": retorne apenas o texto da descrição melhorado (ortografia, clareza), mantendo o sentido. Nada além do texto.
Para "suggest_services": retorne uma lista de itens de serviço, um por linha, no formato "Descrição do serviço". Máximo 5 itens. Apenas as linhas, sem numeração nem marcadores.`

type Action = 'suggest_title' | 'improve_description' | 'suggest_services'

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const action = String(body?.action || '').trim() as Action
  const context = body?.context || {}

  const validActions: Action[] = ['suggest_title', 'improve_description', 'suggest_services']
  if (!validActions.includes(action)) {
    return NextResponse.json({ ok: false, error: 'action_invalid' }, { status: 400 })
  }

  const { data: connection } = await auth.supabase
    .from('hub_connections')
    .select('api_key, metadata')
    .eq('platform_id', 'chatgpt')
    .not('api_key', 'is', null)
    .maybeSingle()

  if (!connection?.api_key) {
    return NextResponse.json(
      { ok: false, error: 'chatgpt_not_connected', message: 'Conecte o ChatGPT no HUB de integrações.' },
      { status: 503 }
    )
  }

  const metadata = (connection.metadata as { model?: string } | null) || {}
  const model = metadata.model || 'gpt-5-mini'

  const customerDescription = String(context.customerDescription || context.description || '').trim()
  const title = String(context.title || '').trim()
  const device = String(context.device || '').trim()
  const receivingNotes = String(context.receivingNotes || '').trim()

  let userContent = ''
  if (action === 'suggest_title') {
    userContent = `Gere um título curto para uma ordem de serviço com a seguinte descrição do cliente:\n\n${customerDescription || '(sem descrição)'}\n${device ? `Aparelho: ${device}` : ''}\n\nRetorne apenas o título, nada mais.`
  } else if (action === 'improve_description') {
    userContent = `Melhore o texto abaixo (ortografia e clareza), mantendo o sentido. Retorne apenas o texto melhorado.\n${device ? `Contexto: aparelho/dispositivo da OS: ${device}.\n\n` : '\n'}Texto:\n\n${customerDescription || '(vazio)'}`
  } else if (action === 'suggest_services') {
    userContent = `Com base na descrição abaixo, sugira itens de serviço (ex: "Troca de tela", "Troca de bateria"). Um por linha, máx. 5. Apenas as linhas:\n\n${customerDescription || '(sem descrição)'}\n${device ? `Aparelho: ${device}` : ''}`
  }

  // GPT-5 e modelos o-series usam max_completion_tokens e não suportam temperature customizado.
  // Modelos antigos (gpt-4o-mini, gpt-3.5-turbo) usam max_tokens e aceitam temperature.
  const isNewModel = /^gpt-5|^o\d|^o\d-/.test(model)
  const apiBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: ASSIST_SYSTEM },
      { role: 'user', content: userContent },
    ],
  }
  if (isNewModel) {
    apiBody.max_completion_tokens = 500
  } else {
    apiBody.max_tokens = 500
    apiBody.temperature = 0.3
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.api_key}`,
      },
      body: JSON.stringify(apiBody),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.code || 'Erro na API OpenAI'
      return NextResponse.json(
        { ok: false, error: 'openai_error', message: errMsg },
        { status: 502 }
      )
    }

    const message = data?.choices?.[0]?.message
    const rawContent = message?.content
    const text = (() => {
      if (typeof rawContent === 'string') return rawContent.trim()
      if (Array.isArray(rawContent)) {
        const texts: string[] = []
        for (const p of rawContent) {
          const part = p as { type?: string; text?: string } | null
          if (!part) continue
          const isTextPart = part.type === 'text' || part.type === 'output_text'
          if (isTextPart && part.text) texts.push(String(part.text))
        }
        return texts.join('\n').trim()
      }
      if (message && typeof (message as { text?: string }).text === 'string') {
        return String((message as { text: string }).text).trim()
      }
      return ''
    })()

    if (!text) {
      if (action === 'improve_description') {
        const fallback = customerDescription || ''
        return NextResponse.json({ ok: true, text: fallback })
      }
      return NextResponse.json(
        { ok: false, error: 'empty_response', message: 'A IA não retornou texto. Tente novamente ou use outro modelo no HUB.' },
        { status: 502 }
      )
    }

    if (action === 'suggest_services') {
      const items = text
        .split('\n')
        .map((s) => s.replace(/^[\d\-•*.]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 5)
      return NextResponse.json({ ok: true, items })
    }

    return NextResponse.json({ ok: true, text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao chamar a IA'
    return NextResponse.json({ ok: false, error: 'request_failed', message }, { status: 502 })
  }
}
