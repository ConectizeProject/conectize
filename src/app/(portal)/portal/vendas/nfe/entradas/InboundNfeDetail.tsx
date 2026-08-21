'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Link2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { maskedFromCents } from '@/lib/utils/money'
import { revendaPath } from '@/lib/revenda/revenda-paths'

type ProductHit = {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  hasVariations?: boolean
}

type InboundItem = {
  id: string
  line_number: number
  item_kind?: 'product' | 'used_device'
  product_code: string | null
  barcode: string | null
  description: string
  ncm: string | null
  unit: string | null
  quantity: number
  unit_value_cents: number
  total_cents: number
  product_id: string | null
  resale_device_id?: string | null
  device_snapshot?: {
    device_name?: string
    color?: string | null
    storage_gb?: string | null
    imei?: string | null
  } | null
  product?: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  } | null
}

type InboundDoc = {
  id: string
  entry_kind?: 'products' | 'used_devices'
  source_mode?: 'xml' | 'manual'
  access_key: string | null
  series: number
  number: number
  issued_at: string | null
  issuer_cnpj: string | null
  issuer_name: string | null
  seller_name?: string | null
  seller_document?: string | null
  total_cents: number
  status: 'draft' | 'posted' | 'canceled'
  items?: InboundItem[]
}

type Props = {
  documentId: string
}

function formatDate (value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

export function InboundNfeDetail ({ documentId }: Props) {
  const [document, setDocument] = useState<InboundDoc | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [searchByItem, setSearchByItem] = useState<Record<string, string>>({})
  const [hitsByItem, setHitsByItem] = useState<Record<string, ProductHit[]>>({})
  const [searchingItemId, setSearchingItemId] = useState<string | null>(null)

  async function load () {
    setIsLoading(true)
    try {
      const res = await portalFetch(`/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}`)
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        setDocument(null)
        return
      }
      setDocument(data.document as InboundDoc)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [documentId])

  const items = document?.items || []
  const isUsed = document?.entry_kind === 'used_devices'
  const unlinkedCount = useMemo(
    () => (isUsed ? 0 : items.filter((item) => !item.product_id).length),
    [items, isUsed],
  )
  const isDraft = document?.status === 'draft'

  async function searchProducts (itemId: string, query: string) {
    setSearchByItem((prev) => ({ ...prev, [itemId]: query }))
    if (query.trim().length < 2) {
      setHitsByItem((prev) => ({ ...prev, [itemId]: [] }))
      return
    }
    setSearchingItemId(itemId)
    try {
      const params = new URLSearchParams({ q: query, kind: 'product' })
      const res = await portalFetch(`/api/portal/produtos/search?${params.toString()}`)
      const data = await res?.json().catch(() => null)
      const list = Array.isArray(data?.items) ? data.items as ProductHit[] : []
      setHitsByItem((prev) => ({
        ...prev,
        [itemId]: list.filter((hit) => !hit.hasVariations),
      }))
    } finally {
      setSearchingItemId((current) => (current === itemId ? null : current))
    }
  }

  async function linkProduct (itemId: string, productId: string | null) {
    if (!isDraft || linkingItemId || isUsed) return
    setLinkingItemId(itemId)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/items/${encodeURIComponent(itemId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível vincular',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      setHitsByItem((prev) => ({ ...prev, [itemId]: [] }))
      setSearchByItem((prev) => ({ ...prev, [itemId]: '' }))
    } finally {
      setLinkingItemId(null)
    }
  }

  async function postToStock () {
    if (!isDraft || isPosting) return
    if (!isUsed && unlinkedCount > 0) {
      toast({
        title: 'Itens sem produto',
        description: `Vincule os ${unlinkedCount} item(ns) restantes antes de lançar.`,
        variant: 'destructive',
      })
      return
    }
    const confirmed = await appConfirm({
      title: isUsed ? 'Lançar aparelhos no estoque?' : 'Lançar entrada no estoque?',
      description: isUsed
        ? 'Cada aparelho será cadastrado como seminovo. Se houver forma de pagamento, gera saída financeira.'
        : 'As quantidades serão somadas ao estoque e o custo dos produtos poderá ser atualizado.',
      confirmLabel: isUsed ? 'Lançar usados' : 'Lançar estoque',
    })
    if (!confirmed) return

    setIsPosting(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/post`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Falha ao lançar',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      toast({
        title: 'Entrada lançada',
        description: isUsed
          ? 'Aparelhos cadastrados no estoque de seminovos.'
          : 'Estoque atualizado com base na NF-e de entrada.',
      })
    } finally {
      setIsPosting(false)
    }
  }

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Carregando NF-e...</p>
  }

  if (!document) {
    return (
      <div className='space-y-3'>
        <p className='text-sm text-muted-foreground'>NF-e de entrada não encontrada.</p>
        <Link href='/portal/vendas/nfe/entradas'>
          <Button type='button' variant='outline'>Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-lg font-medium'>
              NF-e entrada {document.series}/{document.number}
            </h2>
            <Badge variant={document.status === 'posted' ? 'default' : 'secondary'}>
              {document.status === 'posted' ? 'Lançada' : document.status === 'canceled' ? 'Cancelada' : 'Rascunho'}
            </Badge>
            <Badge variant='outline'>
              {isUsed
                ? 'Usados'
                : document.source_mode === 'manual'
                  ? 'Produtos (manual)'
                  : 'Produtos (XML)'}
            </Badge>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {isUsed
              ? (document.seller_name || document.issuer_name || 'Cliente')
              : (document.issuer_name || 'Emitente')}
            {' · '}
            {formatDate(document.issued_at)}
          </p>
          {document.access_key ? (
            <p className='mt-1 font-mono text-xs text-muted-foreground break-all'>
              Chave {document.access_key}
            </p>
          ) : null}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link href='/portal/vendas/nfe/entradas'>
            <Button type='button' variant='outline'>Voltar</Button>
          </Link>
          {isDraft ? (
            <Button type='button' disabled={isPosting || (!isUsed && unlinkedCount > 0)} onClick={() => void postToStock()}>
              {isPosting ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <CheckCircle2 className='mr-1 h-4 w-4' />}
              {isUsed ? 'Lançar usados' : 'Lançar no estoque'}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Resumo</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-2 text-sm sm:grid-cols-3'>
          <div>
            <p className='text-muted-foreground'>Total</p>
            <p className='font-medium'>{maskedFromCents(document.total_cents)}</p>
          </div>
          <div>
            <p className='text-muted-foreground'>{isUsed ? 'Documento vendedor' : 'CNPJ emitente'}</p>
            <p className='font-medium'>
              {isUsed ? (document.seller_document || '—') : (document.issuer_cnpj || '—')}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground'>{isUsed ? 'Aparelhos' : 'Itens sem vínculo'}</p>
            <p className='font-medium'>{isUsed ? items.length : unlinkedCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>{isUsed ? 'Aparelhos' : 'Itens'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Unit.</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>{isUsed ? 'Seminovo' : 'Produto Conectize'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.line_number}</TableCell>
                  <TableCell className='max-w-[280px]'>
                    <p className='truncate font-medium'>{item.description}</p>
                    <p className='text-xs text-muted-foreground'>
                      {isUsed
                        ? [
                          item.device_snapshot?.color,
                          item.device_snapshot?.storage_gb,
                          item.device_snapshot?.imei ? `IMEI ${item.device_snapshot.imei}` : null,
                        ].filter(Boolean).join(' · ') || '—'
                        : [
                          item.product_code,
                          item.barcode,
                          item.ncm ? `NCM ${item.ncm}` : null,
                        ].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {item.quantity} {item.unit || ''}
                  </TableCell>
                  <TableCell>{maskedFromCents(item.unit_value_cents)}</TableCell>
                  <TableCell>{maskedFromCents(item.total_cents)}</TableCell>
                  <TableCell className='min-w-[260px]'>
                    {isUsed ? (
                      item.resale_device_id ? (
                        <Link
                          href={revendaPath.device(item.resale_device_id)}
                          className='text-sm font-medium text-primary underline-offset-2 hover:underline'
                        >
                          Abrir seminovo
                        </Link>
                      ) : (
                        <span className='text-sm text-muted-foreground'>
                          {isDraft ? 'Será criado ao lançar' : '—'}
                        </span>
                      )
                    ) : item.product ? (
                      <div className='space-y-2'>
                        <p className='text-sm font-medium'>{item.product.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {[item.product.sku, item.product.barcode].filter(Boolean).join(' · ') || item.product.id}
                        </p>
                        {isDraft ? (
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={linkingItemId === item.id}
                            onClick={() => void linkProduct(item.id, null)}
                          >
                            Desvincular
                          </Button>
                        ) : null}
                      </div>
                    ) : isDraft ? (
                      <div className='space-y-2'>
                        <div className='relative'>
                          <Input
                            value={searchByItem[item.id] || ''}
                            placeholder='Buscar produto...'
                            onChange={(event) => {
                              void searchProducts(item.id, event.target.value)
                            }}
                          />
                          {searchingItemId === item.id ? (
                            <Loader2 className='absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground' />
                          ) : (
                            <Link2 className='pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground' />
                          )}
                        </div>
                        {(hitsByItem[item.id] || []).length > 0 ? (
                          <ul className='max-h-40 overflow-auto rounded-md border bg-background'>
                            {(hitsByItem[item.id] || []).map((hit) => (
                              <li key={hit.id}>
                                <button
                                  type='button'
                                  className='flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted'
                                  disabled={linkingItemId === item.id}
                                  onClick={() => void linkProduct(item.id, hit.id)}
                                >
                                  <span className='font-medium'>{hit.name}</span>
                                  <span className='text-xs text-muted-foreground'>
                                    {[hit.sku, hit.barcode].filter(Boolean).join(' · ') || hit.id}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : (
                      <span className='text-sm text-muted-foreground'>Sem vínculo</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
