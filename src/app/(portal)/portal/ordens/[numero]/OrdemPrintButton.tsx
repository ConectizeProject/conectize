'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { appAlert } from '@/lib/ui/app-dialogs'

type Props = {
  orderId: string
}

export function OrdemPrintButton({ orderId }: Props) {
  async function handlePrint() {
    const w = window.open(
      `/api/portal/ordens/${orderId}/print`,
      '_blank',
      getPrintWindowFeatures()
    )
    if (!w) {
      await appAlert({
        title: 'Pop-up bloqueado',
        description: 'Permita pop-ups para imprimir a ordem.',
      })
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4" />
    </Button>
  )
}
