'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateBr } from '@/lib/utils/format-date'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'

type CostRow = { id?: string; description: string; value_cents: number }

type ResaleDevice = {
  id: string
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  info: string | null
  imei: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  sale_value_cents: number | null
  expected_profit_wholesale_cents: number | null
  sold: boolean
  purchase_date: string | null
  sale_date: string | null
  costs: CostRow[]
}

function centsToReais(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function SeminovosListClient() {
  const router = useRouter()
  const [devices, setDevices] = useState<ResaleDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<ResaleDevice | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBulkEdit, setIsBulkEdit] = useState(false)
  const [isSavingBulk, setIsSavingBulk] = useState(false)
  const [editedDevices, setEditedDevices] = useState<ResaleDevice[]>([])

  const loadDevices = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/resale-devices')
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.devices)) {
        setDevices(data.devices)
      }
    } catch {
      setDevices([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  useEffect(() => {
    if (!isBulkEdit) {
      const sorted = [...devices].sort((a, b) => Number(a.sold) - Number(b.sold))
      setEditedDevices(sorted)
    }
  }, [devices, isBulkEdit])

  async function handleDelete() {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        await loadDevices()
        setDeleteTarget(null)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const sortedDevices = [...devices].sort((a, b) => Number(a.sold) - Number(b.sold))
  const rows = isBulkEdit ? editedDevices : sortedDevices

  function updateRow<K extends keyof ResaleDevice>(id: string, field: K, value: ResaleDevice[K]) {
    setEditedDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
  }

  function updateMoney(id: string, field: keyof ResaleDevice, raw: string) {
    const cleaned = raw.replace(/[^\d,-]/g, '').replace('.', '').replace(',', '.')
    const num = cleaned.trim() ? Number.parseFloat(cleaned) : NaN
    const cents = Number.isNaN(num) ? null : Math.round(num * 100)
    setEditedDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, [field]: cents as any } : d
      )
    )
  }

  async function handleStartBulkEdit() {
    const sorted = [...devices].sort((a, b) => Number(a.sold) - Number(b.sold))
    setEditedDevices(sorted)
    setIsBulkEdit(true)
  }

  function handleCancelBulkEdit() {
    setIsBulkEdit(false)
    const sorted = [...devices].sort((a, b) => Number(a.sold) - Number(b.sold))
    setEditedDevices(sorted)
  }

  async function handleSaveBulkEdit() {
    if (!isBulkEdit || isSavingBulk) return
    setIsSavingBulk(true)
    try {
      await Promise.all(
        editedDevices.map(async (d) => {
          await portalFetch(`/api/portal/resale-devices/${d.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_name: d.device_name,
              color: d.color,
              storage_gb: d.storage_gb,
              battery: d.battery,
              condition: d.condition,
              info: d.info,
              imei: d.imei,
              purchase_date: d.purchase_date,
              sale_date: d.sale_date,
              purchase_value_cents: d.purchase_value_cents,
              wholesale_value_cents: d.wholesale_value_cents,
              sale_value_cents: d.sale_value_cents,
            }),
          })
        })
      )
      await loadDevices()
      setIsBulkEdit(false)
    } finally {
      setIsSavingBulk(false)
    }
  }

  function handlePrintLabel(d: ResaleDevice) {
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', 'width=500,height=300')
    if (!win) return

    const aparelho = [
      d.device_name || '',
      d.storage_gb ? `${d.storage_gb}GB` : '',
      d.color || '',
    ]
      .map((p) => String(p).trim())
      .filter(Boolean)
      .join(' • ')

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>Etiqueta</title>
    <style>
      @page {
        size: 40mm 25mm;
        margin: 2mm;
      }
      body {
        margin: 0;
        padding: 0;
        width: 40mm;
        height: 25mm;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 9px;
        line-height: 1.2;
      }
      .label {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .line-strong {
        font-weight: 600;
      }
      .line {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="line line-strong">${aparelho || '-'}</div>
      <div class="line">${d.battery ? 'Bat: ' + d.battery : ''}</div>
      <div class="line">${d.info ? 'Info: ' + d.info : ''}</div>
      <div class="line">${d.imei ? 'IMEI: ' + d.imei : ''}</div>
    </div>
    <script>
      window.onload = function() {
        window.print();
      };
    </script>
  </body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Seminovos</h1>
            <p className="text-sm text-muted-foreground">
              Aparelhos seminovos para revenda. Acesso exclusivo para staff e administrador.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isBulkEdit ? (
              <>
                <Button asChild>
                  <Link href="/portal/seminovos/nova">
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar aparelho
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleStartBulkEdit}
                >
                  Edição em massa
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelBulkEdit}
                  disabled={isSavingBulk}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveBulkEdit}
                  disabled={isSavingBulk}
                >
                  {isSavingBulk ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de aparelhos</CardTitle>
            <CardDescription>
              {devices.length} aparelho(s) cadastrado(s).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum aparelho cadastrado.{' '}
                <Link href="/portal/seminovos/nova" className="text-primary underline">
                  Cadastrar aparelho
                </Link>
              </p>
            ) : (
              <>
                <ResumoFinanceiro devices={devices} />
                <div className="overflow-x-auto">
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aparelho</TableHead>
                    <TableHead>Bateria</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Informações</TableHead>
                    <TableHead>Valor compra</TableHead>
                    <TableHead>Custos</TableHead>
                    <TableHead>Valor atacado</TableHead>
                    <TableHead>Valor venda</TableHead>
                    <TableHead>Data compra</TableHead>
                    <TableHead>Data venda</TableHead>
                    <TableHead className="w-[70px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((d) => {
                    const totalCostsCents = (d.costs || []).reduce(
                      (acc, c) => acc + (c.value_cents ?? 0),
                      0
                    )
                    const aparelho = [
                      d.device_name || '',
                      d.storage_gb ? `${d.storage_gb}GB` : '',
                      d.color || '',
                    ]
                      .map((part) => part.trim())
                      .filter(Boolean)
                      .join(' • ')
                    return (
                      <TableRow
                        key={d.id}
                        className={`${!isBulkEdit ? 'cursor-pointer' : ''} ${d.sold ? 'bg-muted/60' : ''}`}
                        onClick={() => {
                          if (!isBulkEdit && d.id) router.push(`/portal/seminovos/${d.id}`)
                        }}
                      >
                        <TableCell className="font-medium" title={aparelho || d.device_name || ''}>
                          {isBulkEdit ? (
                            <Input
                              value={d.device_name || ''}
                              onChange={(e) => updateRow(d.id, 'device_name', e.target.value)}
                              placeholder="Nome do aparelho"
                            />
                          ) : (
                            aparelho || d.device_name || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              value={d.battery || ''}
                              onChange={(e) => updateRow(d.id, 'battery', e.target.value)}
                              placeholder="Bateria"
                            />
                          ) : (
                            d.battery || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              value={d.condition || ''}
                              onChange={(e) => updateRow(d.id, 'condition', e.target.value)}
                              placeholder="Estado"
                            />
                          ) : (
                            d.condition || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              value={d.imei || ''}
                              onChange={(e) => updateRow(d.id, 'imei', e.target.value)}
                              placeholder="IMEI"
                            />
                          ) : (
                            d.imei || '-'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate" title={d.info || ''}>
                          {isBulkEdit ? (
                            <Input
                              value={d.info || ''}
                              onChange={(e) => updateRow(d.id, 'info', e.target.value)}
                              placeholder="Informações"
                            />
                          ) : (
                            d.info || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              value={d.purchase_value_cents != null ? centsToReais(d.purchase_value_cents) : ''}
                              onChange={(e) => updateMoney(d.id, 'purchase_value_cents', e.target.value)}
                              placeholder="0,00"
                            />
                          ) : (
                            d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              value={d.wholesale_value_cents != null ? centsToReais(d.wholesale_value_cents) : ''}
                              onChange={(e) => updateMoney(d.id, 'wholesale_value_cents', e.target.value)}
                              placeholder="0,00"
                            />
                          ) : (
                            d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              value={d.sale_value_cents != null ? centsToReais(d.sale_value_cents) : ''}
                              onChange={(e) => updateMoney(d.id, 'sale_value_cents', e.target.value)}
                              placeholder="0,00"
                            />
                          ) : (
                            d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              type="date"
                              value={d.purchase_date || ''}
                              onChange={(e) => updateRow(d.id, 'purchase_date', e.target.value)}
                            />
                          ) : (
                            d.purchase_date ? formatDateBr(d.purchase_date) : '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulkEdit ? (
                            <Input
                              type="date"
                              value={d.sale_date || ''}
                              onChange={(e) => updateRow(d.id, 'sale_date', e.target.value)}
                            />
                          ) : (
                            d.sale_date ? formatDateBr(d.sale_date) : '-'
                          )}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/portal/seminovos/${d.id}`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(d)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
              </>
            )}
          </CardContent>
      </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aparelho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este aparelho? Os custos vinculados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
