'use client'

import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLabelWindowFeatures } from '@/lib/ordem-print'

type Props = {
  orderId: string
}

export function OrdemLabelPrintButton({ orderId }: Props) {
  function handlePrint() {
    const w = window.open(
      `/api/portal/ordens/${orderId}/label`,
      '_blank',
      getLabelWindowFeatures()
    )
    if (!w) {
      alert('Permita pop-ups para imprimir a etiqueta.')
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      <Tag className="h-4 w-4" />
    </Button>
  )
}
