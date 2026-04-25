'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

/** Linha retornada pela API de sugestões (produto ou serviço). */
export type SugestaoVinculoRow = {
  productId: string
  name: string
  currentPricingTagId: string | null
  currentPricingTagName: string | null
  currentModelIds: string[]
  currentModelLabels: string[]
  suggestedPricingTagId: string | null
  suggestedPricingTagName: string | null
  suggestedModelId: string | null
  suggestedModelLabel: string | null
  canApply: boolean
}

function buildPatchBody (row: SugestaoVinculoRow): Record<string, unknown> | null {
  const body: Record<string, unknown> = { productId: row.productId }
  let has = false
  if (
    row.suggestedPricingTagId
    && row.suggestedPricingTagId !== row.currentPricingTagId
  ) {
    body.pricingTagId = row.suggestedPricingTagId
    has = true
  }
  if (
    row.suggestedModelId
    && !row.currentModelIds.includes(row.suggestedModelId)
  ) {
    body.compatibleModelIds = [...row.currentModelIds, row.suggestedModelId]
    has = true
  }
  if (!has) return null
  return body
}

type Props = {
  /** Catálogo analisado: produtos físicos ou serviços. */
  catalogKind: 'product' | 'service'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssistenciaServicoLinkModal ({
  catalogKind,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [items, setItems] = useState<SugestaoVinculoRow[]>([])
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  const copy = useMemo(() => {
    const isProduct = catalogKind === 'product'
    return {
      title: isProduct ? 'Sugestões de vínculo (produtos)' : 'Sugestões de vínculo (serviços)',
      description: isProduct
        ? (
            'Só aparecem produtos sem tag de precificação e sem modelo compatível, quando a heurística consegue '
            + 'sugerir os dois ao mesmo tempo (tag pelo nome + modelo pelo catálogo). Revise antes de aplicar.'
          )
        : (
            'Só aparecem serviços sem tag de precificação e sem modelo compatível, quando a heurística consegue '
            + 'sugerir tag e modelo juntos. Revise antes de aplicar.'
          ),
      nameColumn: isProduct ? 'Produto' : 'Serviço',
      loadingLabel: isProduct ? 'Carregando produtos e sugestões…' : 'Carregando serviços e sugestões…',
      emptyLabel: isProduct
        ? (
            'Nenhum produto sem tag e sem modelo com sugestão completa (tag + modelo). '
            + 'Todos os itens ativos do catálogo foram analisados; ajuste nomes, tags ou cadastro de modelos.'
          )
        : (
            'Nenhum serviço sem tag e sem modelo com sugestão completa (tag + modelo). '
            + 'Todos os itens ativos do catálogo foram analisados; ajuste nomes, tags ou cadastro de modelos.'
          ),
      itemNoun: isProduct ? 'produto' : 'serviço',
      kindQuery: isProduct ? 'product' : 'service',
    }
  }, [catalogKind])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ kind: catalogKind })
      const res = await fetch(
        `/api/portal/staff/produtos/servicos-sugestoes-vinculo?${qs.toString()}`,
        { method: 'GET', cache: 'no-store' },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível carregar sugestões',
          description: String(data?.error || 'Tente novamente.'),
        })
        setItems([])
        return
      }
      setItems(data.items as SugestaoVinculoRow[])
      setChecked(new Set())
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar sugestões' })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [catalogKind])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const applicableIds = useMemo(
    () => new Set(items.filter((r) => r.canApply).map((r) => r.productId)),
    [items],
  )

  const selectedApplicableCount = useMemo(() => {
    let n = 0
    for (const id of checked) {
      if (applicableIds.has(id)) n += 1
    }
    return n
  }, [checked, applicableIds])

  const toggleOne = (id: string, next: boolean) => {
    setChecked((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }

  const selectAllApplicable = () => {
    setChecked(new Set(applicableIds))
  }

  const clearSelection = () => setChecked(new Set())

  const applyRows = async (rows: SugestaoVinculoRow[]) => {
    const patchItems: Array<Record<string, unknown>> = []
    for (const row of rows) {
      const body = buildPatchBody(row)
      if (body) patchItems.push(body)
    }
    if (patchItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para aplicar',
        description: 'Nenhuma alteração pendente nas linhas escolhidas.',
      })
      return
    }

    setApplying(true)
    try {
      let totalOk = 0
      let totalFail = 0
      const chunk = 180
      for (let i = 0; i < patchItems.length; i += chunk) {
        const slice = patchItems.slice(i, i + chunk)
        const res = await fetch('/api/portal/staff/produtos/bulk-patch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: slice }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro ao aplicar',
            description: String(data?.error || 'Tente novamente.'),
          })
          return
        }
        totalOk += typeof data.updated === 'number' ? data.updated : 0
        totalFail += typeof data.failed === 'number' ? data.failed : 0
      }

      const noun = catalogKind === 'product' ? 'produto(s)' : 'serviço(s)'
      toast({
        variant: totalFail > 0 ? 'default' : 'default',
        title: 'Vínculos atualizados',
        description: `${totalOk} ${noun} atualizado(s)${totalFail > 0 ? `, ${totalFail} falha(s)` : ''}.`,
      })

      if (totalOk > 0) {
        onSuccess()
        await load()
        setChecked(new Set())
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao aplicar' })
    } finally {
      setApplying(false)
    }
  }

  const handleApplySelected = () => {
    const rows = items.filter((r) => checked.has(r.productId) && r.canApply)
    void applyRows(rows)
  }

  const handleApplyOne = (row: SugestaoVinculoRow) => {
    void applyRows([row])
  }

  const editHref = (productId: string) =>
    `/portal/produtos?tab=gestao&kind=${copy.kindQuery}&edit=${encodeURIComponent(productId)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Link2 className="h-5 w-5 shrink-0 opacity-80" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-left text-sm">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={loading || applying}
              onClick={() => void load()}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Recarregar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={loading || applying || applicableIds.size === 0}
              onClick={selectAllApplicable}
            >
              Selecionar pendentes
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={loading || applying || checked.size === 0}
              onClick={clearSelection}
            >
              Limpar seleção
            </Button>
            <span className="text-xs text-muted-foreground sm:ml-auto">
              {selectedApplicableCount > 0
                ? `${selectedApplicableCount} selecionado(s) com alteração pendente`
                : null}
            </span>
          </div>

          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-md border',
              '[-webkit-overflow-scrolling:touch]',
            )}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.loadingLabel}
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                {copy.emptyLabel}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-3" />
                    <TableHead>{copy.nameColumn}</TableHead>
                    <TableHead className="hidden lg:table-cell">Atual</TableHead>
                    <TableHead>Sugestão</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => {
                    const sugParts: string[] = []
                    if (row.suggestedPricingTagName) {
                      sugParts.push(`Tag: ${row.suggestedPricingTagName}`)
                    }
                    if (row.suggestedModelLabel) {
                      sugParts.push(`Modelo: ${row.suggestedModelLabel}`)
                    }
                    const curParts: string[] = []
                    if (row.currentPricingTagName) curParts.push(row.currentPricingTagName)
                    else curParts.push('— tag')
                    if (row.currentModelLabels.length > 0) {
                      curParts.push(row.currentModelLabels.slice(0, 2).join(', '))
                    } else curParts.push('— modelo')

                    return (
                      <TableRow
                        key={row.productId}
                        className={cn(!row.canApply && 'bg-muted/30 text-muted-foreground')}
                      >
                        <TableCell className="pl-3 align-middle">
                          <Checkbox
                            checked={checked.has(row.productId)}
                            disabled={!row.canApply || applying}
                            onCheckedChange={(v) => toggleOne(row.productId, v === true)}
                            aria-label={`Selecionar ${row.name}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[200px] align-top text-sm font-medium sm:max-w-xs">
                          <span className="line-clamp-2">{row.name}</span>
                          <Link
                            href={editHref(row.productId)}
                            className="mt-1 inline-block text-xs font-normal text-primary underline-offset-4 hover:underline"
                          >
                            Abrir cadastro
                          </Link>
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] align-top text-xs lg:table-cell">
                          <span className="line-clamp-3">{curParts.join(' · ')}</span>
                        </TableCell>
                        <TableCell className="max-w-[240px] align-top text-xs sm:max-w-xs">
                          <span className="line-clamp-3 text-foreground">{sugParts.join(' · ')}</span>
                          {!row.canApply ? (
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                              Já reflete a sugestão (ou não há mudança).
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right align-middle">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8"
                            disabled={!row.canApply || applying}
                            onClick={() => handleApplyOne(row)}
                          >
                            Aplicar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={applying} onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            disabled={applying || selectedApplicableCount === 0}
            onClick={handleApplySelected}
          >
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando…
              </>
            ) : (
              `Aplicar em massa (${selectedApplicableCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
