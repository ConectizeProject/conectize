'use client'

import { useState } from 'react'
import { Copy, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import {
  BLING_APP_CREATE_URL,
  BLING_APP_REGISTRATION,
  blingAppScopeList,
} from '@/lib/integrations/bling/app-registration'

type CopyField = {
  label: string
  value: string
}

const CREDENTIAL_ERRORS: Record<string, string> = {
  client_id_required: 'Informe o Client ID.',
  client_secret_required: 'Informe o Client Secret.',
  db_error: 'Não foi possível salvar as credenciais. Tente novamente.',
  forbidden: 'Sem permissão para configurar o Bling.',
  not_authenticated: 'Faça login novamente para configurar o Bling.',
}

export function BlingAppSetup ({
  redirectUri,
  initialClientId,
  hasClientSecret,
}: {
  redirectUri: string
  initialClientId: string
  hasClientSecret: boolean
}) {
  const [clientId, setClientId] = useState(initialClientId)
  const [clientSecret, setClientSecret] = useState('')
  const [secretSaved, setSecretSaved] = useState(hasClientSecret)
  const [saving, setSaving] = useState(false)

  const fields: CopyField[] = [
    { label: 'Nome', value: BLING_APP_REGISTRATION.nome },
    { label: 'Categoria', value: BLING_APP_REGISTRATION.categoria },
    { label: 'Descrição curta', value: BLING_APP_REGISTRATION.descricaoCurta },
    { label: 'Link de redirecionamento', value: redirectUri },
    { label: 'Lista de escopos', value: blingAppScopeList() },
  ]

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
        }),
      })
      const data = await res.json().catch(() => null) as { ok?: boolean, error?: string } | null
      if (!res.ok || data?.ok !== true) {
        const code = String(data?.error || '')
        toast({
          title: 'Não foi possível salvar',
          description: CREDENTIAL_ERRORS[code] || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setSecretSaved(true)
      setClientSecret('')
      window.location.assign('/api/portal/hub/oauth/bling')
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
    <section className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Cadastre o aplicativo no Bling</p>
        <p className="text-xs text-muted-foreground">
          Crie um aplicativo do tipo API com visibilidade Privado, em Central de Extensões, Área do Integrador. Aplicativo privado não precisa de homologação. Copie os dados abaixo e depois informe o Client ID e o Client Secret.
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={BLING_APP_CREATE_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4 mr-1" />
          Abrir cadastro de aplicativos
        </a>
      </Button>
      <ul className="space-y-2">
        {fields.map((field) => (
          <li key={field.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label={`Copiar ${field.label}`}
                onClick={() => { void copyValue(field.label, field.value) }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted/30 px-2 py-1.5 text-xs text-foreground">
              {field.value || 'Indisponível neste ambiente'}
            </pre>
          </li>
        ))}
      </ul>
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
      <Button type="button" onClick={() => { void saveAndConnect() }} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        {saving ? 'Salvando…' : 'Salvar e conectar'}
      </Button>
    </section>
  )
}
