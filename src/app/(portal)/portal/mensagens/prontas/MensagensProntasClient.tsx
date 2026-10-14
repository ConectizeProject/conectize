'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { appConfirm } from '@/lib/ui/app-dialogs'

type ReadyMessage = {
  id: string
  title: string
  body: string
  updated_at: string
}

type EditorState = {
  id: string | null
  title: string
  body: string
}

const EMPTY_EDITOR: EditorState = { id: null, title: '', body: '' }

function errorMessage (error: string | undefined) {
  if (error === 'duplicate_title') return 'Já existe uma mensagem com esse título.'
  if (error === 'invalid_payload') return 'Informe um título de até 80 caracteres e a mensagem.'
  return 'Não foi possível salvar a mensagem.'
}

export function MensagensProntasClient () {
  const [messages, setMessages] = useState<ReadyMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/mensagens-prontas')
      const data = await res.json().catch(() => null) as { ok?: boolean, messages?: ReadyMessage[], message?: string } | null
      if (!data?.ok || !Array.isArray(data.messages)) {
        setMessages([])
        const missingTable = typeof data?.message === 'string' && data.message.includes('ready_messages')
        setLoadError(missingTable
          ? 'O cadastro ainda não está no banco. Falta aplicar a migration das mensagens prontas.'
          : 'Não foi possível carregar as mensagens.')
        return
      }
      setLoadError(null)
      setMessages(data.messages)
    } catch (err) {
      setMessages([])
      setLoadError('Não foi possível carregar as mensagens.')
      toast({
        title: 'Não foi possível carregar as mensagens',
        description: err instanceof Error ? err.message : 'Erro de rede',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = useCallback(() => {
    setEditor(EMPTY_EDITOR)
  }, [])

  const openEdit = useCallback((message: ReadyMessage) => {
    setEditor({ id: message.id, title: message.title, body: message.body })
  }, [])

  const closeEditor = useCallback((open: boolean) => {
    if (!open && !isSaving) setEditor(null)
  }, [isSaving])

  const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setEditor((current) => current ? { ...current, title: value } : current)
  }, [])

  const onBodyChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    setEditor((current) => current ? { ...current, body: value } : current)
  }, [])

  const save = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor) return
    setIsSaving(true)
    try {
      const isEdit = Boolean(editor.id)
      const res = await portalFetch(
        isEdit
          ? `/api/portal/mensagens-prontas/${encodeURIComponent(editor.id || '')}`
          : '/api/portal/mensagens-prontas',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: editor.title, body: editor.body }),
        },
      )
      const data = await res.json().catch(() => null) as { ok?: boolean, error?: string, message?: ReadyMessage } | null
      if (!data?.ok || !data.message) {
        toast({ title: errorMessage(data?.error), variant: 'destructive' })
        return
      }
      const saved = data.message
      setMessages((current) => {
        const next = isEdit
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved]
        return next.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
      })
      setEditor(null)
      toast({ variant: 'success', title: isEdit ? 'Mensagem atualizada' : 'Mensagem criada' })
    } catch (err) {
      toast({
        title: 'Não foi possível salvar a mensagem',
        description: err instanceof Error ? err.message : 'Erro de rede',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, [editor])

  const remove = useCallback(async (message: ReadyMessage) => {
    const confirmed = await appConfirm({
      title: 'Excluir mensagem pronta?',
      description: `A resposta "${message.title}" deixa de aparecer no cadastro.`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!confirmed) return
    try {
      const res = await portalFetch(`/api/portal/mensagens-prontas/${encodeURIComponent(message.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => null) as { ok?: boolean } | null
      if (!data?.ok) {
        toast({ title: 'Não foi possível excluir a mensagem', variant: 'destructive' })
        return
      }
      setMessages((current) => current.filter((item) => item.id !== message.id))
      toast({ variant: 'success', title: 'Mensagem excluída' })
    } catch (err) {
      toast({
        title: 'Não foi possível excluir a mensagem',
        description: err instanceof Error ? err.message : 'Erro de rede',
        variant: 'destructive',
      })
    }
  }, [])

  return (
    <main className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold'>Mensagens prontas</h1>
          <p className='text-sm text-muted-foreground'>
            Respostas reutilizáveis para WhatsApp e Mercado Livre.
          </p>
        </div>
        <Button type='button' onClick={openCreate}>
          <Plus />
          Nova mensagem
        </Button>
      </div>

      <div className='rounded-lg border bg-card'>
        {isLoading ? (
          <p className='p-4 text-sm text-muted-foreground'>Carregando mensagens...</p>
        ) : loadError ? (
          <p className='p-4 text-sm text-muted-foreground'>{loadError}</p>
        ) : messages.length === 0 ? (
          <p className='p-4 text-sm text-muted-foreground'>Nenhuma mensagem pronta ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className='w-[120px] text-right'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((message) => (
                <ReadyMessageRow
                  key={message.id}
                  message={message}
                  onEdit={openEdit}
                  onDelete={remove}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={editor !== null} onOpenChange={closeEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.id ? 'Editar mensagem' : 'Nova mensagem'}</DialogTitle>
          </DialogHeader>
          <form className='space-y-4' onSubmit={save}>
            <div className='space-y-2'>
              <Label htmlFor='ready-message-title'>Título</Label>
              <Input
                id='ready-message-title'
                value={editor?.title || ''}
                onChange={onTitleChange}
                maxLength={80}
                required
                autoFocus
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='ready-message-body'>Mensagem</Label>
              <Textarea
                id='ready-message-body'
                value={editor?.body || ''}
                onChange={onBodyChange}
                maxLength={4000}
                required
                rows={6}
              />
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setEditor(null)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type='submit' disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function ReadyMessageRow ({
  message,
  onEdit,
  onDelete,
}: {
  message: ReadyMessage
  onEdit: (message: ReadyMessage) => void
  onDelete: (message: ReadyMessage) => void
}) {
  const edit = useCallback(() => {
    onEdit(message)
  }, [message, onEdit])

  const remove = useCallback(() => {
    void onDelete(message)
  }, [message, onDelete])

  return (
    <TableRow>
      <TableCell className='font-medium'>{message.title}</TableCell>
      <TableCell className='max-w-[480px] whitespace-normal text-muted-foreground'>
        {message.body}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-1'>
          <Button type='button' variant='ghost' size='icon' onClick={edit} aria-label={`Editar ${message.title}`}>
            <Pencil />
          </Button>
          <Button type='button' variant='ghost' size='icon' onClick={remove} aria-label={`Excluir ${message.title}`}>
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
