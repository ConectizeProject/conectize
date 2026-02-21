'use client'

import { OsAssistAi } from '@/components/orders'
import { toast } from '@/hooks/use-toast'

type Props = {
  title: string
  customerDescription: string
  receivingNotes: string
  device: string
  disabled?: boolean
}

export function OsAssistAiEdit({
  title,
  customerDescription,
  receivingNotes,
  device,
  disabled,
}: Props) {
  if (disabled) return null

  return (
    <OsAssistAi
      customerDescription={customerDescription}
      device={device}
      title={title}
      receivingNotes={receivingNotes}
      readContextFromDom
      onSuggestTitle={(text) => {
        const el = document.getElementById('title') as HTMLInputElement | null
        if (el) el.value = text
      }}
      onImproveDescription={(text) => {
        const el = document.getElementById('customerDescription') as HTMLTextAreaElement | null
        if (el) el.value = text
      }}
      onSuggestServices={(descriptions) => {
        const list = descriptions.join('\n')
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(list).then(() => {
            toast({
              title: 'Sugestões copiadas',
              description: 'Cole na descrição dos serviços ao adicionar cada item.',
            })
          })
        } else {
          toast({ title: 'Sugestões', description: list })
        }
      }}
    />
  )
}
