'use client'

import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openOrdemLabelPrint } from '../OrdemPrintPreview'

type Props = {
  orderId: string
}

export function OrdemLabelPrintButton({ orderId }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openOrdemLabelPrint(orderId)}
      aria-label="Imprimir etiqueta"
    >
      <Tag className="h-4 w-4" />
    </Button>
  )
}
