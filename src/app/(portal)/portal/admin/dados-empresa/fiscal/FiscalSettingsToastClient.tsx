'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

function getFiscalErrorMessage (error: string | null) {
  if (error === 'secret') return 'Configure FISCAL_SECRETS_KEY com 32 bytes antes de salvar CSC ou certificado.'
  if (error === 'cert_password') return 'Informe a senha do certificado A1.'
  if (error === 'invalid_password') return 'Não foi possível abrir o PFX. Confira a senha do certificado.'
  if (error === 'cnpj_mismatch') return 'O CNPJ do certificado não confere com o CNPJ fiscal informado.'
  if (error === 'file_too_large') return 'O certificado deve ter até 2 MB.'
  if (error === 'invalid_file') return 'Envie um arquivo .pfx ou .p12 válido.'
  if (error === 'db') return 'Não foi possível salvar os dados fiscais.'
  return 'Não foi possível salvar as configurações fiscais.'
}

export function FiscalSettingsToastClient () {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledKeyRef = useRef('')

  useEffect(() => {
    const ok = searchParams.get('ok')
    const error = searchParams.get('error')
    const key = `${ok || ''}:${error || ''}`

    if (!ok && !error) return
    if (handledKeyRef.current === key) return
    handledKeyRef.current = key

    if (ok === '1') {
      toast({
        variant: 'success',
        title: 'Dados fiscais salvos',
        description: 'As configurações para emissão fiscal foram atualizadas.',
      })
      router.replace('/portal/admin/dados-empresa/fiscal')
      return
    }

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar',
        description: getFiscalErrorMessage(error),
      })
      router.replace('/portal/admin/dados-empresa/fiscal')
    }
  }, [router, searchParams])

  return null
}
