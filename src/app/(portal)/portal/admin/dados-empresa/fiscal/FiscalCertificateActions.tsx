'use client'

import { useState } from 'react'
import { Download, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'

function certificateErrorMessage (status: number) {
  if (status === 401) return 'Faça login novamente para acessar o certificado.'
  if (status === 403) return 'Apenas administradores da organização podem acessar o certificado.'
  if (status === 404) return 'Nenhum certificado A1 foi encontrado.'
  return 'Não foi possível acessar o certificado agora.'
}

export function FiscalCertificateActions () {
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isLoadingPassword, setIsLoadingPassword] = useState(false)

  async function handleDownload () {
    const confirmed = await appConfirm({
      title: 'Baixar certificado A1?',
      description: 'O arquivo PFX/P12 permite assinar documentos fiscais. Baixe apenas em um dispositivo confiável.',
      confirmLabel: 'Baixar',
    })
    if (!confirmed) return

    setIsDownloading(true)
    try {
      const response = await fetch('/api/portal/fiscal/certificate/download', {
        cache: 'no-store',
      })
      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível baixar',
          description: certificateErrorMessage(response.status),
        })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'certificado-a1.pfx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível baixar',
        description: 'Verifique sua conexão e tente novamente.',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleRevealPassword () {
    if (isPasswordVisible) {
      setIsPasswordVisible(false)
      return
    }

    const confirmed = await appConfirm({
      title: 'Mostrar senha do certificado?',
      description: 'A senha será exibida na tela. Confira se ninguém não autorizado consegue ver.',
      confirmLabel: 'Mostrar senha',
      destructive: true,
    })
    if (!confirmed) return

    setIsLoadingPassword(true)
    try {
      const response = await fetch('/api/portal/fiscal/certificate/password', {
        method: 'POST',
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok || typeof data.password !== 'string') {
        toast({
          variant: 'destructive',
          title: 'Não foi possível mostrar a senha',
          description: certificateErrorMessage(response.status),
        })
        return
      }

      setPassword(data.password)
      setIsPasswordVisible(true)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível mostrar a senha',
        description: 'Verifique sua conexão e tente novamente.',
      })
    } finally {
      setIsLoadingPassword(false)
    }
  }

  return (
    <div className='space-y-3 pt-2'>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' variant='outline' size='sm' onClick={handleDownload} disabled={isDownloading}>
          <Download className='mr-2 h-4 w-4' />
          {isDownloading ? 'Baixando...' : 'Baixar certificado'}
        </Button>
        <Button type='button' variant='outline' size='sm' onClick={handleRevealPassword} disabled={isLoadingPassword}>
          {isPasswordVisible ? (
            <EyeOff className='mr-2 h-4 w-4' />
          ) : (
            <Eye className='mr-2 h-4 w-4' />
          )}
          {isPasswordVisible ? 'Ocultar senha' : isLoadingPassword ? 'Carregando...' : 'Ver senha'}
        </Button>
      </div>

      {password ? (
        <div className='max-w-md space-y-2'>
          <label htmlFor='certificateSavedPassword' className='text-sm font-medium'>Senha salva do certificado</label>
          <Input
            id='certificateSavedPassword'
            value={password}
            type={isPasswordVisible ? 'text' : 'password'}
            readOnly
            autoComplete='off'
          />
        </div>
      ) : null}
    </div>
  )
}
