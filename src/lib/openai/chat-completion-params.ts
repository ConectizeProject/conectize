/**
 * Parâmetros de Chat Completions para modelos OpenAI atuais.
 * Modelos de reasoning (gpt-5*, gpt-6*, o*) compartilham max_completion_tokens
 * entre reasoning interno e texto visível; effort baixo/none evita content vazio.
 *
 * Modelo padrão: gpt-6-luna (docs OpenAI: eficiente para tarefas curtas/alto volume;
 * preço standard ~US$0,10/1M input e US$0,50/1M output).
 */

export const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-6-luna'

export const OPENAI_HUB_MODELS = [
  {
    value: 'gpt-6-luna',
    label: 'GPT-6 Luna (recomendado - rápido e econômico)',
  },
  {
    value: 'gpt-6.1-terra',
    label: 'GPT-6.1 Terra (melhor para redação)',
  },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (alternativa econômica)' },
  { value: 'gpt-4o', label: 'GPT-4o (versão anterior)' },
] as const

export type OpenAiHubModelValue = (typeof OPENAI_HUB_MODELS)[number]['value']

export function isReasoningChatModel (model: string): boolean {
  const m = String(model || '').trim().toLowerCase()
  return /^(gpt-5|gpt-6|o\d)/.test(m)
}

/**
 * Effort para tarefas curtas (reescrita, título, comentário).
 * Prefere `none` quando o modelo permite; evita content vazio por reasoning.
 */
export function resolveReasoningEffortForShortTask (
  model: string,
): 'none' | 'minimal' | 'low' | null {
  const m = String(model || '').trim().toLowerCase()
  if (!isReasoningChatModel(m)) return null

  // gpt-6-astra e gpt-6.1-sol não aceitam none (HTTP 400).
  if (m.includes('astra') || /^gpt-6\.1-sol\b/.test(m)) return 'low'

  if (/^gpt-6/.test(m)) return 'none'

  // gpt-5* e o-series: minimal (quando suportado) reduz reasoning.
  if (/^gpt-5/.test(m) || /^o\d/.test(m)) return 'minimal'

  return 'low'
}

/**
 * Aplica max_tokens / max_completion_tokens / temperature / reasoning_effort.
 * `tokenBudget` é o tamanho desejado do texto visível; em reasoning o limite
 * efetivo é elevado para caber reasoning + resposta.
 */
export function applyChatCompletionModelParams (
  apiBody: Record<string, unknown>,
  opts: {
    model: string
    tokenBudget: number
    temperature?: number
  },
): void {
  const model = String(opts.model || '').trim()
  const visibleBudget = Math.max(1, Math.floor(Number(opts.tokenBudget) || 1))

  if (!isReasoningChatModel(model)) {
    apiBody.max_tokens = visibleBudget
    apiBody.temperature = opts.temperature ?? 0.3
    delete apiBody.max_completion_tokens
    delete apiBody.reasoning_effort
    return
  }

  // Budget compartilhado: reasoning + output. Mínimo alto evita finish_reason=length
  // com content vazio (bug clássico do gpt-5-mini com 500 tokens).
  apiBody.max_completion_tokens = Math.max(visibleBudget * 4, 2500)
  delete apiBody.max_tokens
  delete apiBody.temperature

  const effort = resolveReasoningEffortForShortTask(model)
  if (effort) apiBody.reasoning_effort = effort
  else delete apiBody.reasoning_effort
}

export function extractChatCompletionText (data: unknown): string {
  const choices = (data as { choices?: unknown } | null)?.choices
  const message = Array.isArray(choices)
    ? (choices[0] as { message?: unknown } | undefined)?.message
    : null
  if (!message || typeof message !== 'object') return ''

  const rawContent = (message as { content?: unknown }).content
  if (typeof rawContent === 'string') return rawContent.trim()

  if (Array.isArray(rawContent)) {
    const texts: string[] = []
    for (const p of rawContent) {
      const part = p as { type?: string; text?: string } | null
      if (!part) continue
      if ((part.type === 'text' || part.type === 'output_text') && part.text) {
        texts.push(String(part.text))
      }
    }
    return texts.join('\n').trim()
  }

  const legacyText = (message as { text?: unknown }).text
  if (typeof legacyText === 'string') return legacyText.trim()
  return ''
}

export function chatCompletionFinishReason (data: unknown): string | null {
  const choices = (data as { choices?: unknown } | null)?.choices
  if (!Array.isArray(choices) || !choices[0]) return null
  const reason = (choices[0] as { finish_reason?: unknown }).finish_reason
  return typeof reason === 'string' && reason ? reason : null
}

export function emptyChatCompletionMessage (finishReason?: string | null): string {
  if (finishReason === 'length') {
    return 'A IA esgotou o limite de tokens no raciocínio interno e não gerou texto. Tente de novo ou escolha outro modelo no HUB.'
  }
  return 'A IA não retornou texto. Tente novamente ou use outro modelo no HUB.'
}
