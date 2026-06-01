'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

export default function PdvReportPage () {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [summary, setSummary] = useState<any>(null)

  async function load () {
    const res = await portalFetch(`/api/portal/pdv/reports/daily-summary?date=${date}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok) setSummary(data.summary)
  }

  useEffect(() => { void load() }, [])

  return (
    <div className='space-y-4 py-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Resumo diário — Frente de Caixa</h1>
        <Link href='/portal/pdv'><Button variant='outline'>Voltar</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent className='flex gap-2'>
          <Input type='date' value={date} onChange={(e) => setDate(e.target.value)} className='w-52' />
          <Button onClick={() => void load()}>Atualizar</Button>
        </CardContent>
      </Card>
      {summary ? (
        <Card>
          <CardHeader><CardTitle>{summary.date}</CardTitle></CardHeader>
          <CardContent className='space-y-1 text-sm'>
            <p>Vendas pagas: <strong>{summary.paidSalesCount}</strong></p>
            <p>Vendas canceladas: <strong>{summary.canceledSalesCount}</strong></p>
            <p>Total vendido: <strong>{maskedFromCents(summary.totalSalesCents)}</strong></p>
            <p>Total recebido: <strong>{maskedFromCents(summary.totalReceivedCents)}</strong></p>
            <p>Troco: <strong>{maskedFromCents(summary.totalChangeCents)}</strong></p>
            <p>Dinheiro: <strong>{maskedFromCents(summary.byMethod.dinheiro || 0)}</strong></p>
            <p>PIX: <strong>{maskedFromCents(summary.byMethod.pix || 0)}</strong></p>
            <p>Crédito: <strong>{maskedFromCents(summary.byMethod.credito || 0)}</strong></p>
            <p>Débito: <strong>{maskedFromCents(summary.byMethod.debito || 0)}</strong></p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

