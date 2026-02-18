'use client'

import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  orderId: string
}

export function OrdemLabelPrintButton({ orderId }: Props) {
  function handlePrint() {
    const w = window.open(`/api/portal/ordens/${orderId}/label`, '_blank', 'width=900,height=800')
    if (!w) {
      alert('Permita pop-ups para imprimir a etiqueta.')
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      <Tag className="h-4 w-4 mr-2" />
      Imprimir etiqueta
    </Button>
  )
}
