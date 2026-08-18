'use client'

import type { MouseEvent } from 'react'
import { useState } from 'react'
import { Loader2, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'

type SefazStatusResponse = {
  ok?: boolean
  available?: boolean
  uf?: string
  environment?: string
  url?: string
  statusCode?: string | null
  statusMessage?: string | null
  httpStatus?: number
  error?: string
  message?: string
}

function getFailureDescription (data: SefazStatusResponse | null, httpStatus?: number) {
  if (data?.message) return data.message
  if (data?.error === 'missing_state') return 'Informe a UF no endereço fiscal antes de testar.'
  if (data?.error === 'invalid_uf') return 'A UF informada é inválida. Use a sigla com 2 letras, como MG, SP ou RJ.'
  if (data?.error === 'missing_certificate' || data?.error === 'not_found') return 'Cadastre o certificado digital A1 antes de testar a comunicação com a SEFAZ.'
  if (data?.error === 'sefaz_url_not_found') return 'Não existe endpoint de status configurado para essa UF/ambiente.'
  if (data?.error === 'sefaz_unreachable') return 'Não foi possível conectar com a SEFAZ. Verifique internet, DNS, firewall ou proxy.'
  if (httpStatus === 401) return 'Sua sessão expirou. Faça login novamente.'
  if (httpStatus === 403) return 'Apenas administradores da organização podem testar a comunicação fiscal.'
  if (httpStatus && httpStatus >= 500) return 'Erro interno ao testar a comunicação. Veja o terminal do servidor para detalhes.'
  return 'Não foi possível consultar a disponibilidade da SEFAZ. Tente novamente em alguns instantes.'
}

function getUnavailableDescription (data: SefazStatusResponse) {
  const environment = data.environment || 'ambiente não informado'
  const uf = data.uf || 'UF não informada'
  const httpStatus = data.httpStatus ? `HTTP ${data.httpStatus}` : 'sem HTTP status'
  const statusCode = data.statusCode ? `cStat ${data.statusCode}` : 'sem cStat'
  const statusMessage = data.statusMessage || data.url || 'A SEFAZ respondeu, mas sem mensagem detalhada.'

  return `${uf} / ${environment}: ${httpStatus}, ${statusCode} - ${statusMessage}`
}

export function SefazCommunicationTestButton () {
  const [isTesting, setIsTesting] = useState(false)

  async function handleTest (event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    const formData = form ? new FormData(form) : null
    const state = String(formData?.get('state') || '').trim().toUpperCase().slice(0, 2)
    const fiscalEnvironment = String(formData?.get('fiscalEnvironment') || 'homologacao')

    setIsTesting(true)
    try {
      const res = await portalFetch('/api/portal/fiscal/sefaz-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, fiscalEnvironment }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Falha ao testar SEFAZ',
          description: getFailureDescription(data, res?.status),
          variant: 'destructive',
        })
        return
      }

      toast({
        variant: data.available ? 'success' : 'destructive',
        title: data.available ? 'SEFAZ disponível' : 'SEFAZ indisponível ou instável',
        description: data.available
          ? `${data.uf} / ${data.environment}: ${data.statusCode || data.httpStatus} - ${data.statusMessage || 'Serviço em operação.'}`
          : getUnavailableDescription(data),
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Button type='button' variant='outline' disabled={isTesting} onClick={(event) => void handleTest(event)}>
      {isTesting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Wifi className='h-4 w-4' />}
      <span className='ml-2'>Testar comunicação</span>
    </Button>
  )
}
