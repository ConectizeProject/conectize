'use client'

import { toast } from '@/hooks/use-toast'

export function toastChatgptAssistFailure (
  data: { error?: unknown; message?: unknown } | null,
) {
  const code = String(data?.error || '')
  const msg =
    String(data?.message || '').trim() ||
    (code === 'chatgpt_not_connected'
      ? 'Conecte o ChatGPT no HUB de integrações para usar esta função.'
      : code === 'empty_response'
        ? 'A IA não retornou texto. Tente novamente ou use outro modelo no HUB.'
        : 'Erro ao usar a IA')
  const title =
    code === 'chatgpt_not_connected'
      ? 'IA não conectada'
      : code === 'empty_response'
        ? 'IA sem resposta'
        : 'Erro na IA'
  toast({
    title,
    description: msg,
    variant: 'destructive',
  })
}
