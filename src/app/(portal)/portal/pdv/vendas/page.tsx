'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

type Sale = {
  id: string
  sale_number: number
  status: string
  seller_user_id: string
  total_cents: number
  paid_amount_cents: number
  change_cents: number
  created_at: string
}

export default function PdvSalesPage () {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [sales, setSales] = useState<Sale[]>([])

  async function load () {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (status) params.set('status', status)
    const res = await portalFetch(`/api/portal/pdv/sales?${params.toString()}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.sales)) setSales(data.sales)
    else setSales([])
  }

  useEffect(() => { void load() }, [])

  return (
    <div className='space-y-4 py-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Histórico de vendas — Frente de Caixa</h1>
        <Link href='/portal/pdv'><Button variant='outline'>Voltar à Frente de Caixa</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-4'>
          <Input type='date' value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type='date' value={to} onChange={(e) => setTo(e.target.value)} />
          <select className='h-10 rounded border bg-background px-2 text-sm' value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value=''>Todos</option>
            <option value='pending'>Pendente</option>
            <option value='paid'>Pago</option>
            <option value='canceled'>Cancelado</option>
          </select>
          <Button onClick={() => void load()}>Aplicar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className='divide-y'>
          {sales.map((sale) => (
            <Link key={sale.id} href={`/portal/pdv/vendas/${sale.id}`} className='flex items-center justify-between py-3 text-sm hover:bg-accent'>
              <span>Venda #{sale.sale_number} · {new Date(sale.created_at).toLocaleString('pt-BR')}</span>
              <span className='font-medium'>{maskedFromCents(sale.total_cents)} · {sale.status}</span>
            </Link>
          ))}
          {sales.length === 0 ? <p className='py-6 text-sm text-muted-foreground'>Nenhuma venda encontrada.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

