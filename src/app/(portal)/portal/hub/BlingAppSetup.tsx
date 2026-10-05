'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import {
  BLING_APP_CREATE_URL,
  BLING_APP_REGISTRATION,
} from '@/lib/integrations/bling/app-registration'

const CREDENTIAL_ERRORS: Record<string, string> = {
  client_id_required: 'Informe o Client ID.',
  client_secret_required: 'Informe o Client Secret.',
  connection_not_found: 'Conta não encontrada. Atualize a página e tente de novo.',
  db_error: 'Não foi possível salvar as credenciais. Tente novamente.',
  forbidden: 'Sem permissão para configurar o Bling.',
  not_authenticated: 'Faça login novamente para configurar o Bling.',
}

type SavedCredentials = {
  connectionId: string
  clientId: string
  credentialsChanged: boolean
}

export function BlingAppSetup ({
  redirectUri,
  initialClientId,
  hasClientSecret,
  connectionId,
  showRegistration,
  reconnectAfterSave,
  onCancel,
  onSaved,
}: {
  redirectUri: string
  initialClientId: string
  hasClientSecret: boolean
  connectionId?: string | null
  showRegistration: boolean
  reconnectAfterSave?: boolean
  onCancel?: () => void
  onSaved?: (result: SavedCredentials) => void
}) {
  const [clientId, setClientId] = useState(initialClientId)
  const [clientSecret, setClientSecret] = useState('')
  const [secretSaved, setSecretSaved] = useState(hasClientSecret)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setClientId(initialClientId)
    setClientSecret('')
    setSecretSaved(hasClientSecret)
  }, [connectionId, hasClientSecret, initialClientId])

  async function copyValue (label: string, value: string) {
    if (!value) {
      toast({ title: 'Nada para copiar', variant: 'destructive' })
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: 'Copiado', description: label })
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' })
    }
  }

  async function saveAndConnect () {
    const nextClientId = clientId.trim()
    const nextSecret = clientSecret.trim()
    if (!nextClientId) {
      toast({ title: 'Informe o Client ID', variant: 'destructive' })
      return
    }
    if (!nextSecret && !secretSaved) {
      toast({ title: 'Informe o Client Secret', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/portal/hub/bling/app-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: nextClientId,
          clientSecret: nextSecret,
          connectionId: connectionId || undefined,
        }),
      })
      const data = await res.json().catch(() => null) as {
        ok?: boolean
        error?: string
        connectionId?: string
        clientId?: string
        credentialsChanged?: boolean
      } | null
      if (!res.ok || data?.ok !== true || !data.connectionId) {
        const code = String(data?.error || '')
        toast({
          title: 'Não foi possível salvar',
          description: CREDENTIAL_ERRORS[code] || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }

      const saved: SavedCredentials = {
        connectionId: data.connectionId,
        clientId: data.clientId || nextClientId,
        credentialsChanged: data.credentialsChanged === true,
      }
      const shouldReconnect = showRegistration || saved.credentialsChanged || reconnectAfterSave
      if (!shouldReconnect) {
        onSaved?.(saved)
        return
      }
      window.location.assign(
        `/api/portal/hub/oauth/bling?connectionId=${encodeURIComponent(saved.connectionId)}`,
      )
    } catch {
      toast({
        title: 'Não foi possível salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5">
      {showRegistration ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Cadastre o aplicativo no Bling</p>
              <p className="text-xs text-muted-foreground">
                Crie um aplicativo privado do tipo API, em Central de Extensões, Área do Integrador. Aplicativo privado não precisa de homologação.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" className="shrink-0" asChild>
              <a href={BLING_APP_CREATE_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir cadastro
              </a>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CopyValue label="Nome" value={BLING_APP_REGISTRATION.nome} onCopy={copyValue} />
            <CopyValue label="Categoria" value={BLING_APP_REGISTRATION.categoria} onCopy={copyValue} />
            <CopyValue label="Descrição" value={BLING_APP_REGISTRATION.descricaoCurta} onCopy={copyValue} />
            <CopyValue
              label="Link de redirecionamento"
              value={redirectUri || 'Indisponível neste ambiente'}
              onCopy={copyValue}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Marque estes escopos</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {BLING_APP_REGISTRATION.escopos.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-medium">Editar aplicativo</p>
          <p className="text-xs text-muted-foreground">
            Atualize o Client ID e o Client Secret desta conta. Se algum dos dois mudar, a conexão abre de novo no Bling.
          </p>
        </div>
      )}

      <div className="space-y-3 border-t border-border/80 pt-4">
        <p className="text-sm font-medium">Credenciais do aplicativo</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bling-client-id">Client ID</Label>
            <Input
              id="bling-client-id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bling-client-secret">Client Secret</Label>
            <Input
              id="bling-client-secret"
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder={secretSaved ? 'Deixe em branco para manter o atual' : 'Cole o Client Secret'}
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => { void saveAndConnect() }} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {saving ? 'Salvando…' : showRegistration ? 'Salvar e conectar' : 'Salvar'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Voltar
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function CopyValue ({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: (label: string, value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-words text-sm text-foreground">{value}</p>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label={`Copiar ${label}`}
          onClick={() => { onCopy(label, value) }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
