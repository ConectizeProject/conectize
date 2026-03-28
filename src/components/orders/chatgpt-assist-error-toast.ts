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
      : 'Erro ao usar a IA')
  toast({
    title: code === 'chatgpt_not_connected' ? 'IA não conectada' : 'Erro na IA',
    description: msg,
    variant: 'destructive',
  })
}
