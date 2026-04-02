'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPrintWindowFeatures } from '@/lib/ordem-print'

type Props = {
  orderId: string
}

export function OrdemPrintButton({ orderId }: Props) {
  function handlePrint() {
    const w = window.open(
      `/api/portal/ordens/${orderId}/print`,
      '_blank',
      getPrintWindowFeatures()
    )
    if (!w) {
      alert('Permita pop-ups para imprimir a ordem.')
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4" />
    </Button>
  )
}
