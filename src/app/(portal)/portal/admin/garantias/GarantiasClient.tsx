'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { appConfirm } from '@/lib/ui/app-dialogs'

type WarrantyTemplate = {
  id: string
  name: string
  body: string
  is_active?: boolean
  is_default?: boolean
}

type Props = {
  initialTemplates: WarrantyTemplate[]
}

function normalizeTemplates(list: WarrantyTemplate[] | null | undefined): WarrantyTemplate[] {
  if (!Array.isArray(list)) return []
  return list
}

export function GarantiasClient({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<WarrantyTemplate[]>(() => normalizeTemplates(initialTemplates))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WarrantyTemplate | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    const res = await portalFetch('/api/portal/admin/warranty-templates')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.templates)) {
      setTemplates(data.templates)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  function openCreate() {
    setEditing(null)
    setName('')
    setBody('')
    setIsActive(true)
    setIsDefault(false)
    setDialogOpen(true)
  }

  function openEdit(t: WarrantyTemplate) {
    setEditing(t)
    setName(t.name || '')
    setBody(t.body || '')
    setIsActive(t.is_active ?? true)
    setIsDefault(t.is_default ?? false)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedBody = body.trim()
    if (!trimmedName || !trimmedBody) {
      toast({ title: 'Preencha nome e texto da garantia', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name: trimmedName,
        body: trimmedBody,
        is_active: isActive,
        is_default: isDefault,
      }

      let res: Response | null = null
      if (editing) {
        res = await portalFetch(`/api/portal/admin/warranty-templates/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await portalFetch('/api/portal/admin/warranty-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res?.json().catch(() => null)
      if (!res || !res.ok || !data?.ok) {
        toast({ title: 'Erro ao salvar modelo de garantia', variant: 'destructive' })
        return
      }

      toast({
        title: editing ? 'Modelo de garantia atualizado' : 'Modelo de garantia criado',
      })
      setDialogOpen(false)
      loadTemplates()
    } catch {
      toast({ title: 'Erro ao salvar modelo de garantia', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!id) return
    if (!(await appConfirm({
      title: 'Excluir modelo de garantia?',
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    }))) return

    const res = await portalFetch(`/api/portal/admin/warranty-templates/${id}`, {
      method: 'DELETE',
    })
    const data = await res?.json().catch(() => null)
    if (!res?.ok || !data?.ok) {
      toast({ title: 'Erro ao excluir modelo de garantia', variant: 'destructive' })
      return
    }

    toast({ title: 'Modelo de garantia excluído' })
    loadTemplates()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Modelos de garantia</CardTitle>
              <CardDescription>
                Cadastre e edite textos de garantia usados nas ordens de serviço.
              </CardDescription>
            </div>
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum modelo cadastrado ainda. Clique em &quot;Novo modelo&quot; para adicionar.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.name}</span>
                      {t.is_default && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 border border-emerald-200 bg-emerald-50 rounded px-1 py-0.5">
                          Padrão
                        </span>
                      )}
                      {t.is_active === false && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground border border-dashed rounded px-1 py-0.5">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Editar modelo"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir modelo"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editing ? 'Editar modelo de garantia' : 'Novo modelo de garantia'}
              </DialogTitle>
              <DialogDescription>
                Defina o nome, o texto e as opções deste modelo. Ele poderá ser reutilizado nas ordens de serviço.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="warranty-name">Nome do modelo</Label>
              <Input
                id="warranty-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Garantia padrão 6 meses"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warranty-body">Texto da garantia</Label>
              <Textarea
                id="warranty-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Texto que será copiado para a OS ao selecionar este modelo."
              />
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Ativo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Definir como padrão
              </label>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Salvar alterações' : 'Criar modelo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

