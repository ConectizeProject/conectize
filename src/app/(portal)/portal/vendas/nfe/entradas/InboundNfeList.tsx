'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileUp, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

type InboundDoc = {
  id: string
  entry_kind?: 'products' | 'used_devices'
  source_mode?: 'xml' | 'manual'
  access_key: string | null
  series: number
  number: number
  issued_at: string | null
  issuer_name: string | null
  seller_name?: string | null
  total_cents: number
  status: 'draft' | 'posted' | 'canceled'
  created_at: string
}

function statusLabel (status: InboundDoc['status']) {
  if (status === 'posted') return 'Lançada'
  if (status === 'canceled') return 'Cancelada'
  return 'Rascunho'
}

function statusVariant (status: InboundDoc['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'posted') return 'default'
  if (status === 'canceled') return 'destructive'
  return 'secondary'
}

function kindLabel (doc: InboundDoc) {
  if (doc.entry_kind === 'used_devices') return 'Usados'
  if (doc.source_mode === 'manual') return 'Produtos (manual)'
  return 'Produtos (XML)'
}

function formatDate (value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

export function InboundNfeList () {
  const [documents, setDocuments] = useState<InboundDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function load () {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe')
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        setDocuments([])
        return
      }
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>NF-e de entrada</h2>
          <p className='text-sm text-muted-foreground'>
            Produtos novos (XML ou manual) e aparelhos usados.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link href='/portal/vendas/nfe'>
            <Button type='button' variant='outline'>Saídas</Button>
          </Link>
          <Link href='/portal/vendas/nfe/entradas/nova'>
            <Button type='button'>
              <Plus className='mr-1 h-4 w-4' />
              Nova NF-e de entrada
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Entradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>Carregando...</p>
          ) : documents.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-2 py-10 text-center'>
              <FileUp className='h-8 w-8 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>
                Nenhuma NF-e de entrada ainda.
              </p>
              <Link href='/portal/vendas/nfe/entradas/nova'>
                <Button type='button' variant='outline' size='sm'>Criar primeira entrada</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      {doc.series}/{doc.number}
                    </TableCell>
                    <TableCell>{kindLabel(doc)}</TableCell>
                    <TableCell className='max-w-[220px] truncate'>
                      {doc.entry_kind === 'used_devices'
                        ? (doc.seller_name || doc.issuer_name || '—')
                        : (doc.issuer_name || '—')}
                    </TableCell>
                    <TableCell>{formatDate(doc.issued_at)}</TableCell>
                    <TableCell>{maskedFromCents(doc.total_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(doc.status)}>
                        {statusLabel(doc.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <Link href={`/portal/vendas/nfe/entradas/${encodeURIComponent(doc.id)}`}>
                        <Button type='button' variant='outline' size='sm'>
                          Abrir
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
