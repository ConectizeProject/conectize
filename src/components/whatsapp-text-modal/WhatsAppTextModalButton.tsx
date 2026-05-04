'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { MessageCircle } from 'lucide-react'
import { useCallback, useState } from 'react'

import { WhatsAppTextModalDialog } from './WhatsAppTextModalDialog'
import type { WhatsAppTextModalButtonProps, WhatsAppTextTab } from './types'

const DEFAULT_ARIA_LABEL = 'Texto para WhatsApp'

export function WhatsAppTextModalButton ({
  buildTexts,
  className,
  size = 'icon',
  variant = 'outline',
  'aria-label': ariaLabel = DEFAULT_ARIA_LABEL,
}: WhatsAppTextModalButtonProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<WhatsAppTextTab>('atacado')
  const [textAtacado, setTextAtacado] = useState('')
  const [textCliente, setTextCliente] = useState('')

  const handleOpenModal = useCallback(() => {
    const texts = buildTexts()
    setTextAtacado(texts.atacado)
    setTextCliente(texts.cliente)
    setTab('atacado')
    setOpen(true)
  }, [buildTexts])

  const handleCopy = useCallback(() => {
    const text = tab === 'atacado' ? textAtacado : textCliente
    navigator?.clipboard
      ?.writeText(text)
      .then(() => {
        toast({
          description: 'Copiado para a área de transferência',
          duration: 2000,
        })
      })
      .catch(() => {})
  }, [tab, textAtacado, textCliente])

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpenModal}
        aria-label={ariaLabel}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
      </Button>

      <WhatsAppTextModalDialog
        open={open}
        onOpenChange={setOpen}
        tab={tab}
        onTabChange={setTab}
        textAtacado={textAtacado}
        textCliente={textCliente}
        onTextAtacadoChange={setTextAtacado}
        onTextClienteChange={setTextCliente}
        onCopy={handleCopy}
      />
    </>
  )
}
