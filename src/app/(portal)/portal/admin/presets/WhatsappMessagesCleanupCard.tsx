'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  WHATSAPP_MESSAGE_PURGE_SCOPES,
  whatsappMessagePurgeCutoffIso,
  type WhatsappMessagePurgeScope,
} from '@/lib/whatsapp/whatsapp-messages-db-cleanup'

type PurgeResponse = {
  ok?: boolean
  deletedMessages?: number
  deletedConversations?: number
  error?: string
}

type WhatsappMessagesCleanupCardProps = {
  onStorageChanged?: () => void | Promise<void>
}

function formatCutoffDate (iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR')
}

export function WhatsappMessagesCleanupCard ({
  onStorageChanged,
}: WhatsappMessagesCleanupCardProps) {
  const [scope, setScope] = useState<WhatsappMessagePurgeScope>('90d')
  const [isCleaning, setIsCleaning] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const selectedScope = WHATSAPP_MESSAGE_PURGE_SCOPES.find((item) => item.id === scope)
  const cutoffLabel = formatCutoffDate(whatsappMessagePurgeCutoffIso(scope))

  async function handleCleanup () {
    if (isCleaning) return
    setIsCleaning(true)

    try {
      const res = await portalFetch('/api/portal/admin/whatsapp-messages/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const data = (await res?.json().catch(() => null)) as PurgeResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível excluir as mensagens.')
      }

      const deletedMessages = data.deletedMessages ?? 0
      const deletedConversations = data.deletedConversations ?? 0
      const removedLabel = deletedMessages > 0
        ? `${deletedMessages} mensagem(ns) removida(s) do banco. ${deletedConversations} conversa(s) sem mensagens também foram excluídas.`
        : `${deletedConversations} conversa(s) e as mensagens delas foram removidas do banco.`

      toast({
        variant: 'success',
        title: deletedMessages > 0 || deletedConversations > 0 ? 'Mensagens excluídas' : 'Nada para excluir',
        description: deletedMessages > 0 || deletedConversations > 0
          ? removedLabel
          : 'Não havia mensagens nesse filtro.',
      })

      setDialogOpen(false)
      await onStorageChanged?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir mensagens.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensagens do WhatsApp</CardTitle>
        <CardDescription>
          Apaga mensagens da organização no banco de dados para liberar espaço. Mídias ligadas a
          essas mensagens também são removidas. O histórico no celular não muda. O Postgres
          reaproveita o espaço na limpeza automática, então o tamanho em disco pode levar um tempo
          para cair.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="whatsapp-message-purge-scope" className="text-sm font-medium">
              O que excluir
            </label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as WhatsappMessagePurgeScope)}
              disabled={isCleaning}
            >
              <SelectTrigger id="whatsapp-message-purge-scope" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHATSAPP_MESSAGE_PURGE_SCOPES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            {cutoffLabel
              ? `Apaga mensagens criadas até ${cutoffLabel}. Conversas que ficarem sem mensagens também saem da inbox.`
              : 'Apaga todas as mensagens da organização. As conversas também saem da inbox.'}
          </p>
        </div>

        <Button
          type="button"
          variant="destructive"
          disabled={isCleaning}
          onClick={() => setDialogOpen(true)}
        >
          {isCleaning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Excluindo…
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              Excluir mensagens
            </>
          )}
        </Button>
      </CardContent>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (isCleaning) return
          setDialogOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagens do WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              {`${selectedScope?.label ?? 'As mensagens do filtro escolhido'} serão apagadas do banco${cutoffLabel ? ` (criadas até ${cutoffLabel})` : ''}. Conversas que ficarem sem mensagens também saem da inbox. Arquivos de mídia dessas mensagens são removidos. O histórico no WhatsApp do celular permanece. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCleaning}
              onClick={(event) => {
                event.preventDefault()
                void handleCleanup()
              }}
            >
              {isCleaning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Excluindo…
                </>
              ) : (
                'Excluir permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
