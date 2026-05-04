'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

export default function PdvSaleDetailPage () {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const res = await portalFetch(`/api/portal/pdv/sales/${id}`)
      const json = await res?.json().catch(() => null)
      if (json?.ok) setData(json)
    })()
  }, [id])

  return (
    <div className='space-y-4 py-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Detalhe da venda</h1>
        <Link href='/portal/pdv/vendas'><Button variant='outline'>Voltar</Button></Link>
      </div>
      {!data ? <p className='text-sm text-muted-foreground'>Carregando...</p> : (
        <>
          <Card>
            <CardHeader><CardTitle>Venda #{data.sale.sale_number}</CardTitle></CardHeader>
            <CardContent className='space-y-1 text-sm'>
              <p>Status: <strong>{data.sale.status}</strong></p>
              <p>Total: <strong>{maskedFromCents(data.sale.total_cents)}</strong></p>
              <p>Pago: <strong>{maskedFromCents(data.sale.paid_amount_cents)}</strong></p>
              <p>Troco: <strong>{maskedFromCents(data.sale.change_cents)}</strong></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
            <CardContent className='space-y-2'>
              {data.items.map((item: any) => (
                <div key={item.id} className='flex items-center justify-between rounded border p-2 text-sm'>
                  <span>{item.products?.name || item.product_id} × {item.quantity}</span>
                  <span>{maskedFromCents(item.subtotal_cents)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

