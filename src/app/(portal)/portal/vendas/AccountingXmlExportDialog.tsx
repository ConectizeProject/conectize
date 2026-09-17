'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import {
  brazilCurrentMonthRange,
  brazilPreviousMonthRange,
} from '@/lib/dashboard/brazil-day'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { cn } from '@/lib/utils'

type PeriodKind = 'previous_month' | 'current_month' | 'custom'

function attachmentFilename (header: string | null, fallback: string) {
  const match = String(header || '').match(/filename="([^"]+)"/i)
  return match?.[1] || fallback
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountingXmlExportDialog ({ open, onOpenChange }: Props) {
  const previousMonth = useMemo(() => brazilPreviousMonthRange(), [])
  const currentMonth = useMemo(() => brazilCurrentMonthRange(), [])
  const [period, setPeriod] = useState<PeriodKind>('previous_month')
  const [fromDate, setFromDate] = useState(previousMonth.startDate)
  const [toDate, setToDate] = useState(previousMonth.endDate)
  const [isDownloading, setIsDownloading] = useState(false)

  function periodLabel () {
    if (period === 'previous_month') return previousMonth.displayLabel
    if (period === 'current_month') return currentMonth.displayLabel
    if (fromDate && toDate) {
      if (fromDate === toDate) {
        const [y, m, d] = fromDate.split('-')
        return `${d}/${m}/${y}`
      }
      const [y1, m1, d1] = fromDate.split('-')
      const [y2, m2, d2] = toDate.split('-')
      return `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`
    }
    return 'período'
  }

  async function downloadXml () {
    if (isDownloading) return
    if (period === 'custom' && (!fromDate || !toDate)) {
      toast({
        title: 'Informe as datas',
        description: 'Escolha a data inicial e a data final.',
        variant: 'destructive',
      })
      return
    }

    setIsDownloading(true)
    try {
      const params = new URLSearchParams()
      if (period === 'custom') {
        params.set('period', 'custom')
        params.set('from', fromDate)
        params.set('to', toDate)
      } else {
        params.set('period', period)
      }

      const res = await portalFetch(
        `/api/portal/fiscal/documents/accounting-xml?${params.toString()}`,
        { cache: 'no-store' },
      )
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json') || !res.ok) {
        const data = await res.json().catch(() => null)
        toast({
          title: 'Não foi possível baixar os XMLs',
          description: data?.message || data?.error || 'Tente novamente em instantes.',
          variant: 'destructive',
        })
        return
      }

      const blob = await res.blob()
      const fallbackLabel = period === 'custom'
        ? `${fromDate}_${toDate}`
        : period === 'current_month'
          ? currentMonth.label
          : previousMonth.label
      const filename = attachmentFilename(
        res.headers.get('content-disposition'),
        `xml-nfe-nfce-${fallbackLabel}.zip`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const nfeCount = Number(res.headers.get('x-xml-nfe-count') || 0)
      const nfceCount = Number(res.headers.get('x-xml-nfce-count') || 0)
      const missingCount = Number(res.headers.get('x-xml-missing-count') || 0)
      const month = res.headers.get('x-xml-month') || periodLabel()
      toast({
        variant: missingCount > 0 ? 'default' : 'success',
        title: `XMLs de ${month} prontos`,
        description: missingCount > 0
          ? `${nfceCount} NFC-e e ${nfeCount} NF-e no ZIP. ${missingCount} nota(s) sem XML (veja notas-sem-xml.txt).`
          : `${nfceCount} NFC-e e ${nfeCount} NF-e. Envie o arquivo à contabilidade.`,
      })
      onOpenChange(false)
    } catch {
      toast({
        title: 'Não foi possível baixar os XMLs',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Baixar XMLs das notas</DialogTitle>
          <DialogDescription>
            Escolha o período das NFC-e e NF-e de produção autorizadas ou canceladas.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-2' role='radiogroup' aria-label='Período do relatório'>
          {(
            [
              {
                id: 'previous_month' as const,
                title: 'Mês passado',
                hint: previousMonth.displayLabel,
              },
              {
                id: 'current_month' as const,
                title: 'Este mês',
                hint: currentMonth.displayLabel,
              },
              {
                id: 'custom' as const,
                title: 'Datas específicas',
                hint: 'Informe o intervalo',
              },
            ]
          ).map((option) => (
            <button
              key={option.id}
              type='button'
              role='radio'
              aria-checked={period === option.id}
              className={cn(
                'flex items-start justify-between rounded-md border px-3 py-2.5 text-left transition-colors',
                period === option.id
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:bg-muted/50',
              )}
              onClick={() => {
                setPeriod(option.id)
                if (option.id === 'previous_month') {
                  setFromDate(previousMonth.startDate)
                  setToDate(previousMonth.endDate)
                } else if (option.id === 'current_month') {
                  setFromDate(currentMonth.startDate)
                  setToDate(currentMonth.endDate)
                }
              }}
            >
              <span className='text-sm font-medium'>{option.title}</span>
              <span className='text-xs text-muted-foreground'>{option.hint}</span>
            </button>
          ))}
        </div>

        {period === 'custom' ? (
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='accounting-xml-from'>Data inicial</Label>
              <Input
                id='accounting-xml-from'
                type='date'
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='accounting-xml-to'>Data final</Label>
              <Input
                id='accounting-xml-to'
                type='date'
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isDownloading}
          >
            Cancelar
          </Button>
          <Button
            type='button'
            disabled={isDownloading}
            onClick={() => void downloadXml()}
          >
            <Download className='mr-1 h-4 w-4' />
            {isDownloading ? 'Baixando...' : `Baixar ${periodLabel()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
