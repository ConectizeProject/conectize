'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { appAlert } from '@/lib/ui/app-dialogs'

type Props = {
  token: string
}

export function OrcamentoPublicPrintButton ({ token }: Props) {
  async function handlePrint () {
    const w = window.open(
      `/api/orcamento/${encodeURIComponent(token)}/print`,
      '_blank',
      getPrintWindowFeatures(),
    )
    if (!w) {
      await appAlert({
        title: 'Pop-up bloqueado',
        description: 'Permita pop-ups para imprimir ou salvar o PDF.',
      })
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => { void handlePrint() }}>
      <Printer className="mr-2 h-4 w-4" />
      Imprimir / PDF
    </Button>
  )
}
