'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildOrdemPrintHtml, type CompanyPrintData, type OrdemPrintData } from '@/lib/ordem-print-template'

export type { CompanyPrintData, OrdemPrintData }

export function OrdemPrintButton({
  data,
  company,
}: {
  data: OrdemPrintData
  company?: CompanyPrintData | null
}) {
  function handlePrint() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const html = buildOrdemPrintHtml(data, company, origin)
    const w = window.open('', '_blank', 'width=900,height=800')
    if (!w) {
      alert('Permita pop-ups para imprimir a ordem.')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4" />
    </Button>
  )
}
