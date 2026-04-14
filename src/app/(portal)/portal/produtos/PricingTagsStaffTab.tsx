'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'

type PricingTag = {
  id: string
  name: string
  parts_family: string | null
  margin_bps: number | null
  min_suggested_sale_cents: number | null
}

const FAMILY_OPTIONS = [
  { value: '', label: '(nenhuma)' },
  { value: 'display', label: 'Display' },
  { value: 'glass', label: 'Vidro' },
  { value: 'battery', label: 'Bateria' },
  { value: 'connector', label: 'Conector' },
]

type RetailerRow = { id: string; email: string | null; full_name: string | null }

type OverrideRow = {
  id: string
  pricing_tag_id: string
  retailer_user_id: string
  margin_bps: number | null
  min_suggested_sale_cents: number | null
}

function PricingTagOverridesStaffSection ({ pricingTags }: { pricingTags: PricingTag[] }) {
  const [retailers, setRetailers] = useState<RetailerRow[]>([])
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOverride, setEditOverride] = useState<OverrideRow | null>(null)
  const [retailerUserId, setRetailerUserId] = useState('')
  const [pricingTagId, setPricingTagId] = useState('')
  const [marginBps, setMarginBps] = useState('')
  const [minCents, setMinCents] = useState('')
  const [saving, setSaving] = useState(false)

  const tagNameById = useCallback((id: string) => {
    return pricingTags.find((t) => t.id === id)?.name || id
  }, [pricingTags])

  const retailerLabel = useCallback((u: RetailerRow) => {
    const n = (u.full_name || '').trim()
    if (n) return n
    return (u.email || '').trim() || u.id
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [rRes, oRes] = await Promise.all([
      fetch('/api/portal/staff/retailers'),
      fetch('/api/portal/staff/pricing-tag-overrides'),
    ])
    const rJson = await rRes.json().catch(() => null)
    const oJson = await oRes.json().catch(() => null)
    setLoading(false)
    if (rRes.ok && rJson?.ok) {
      setRetailers((rJson.retailers || []) as RetailerRow[])
    } else {
      setRetailers([])
      toast({ title: 'Erro', description: 'Não foi possível carregar lojistas.', variant: 'destructive' })
    }
    if (oRes.ok && oJson?.ok) {
      setOverrides((oJson.overrides || []) as OverrideRow[])
    } else {
      setOverrides([])
      toast({ title: 'Erro', description: 'Não foi possível carregar overrides.', variant: 'destructive' })
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function openCreateOverride () {
    setEditOverride(null)
    setRetailerUserId('')
    setPricingTagId('')
    setMarginBps('')
    setMinCents('')
    setDialogOpen(true)
  }

  function openEditOverride (o: OverrideRow) {
    setEditOverride(o)
    setRetailerUserId(o.retailer_user_id)
    setPricingTagId(o.pricing_tag_id)
    setMarginBps(o.margin_bps != null ? String(o.margin_bps) : '')
    setMinCents(o.min_suggested_sale_cents != null ? String(o.min_suggested_sale_cents) : '')
    setDialogOpen(true)
  }

  async function saveOverride () {
    if (!editOverride) {
      if (!retailerUserId || !pricingTagId) {
        toast({ title: 'Preencha lojista e tag', variant: 'destructive' })
        return
      }
    }
    setSaving(true)
    if (editOverride) {
      const res = await fetch(`/api/portal/staff/pricing-tag-overrides/${editOverride.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginBps: marginBps.trim() === '' ? null : Number(marginBps),
          minSuggestedSaleCents: minCents.trim() === '' ? null : Number(minCents),
        }),
      })
      const json = await res.json().catch(() => null)
      setSaving(false)
      if (!res.ok || !json?.ok) {
        toast({ title: 'Erro ao salvar', description: String(json?.error || ''), variant: 'destructive' })
        return
      }
      toast({ title: 'Override atualizado' })
    } else {
      const res = await fetch('/api/portal/staff/pricing-tag-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailerUserId: retailerUserId,
          pricingTagId: pricingTagId,
          marginBps: marginBps.trim() === '' ? null : Number(marginBps),
          minSuggestedSaleCents: minCents.trim() === '' ? null : Number(minCents),
        }),
      })
      const json = await res.json().catch(() => null)
      setSaving(false)
      if (!res.ok || !json?.ok) {
        toast({ title: 'Erro ao salvar', description: String(json?.error || ''), variant: 'destructive' })
        return
      }
      toast({ title: 'Override salvo' })
    }
    setDialogOpen(false)
    void loadAll()
  }

  async function deleteOverride (id: string) {
    if (!window.confirm('Remover override desta tag para o lojista?')) return
    const res = await fetch(`/api/portal/staff/pricing-tag-overrides/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
      return
    }
    toast({ title: 'Override removido' })
    void loadAll()
  }

  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">Overrides por lojista</CardTitle>
          <CardDescription>
            Margem e piso sugeridos customizados por lojista (substituem a tag global no catálogo dele).
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={openCreateOverride}>
          <Plus className="mr-1 h-4 w-4" />
          Novo override
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Lojista</TableHead>
                  <TableHead className="text-right">Margem (bps)</TableHead>
                  <TableHead className="text-right">Mínimo (¢)</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum override cadastrado.
                    </TableCell>
                  </TableRow>
                ) : null}
                {overrides.map((o) => {
                  const r = retailers.find((x) => x.id === o.retailer_user_id)
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{tagNameById(o.pricing_tag_id)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r ? retailerLabel(r) : o.retailer_user_id}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{o.margin_bps ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.min_suggested_sale_cents ?? '—'}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditOverride(o)} aria-label="Editar override">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void deleteOverride(o.id)} aria-label="Excluir override">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editOverride ? 'Editar override' : 'Novo override'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {!editOverride ? (
              <>
                <div className="grid gap-1">
                  <Label>Lojista</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={retailerUserId}
                    onChange={(e) => setRetailerUserId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {retailers.map((u) => (
                      <option key={u.id} value={u.id}>{retailerLabel(u)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label>Tag</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={pricingTagId}
                    onChange={(e) => setPricingTagId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {pricingTags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tagNameById(editOverride.pricing_tag_id)}
                {' · '}
                {(() => {
                  const r = retailers.find((x) => x.id === editOverride.retailer_user_id)
                  return r ? retailerLabel(r) : editOverride.retailer_user_id
                })()}
              </p>
            )}
            <div className="grid gap-1">
              <Label htmlFor="ov-margin">Margem (bps)</Label>
              <Input id="ov-margin" inputMode="numeric" value={marginBps} onChange={(e) => setMarginBps(e.target.value)} placeholder="vazio = herdar da tag" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ov-min">Piso sugerido (centavos)</Label>
              <Input id="ov-min" inputMode="numeric" value={minCents} onChange={(e) => setMinCents(e.target.value)} placeholder="opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void saveOverride()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function PricingTagsStaffTab () {
  const [tags, setTags] = useState<PricingTag[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PricingTag | null>(null)
  const [name, setName] = useState('')
  const [partsFamily, setPartsFamily] = useState('')
  const [marginBps, setMarginBps] = useState('')
  const [minCents, setMinCents] = useState('')
  const [saving, setSaving] = useState(false)

  const loadTags = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/portal/staff/pricing-tags')
    const json = await res.json().catch(() => null)
    setLoading(false)
    if (!res.ok || !json?.ok) {
      toast({ title: 'Erro', description: 'Não foi possível carregar as tags.', variant: 'destructive' })
      setTags([])
      return
    }
    setTags((json.pricingTags || []) as PricingTag[])
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  function openCreate () {
    setEditing(null)
    setName('')
    setPartsFamily('')
    setMarginBps('')
    setMinCents('')
    setDialogOpen(true)
  }

  function openEdit (t: PricingTag) {
    setEditing(t)
    setName(t.name || '')
    setPartsFamily(t.parts_family || '')
    setMarginBps(t.margin_bps != null ? String(t.margin_bps) : '')
    setMinCents(t.min_suggested_sale_cents != null ? String(t.min_suggested_sale_cents) : '')
    setDialogOpen(true)
  }

  async function handleSave () {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload: Record<string, unknown> = {
      name: trimmedName,
      partsFamily: partsFamily || null,
      marginBps: marginBps.trim() === '' ? null : Number(marginBps),
      minSuggestedSaleCents: minCents.trim() === '' ? null : Number(minCents),
    }
    const url = editing
      ? `/api/portal/staff/pricing-tags/${editing.id}`
      : '/api/portal/staff/pricing-tags'
    const res = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok || !json?.ok) {
      toast({
        title: 'Erro ao salvar',
        description: String(json?.error || 'Tente novamente.'),
        variant: 'destructive',
      })
      return
    }
    toast({ title: editing ? 'Tag atualizada' : 'Tag criada' })
    setDialogOpen(false)
    void loadTags()
  }

  async function handleDelete (id: string) {
    if (!window.confirm('Excluir esta tag de precificação?')) return
    const res = await fetch(`/api/portal/staff/pricing-tags/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
      return
    }
    toast({ title: 'Tag excluída' })
    void loadTags()
  }

  return (
    <div className="space-y-6">
    <Card className="min-w-0 max-w-full">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">Tags de precificação</CardTitle>
          <CardDescription>
            Regras globais de margem (sobre preço de venda) e piso mínimo sugerido; usadas no catálogo comercial.
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nova tag
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Família</TableHead>
                  <TableHead className="text-right">Margem (bps)</TableHead>
                  <TableHead className="text-right">Mínimo (¢)</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma tag cadastrada.
                    </TableCell>
                  </TableRow>
                ) : null}
                {tags.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.parts_family || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.margin_bps ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.min_suggested_sale_cents ?? '—'}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(t.id)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tag' : 'Nova tag'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label htmlFor="pt-name">Nome</Label>
              <Input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Troca de display" />
            </div>
            <div className="grid gap-1">
              <Label>Família</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={partsFamily}
                onChange={(e) => setPartsFamily(e.target.value)}
              >
                {FAMILY_OPTIONS.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="pt-margin">Margem (bps, 0–9999)</Label>
              <Input id="pt-margin" inputMode="numeric" value={marginBps} onChange={(e) => setMarginBps(e.target.value)} placeholder="ex.: 2500" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="pt-min">Piso sugerido (centavos)</Label>
              <Input id="pt-min" inputMode="numeric" value={minCents} onChange={(e) => setMinCents(e.target.value)} placeholder="opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    <PricingTagOverridesStaffSection pricingTags={tags} />
    </div>
  )
}
