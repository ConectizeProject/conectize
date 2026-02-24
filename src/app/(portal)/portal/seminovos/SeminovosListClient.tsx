'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
          <Button asChild>
            <Link href="/portal/seminovos/nova">
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar aparelho
            </Link>
          </Button>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aparelho</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Gb</TableHead>
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
                  {sortedDevices.map((d) => {
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
                      .join(' ')
                    return (
                      <TableRow
                        key={d.id}
                        className={`cursor-pointer ${d.sold ? 'bg-muted/60' : ''}`}
                        onClick={() => d.id && router.push(`/portal/seminovos/${d.id}`)}
                      >
                        <TableCell className="font-medium" title={aparelho || d.device_name || ''}>
                          {aparelho || d.device_name || '-'}
                        </TableCell>
                        <TableCell>{d.color || '-'}</TableCell>
                        <TableCell>{d.storage_gb || '-'}</TableCell>
                        <TableCell>{d.battery || '-'}</TableCell>
                        <TableCell>{d.condition || '-'}</TableCell>
                        <TableCell>{d.imei || '-'}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={d.info || ''}>
                          {d.info || '-'}
                        </TableCell>
                        <TableCell>
                          {d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {d.purchase_date ? formatDateBr(d.purchase_date) : '-'}
                        </TableCell>
                        <TableCell>
                          {d.sale_date ? formatDateBr(d.sale_date) : '-'}
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
