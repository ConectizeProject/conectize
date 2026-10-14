'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { Minus, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { maskedFromCents } from '@/lib/utils/money'

type NoteStatus = 'draft' | 'posted' | 'canceled'

type NoteSummary = {
  id: string
  access_key: string | null
  series: number
  number: number
  issued_at: string | null
  issuer_cnpj: string | null
  issuer_name: string | null
  seller_name?: string | null
  status: NoteStatus
  created_at: string
}

type NoteItem = {
  id: string
  line_number: number
  product_code: string | null
  barcode: string | null
  description: string
  unit: string | null
  quantity: number
  unit_value_cents: number
  product?: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  } | null
}

type NoteDetail = NoteSummary & {
  items: NoteItem[]
}

type HistoryEntry = {
  id: string
  label: string
  at: string
}

function asQty (value: number) {
  const qty = Number(value)
  return Number.isFinite(qty) ? qty : 0
}

function roundQty (value: number) {
  return Math.round(value * 1000) / 1000
}

function formatQty (value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)
}

function formatDate (value: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return date.toLocaleDateString('pt-BR')
}

function noteLabel (note: { number: number }) {
  return `NFe ${String(note.number).padStart(6, '0')}`
}

function supplierName (note: NoteSummary) {
  return note.issuer_name || note.seller_name || 'Fornecedor não informado'
}

function supplierDocument (note: NoteSummary) {
  if (!note.issuer_cnpj) return 'Documento não informado'
  const formatted = formatCnpj(note.issuer_cnpj)
  return formatted || note.issuer_cnpj
}

function onlyDigits (value: string) {
  return value.replace(/\D/g, '')
}

function matchesNote (note: NoteSummary, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return false
  const digits = onlyDigits(trimmed)
  const accessKey = onlyDigits(note.access_key || '')
  if (digits && accessKey.includes(digits)) return true
  if (digits && String(note.number) === digits) return true
  if (digits && `${note.series}${note.number}` === digits) return true
  return noteLabel(note).toLocaleLowerCase('pt-BR').includes(trimmed.toLocaleLowerCase('pt-BR'))
}

function itemSearchText (item: NoteItem) {
  return [
    item.description,
    item.product_code,
    item.barcode,
    item.product?.name,
    item.product?.sku,
    item.product?.barcode,
  ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR')
}

function matchesItem (item: NoteItem, query: string) {
  const trimmed = query.trim().toLocaleLowerCase('pt-BR')
  if (!trimmed) return false
  if (itemSearchText(item).includes(trimmed)) return true
  const digits = onlyDigits(trimmed)
  if (!digits) return false
  const codes = [item.barcode, item.product_code, item.product?.barcode, item.product?.sku]
  return codes.some((code) => code && onlyDigits(code).includes(digits))
}

function isItemComplete (item: NoteItem, received: number) {
  return received >= asQty(item.quantity)
}

type RowProps = {
  item: NoteItem
  received: number
  locked: boolean
  onChange: (itemId: string, next: number) => void
}

function CheckinItemRow ({ item, received, locked, onChange }: RowProps) {
  const qty = asQty(item.quantity)
  const checked = isItemComplete(item, received)
  const code = item.product_code || item.product?.sku || '-'

  const setQty = useCallback((next: number) => {
    const clamped = qty <= 0 ? 0 : Math.min(qty, Math.max(0, roundQty(next)))
    onChange(item.id, clamped)
  }, [item.id, onChange, qty])

  const decrease = useCallback(() => {
    setQty(received - 1)
  }, [received, setQty])

  const increase = useCallback(() => {
    setQty(received + 1)
  }, [received, setQty])

  const toggle = useCallback((value: boolean | 'indeterminate') => {
    setQty(value === true ? qty : 0)
  }, [qty, setQty])

  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={checked}
          disabled={locked}
          onCheckedChange={toggle}
          aria-label={`Marcar ${item.description} como recebido`}
        />
      </TableCell>
      <TableCell className='max-w-[280px] whitespace-normal'>
        {item.description}
      </TableCell>
      <TableCell>{code}</TableCell>
      <TableCell>R$ {maskedFromCents(item.unit_value_cents) || '0,00'}</TableCell>
      <TableCell>{item.unit || 'UN'}</TableCell>
      <TableCell>{formatQty(qty)}</TableCell>
      <TableCell>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            disabled={locked || received <= 0}
            onClick={decrease}
            aria-label={`Diminuir quantidade recebida de ${item.description}`}
          >
            <Minus />
          </Button>
          <span className='w-10 text-center tabular-nums'>{formatQty(received)}</span>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            disabled={locked || received >= qty}
            onClick={increase}
            aria-label={`Aumentar quantidade recebida de ${item.description}`}
          >
            <Plus />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function CheckinRecebimentoClient () {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [details, setDetails] = useState<Record<string, NoteDetail>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [receivedByItem, setReceivedByItem] = useState<Record<string, number>>({})
  const [finishedIds, setFinishedIds] = useState<Record<string, true>>({})
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const pushHistory = useCallback((label: string) => {
    setHistory((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        label,
        at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...current,
    ])
  }, [])

  useEffect(() => {
    let active = true
    async function loadNotes () {
      setIsLoadingList(true)
      try {
        const res = await portalFetch('/api/portal/fiscal/inbound-nfe')
        const data = await res.json().catch(() => null) as { ok?: boolean, documents?: NoteSummary[] } | null
        if (!active) return
        if (!data?.ok || !Array.isArray(data.documents)) {
          setNotes([])
          toast({ title: 'Não foi possível carregar as notas', variant: 'destructive' })
          return
        }
        setNotes(data.documents)
        setSelectedId((current) => current || data.documents?.[0]?.id || null)
      } catch (err) {
        if (!active) return
        setNotes([])
        toast({
          title: 'Não foi possível carregar as notas',
          description: err instanceof Error ? err.message : 'Erro de rede',
          variant: 'destructive',
        })
      } finally {
        if (active) setIsLoadingList(false)
      }
    }
    void loadNotes()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId || details[selectedId]) return
    let active = true
    const noteId = selectedId
    async function loadDetail () {
      setLoadingDetailId(noteId)
      try {
        const res = await portalFetch(`/api/portal/fiscal/inbound-nfe/${encodeURIComponent(noteId)}`)
        const data = await res.json().catch(() => null) as { ok?: boolean, document?: NoteDetail } | null
        if (!active) return
        if (!data?.ok || !data.document) {
          toast({ title: 'Não foi possível abrir a nota', variant: 'destructive' })
          return
        }
        const document = {
          ...data.document,
          items: Array.isArray(data.document.items) ? data.document.items : [],
        }
        setDetails((current) => ({ ...current, [noteId]: document }))
      } catch (err) {
        if (!active) return
        toast({
          title: 'Não foi possível abrir a nota',
          description: err instanceof Error ? err.message : 'Erro de rede',
          variant: 'destructive',
        })
      } finally {
        if (active) setLoadingDetailId((current) => (current === noteId ? null : current))
      }
    }
    void loadDetail()
    return () => {
      active = false
    }
  }, [details, selectedId])

  const detail = selectedId ? details[selectedId] || null : null
  const isDetailLoading = Boolean(selectedId && loadingDetailId === selectedId && !detail)
  const isPosted = detail?.status === 'posted'
  const isCanceled = detail?.status === 'canceled'
  const isFinished = Boolean(selectedId && (finishedIds[selectedId] || isPosted))
  const isLocked = isCanceled || isFinished

  const receivedOf = useCallback((item: NoteItem) => {
    if (item.id in receivedByItem) return receivedByItem[item.id]
    if (isPosted) return asQty(item.quantity)
    return 0
  }, [isPosted, receivedByItem])

  const progress = useMemo(() => {
    const items = detail?.items || []
    const verified = items.filter((item) => isItemComplete(item, receivedOf(item))).length
    const total = items.length
    return {
      verified,
      total,
      percent: total === 0 ? 0 : Math.round((verified / total) * 100),
    }
  }, [detail?.items, receivedOf])

  const setItemQty = useCallback((itemId: string, next: number) => {
    setReceivedByItem((current) => ({ ...current, [itemId]: next }))
    if (selectedId) {
      setFinishedIds((current) => {
        if (!current[selectedId]) return current
        const nextFinished = { ...current }
        delete nextFinished[selectedId]
        return nextFinished
      })
    }
  }, [selectedId])

  const selectNote = useCallback((noteId: string) => {
    setSelectedId(noteId)
  }, [])

  const onInvoiceQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setInvoiceQuery(event.target.value)
  }, [])

  const onProductQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setProductQuery(event.target.value)
  }, [])

  const searchNote = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const match = notes.find((note) => matchesNote(note, invoiceQuery))
    if (!match) {
      toast({ title: 'Nenhuma nota encontrada', variant: 'destructive' })
      return
    }
    setSelectedId(match.id)
  }, [invoiceQuery, notes])

  const searchProduct = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail || isLocked) return
    const pending = detail.items.find((item) => (
      matchesItem(item, productQuery) && !isItemComplete(item, receivedOf(item))
    ))
    const match = pending || detail.items.find((item) => matchesItem(item, productQuery))
    if (!match) {
      toast({ title: 'Produto não encontrado nesta nota', variant: 'destructive' })
      return
    }
    const qty = asQty(match.quantity)
    const current = receivedOf(match)
    if (current >= qty) {
      toast({ title: 'Este item já está conferido', variant: 'destructive' })
      return
    }
    setItemQty(match.id, Math.min(qty, roundQty(current + 1)))
    setProductQuery('')
  }, [detail, isLocked, productQuery, receivedOf, setItemQty])

  const applyBatch = useCallback(() => {
    if (!detail || isLocked) return
    setReceivedByItem((current) => {
      const next = { ...current }
      for (const item of detail.items) next[item.id] = asQty(item.quantity)
      return next
    })
    pushHistory(`Check-in em lote da ${noteLabel(detail)}`)
  }, [detail, isLocked, pushHistory])

  const resetConference = useCallback(() => {
    if (!detail || isCanceled) return
    setReceivedByItem((current) => {
      const next = { ...current }
      for (const item of detail.items) next[item.id] = isPosted ? asQty(item.quantity) : 0
      return next
    })
    if (selectedId) {
      setFinishedIds((current) => {
        if (!current[selectedId]) return current
        const next = { ...current }
        delete next[selectedId]
        return next
      })
    }
    pushHistory(`Conferência reiniciada da ${noteLabel(detail)}`)
  }, [detail, isCanceled, isPosted, pushHistory, selectedId])

  const finishConference = useCallback(() => {
    if (!detail || !selectedId || isCanceled) return
    if (isPosted) {
      toast({ title: 'Esta nota já foi lançada no estoque' })
      return
    }
    if (progress.total === 0 || progress.verified < progress.total) {
      toast({
        title: 'Confira todos os itens antes de finalizar',
        variant: 'destructive',
      })
      return
    }
    setFinishedIds((current) => ({ ...current, [selectedId]: true }))
    pushHistory(`Conferência finalizada da ${noteLabel(detail)}`)
    toast({ variant: 'success', title: 'Conferência concluída' })
  }, [detail, isCanceled, isPosted, progress.total, progress.verified, pushHistory, selectedId])

  const openSummary = useCallback(() => {
    setIsSummaryOpen(true)
  }, [])

  const openHistory = useCallback(() => {
    setIsHistoryOpen(true)
  }, [])

  const statusLabel = isCanceled
    ? 'Cancelada'
    : isFinished
      ? 'Conferido'
      : 'Check-in pendente'

  return (
    <main className='flex min-h-[calc(100dvh-8.5rem)] flex-col gap-3'>
      <h1 className='text-lg font-semibold'>Check-in de recebimento</h1>
      <div className='grid min-h-0 flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_260px]'>
        <section className='flex min-h-0 flex-col rounded-lg border bg-card'>
          <header className='flex items-center gap-2 border-b px-3 py-3'>
            <h2 className='text-sm font-semibold'>Notas</h2>
            <Badge variant='secondary'>{notes.length}</Badge>
          </header>
          <div className='min-h-0 flex-1 overflow-y-auto p-2'>
            {isLoadingList ? (
              <p className='px-2 py-4 text-sm text-muted-foreground'>Carregando notas...</p>
            ) : notes.length === 0 ? (
              <div className='px-2 py-4 text-sm text-muted-foreground'>
                <p>Nenhuma nota fiscal de entrada.</p>
                <Link
                  href='/portal/notas-fiscais-entrada'
                  className='mt-2 inline-block text-primary underline-offset-4 hover:underline'
                >
                  Importar uma nota
                </Link>
              </div>
            ) : notes.map((note) => {
              const selected = note.id === selectedId
              const pending = note.status === 'draft' && !finishedIds[note.id]
              const label = note.status === 'canceled'
                ? 'Cancelada'
                : note.status === 'posted' || finishedIds[note.id]
                  ? 'Conferido'
                  : 'Check-in pendente'
              return (
                <button
                  key={note.id}
                  type='button'
                  onClick={() => selectNote(note.id)}
                  className={`mb-2 w-full rounded-md border px-3 py-2 text-left last:mb-0 ${
                    selected ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted'
                  }`}
                  aria-current={selected ? 'true' : undefined}
                >
                  <span className='block text-sm font-semibold'>{noteLabel(note)}</span>
                  <Badge variant={pending ? 'outline' : 'secondary'} className='mt-1'>
                    {label}
                  </Badge>
                </button>
              )
            })}
          </div>
        </section>

        <section className='flex min-h-0 min-w-0 flex-col gap-3 rounded-lg border bg-card p-4'>
          {isLoadingList ? (
            <p className='text-sm text-muted-foreground'>Carregando notas...</p>
          ) : !selectedId ? (
            <div className='text-sm text-muted-foreground'>
              <p>Nenhuma nota para conferir.</p>
              <Link
                href='/portal/notas-fiscais-entrada'
                className='mt-2 inline-block text-primary underline-offset-4 hover:underline'
              >
                Abrir notas fiscais de entrada
              </Link>
            </div>
          ) : isDetailLoading || !detail ? (
            <p className='text-sm text-muted-foreground'>Carregando nota...</p>
          ) : (
            <>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h2 className='text-base font-semibold'>{supplierName(detail)}</h2>
                  <p className='text-sm text-muted-foreground'>{supplierDocument(detail)}</p>
                  <Link
                    href={`/portal/vendas/nfe/entradas/${encodeURIComponent(detail.id)}`}
                    className='text-sm text-primary underline-offset-4 hover:underline'
                  >
                    Abrir nota fiscal
                  </Link>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Quantidade de itens da nota</p>
                  <p className='text-lg font-semibold tabular-nums'>{detail.items.length}</p>
                </div>
                <Badge variant={isFinished && !isCanceled ? 'default' : 'outline'}>{statusLabel}</Badge>
              </div>

              <div className='grid gap-3 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-muted-foreground'>Nota fiscal</p>
                  <p className='text-sm font-medium'>{detail.number}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Data de inclusão da nota</p>
                  <p className='text-sm font-medium'>{formatDate(detail.created_at)}</p>
                </div>
              </div>

              <form onSubmit={searchNote} className='relative'>
                <label className='sr-only' htmlFor='checkin-chave'>
                  Chave de acesso ou número da nota
                </label>
                <Input
                  id='checkin-chave'
                  value={invoiceQuery}
                  onChange={onInvoiceQueryChange}
                  placeholder='Chave de acesso ou número da nota'
                  className='pr-12'
                />
                <Button
                  type='submit'
                  variant='ghost'
                  size='icon'
                  className='absolute right-1 top-1 h-8 w-8'
                  aria-label='Buscar nota'
                >
                  <Search />
                </Button>
              </form>

              <form onSubmit={searchProduct} className='relative'>
                <label className='sr-only' htmlFor='checkin-produto'>
                  Nome do produto, código no fornecedor, GTIN ou EAN
                </label>
                <Input
                  id='checkin-produto'
                  value={productQuery}
                  onChange={onProductQueryChange}
                  placeholder='Nome do produto, código no fornecedor, GTIN ou EAN'
                  disabled={isLocked}
                  className='pr-12'
                />
                <Button
                  type='submit'
                  variant='ghost'
                  size='icon'
                  className='absolute right-1 top-1 h-8 w-8'
                  aria-label='Buscar produto'
                  disabled={isLocked}
                >
                  <Search />
                </Button>
              </form>

              <div className='flex flex-wrap gap-1'>
                <Button type='button' variant='link' size='sm' onClick={applyBatch} disabled={isLocked}>
                  Check-in em lote
                </Button>
                <Button type='button' variant='link' size='sm' onClick={openSummary}>
                  Resumo de conferências
                </Button>
                <Button type='button' variant='link' size='sm' onClick={openHistory}>
                  Histórico de ações
                </Button>
              </div>

              <div className='min-h-0 flex-1 overflow-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'>
                        <span className='sr-only'>Conferido</span>
                      </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cód. fornecedor</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Un</TableHead>
                      <TableHead>Qtde Nota</TableHead>
                      <TableHead>Qtde Recebida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className='text-sm text-muted-foreground'>
                          Esta nota não tem itens.
                        </TableCell>
                      </TableRow>
                    ) : detail.items.map((item) => (
                      <CheckinItemRow
                        key={item.id}
                        item={item}
                        received={receivedOf(item)}
                        locked={isLocked}
                        onChange={setItemQty}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>

        <aside className='flex min-h-[220px] flex-col rounded-lg border bg-card p-4'>
          <h2 className='text-sm font-semibold'>Produtos verificados</h2>
          <p className='mt-3 text-sm tabular-nums text-muted-foreground' aria-live='polite'>
            {progress.verified} / {progress.total}
          </p>
          <Progress className='mt-2' value={progress.percent} />
          <p className='mt-4 text-xs text-muted-foreground'>
            A conferência fica nesta tela. O lançamento no estoque continua na nota fiscal.
          </p>
          <div className='mt-auto flex items-center justify-end gap-2 pt-6'>
            <Button type='button' variant='outline' onClick={resetConference} disabled={!detail || isCanceled}>
              Reiniciar
            </Button>
            <Button type='button' onClick={finishConference} disabled={!detail || isCanceled || isFinished}>
              Finalizar
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resumo de conferências</DialogTitle>
            <DialogDescription>
              Situação das notas carregadas nesta tela.
            </DialogDescription>
          </DialogHeader>
          <ul className='space-y-2 text-sm'>
            {notes.length === 0 ? (
              <li className='text-muted-foreground'>Nenhuma nota carregada.</li>
            ) : notes.map((note) => {
              const label = note.status === 'canceled'
                ? 'Cancelada'
                : note.status === 'posted' || finishedIds[note.id]
                  ? 'Conferido'
                  : 'Check-in pendente'
              return (
                <li key={note.id} className='flex items-center justify-between gap-3'>
                  <span>{noteLabel(note)}</span>
                  <span className='text-muted-foreground'>{label}</span>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de ações</DialogTitle>
            <DialogDescription>
              Ações desta conferência, nesta sessão.
            </DialogDescription>
          </DialogHeader>
          <ul className='space-y-2 text-sm'>
            {history.length === 0 ? (
              <li className='text-muted-foreground'>Nenhuma ação nesta conferência ainda.</li>
            ) : history.map((entry) => (
              <li key={entry.id}>
                <span className='text-muted-foreground'>{entry.at}</span>
                {' '}
                {entry.label}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </main>
  )
}
