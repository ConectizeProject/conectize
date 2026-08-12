'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { usePortalOrganizationName } from '@/lib/portal/portal-branding-context'
import { Loader2, MessageCircle } from 'lucide-react'

type Config = {
  connected: boolean
  phone_number_id: string
  waba_id: string
  automation_enabled: boolean
  verify_token_configured: boolean
  access_token_masked: string | null
  webhook_url: string
}

export function WhatsappHubPanel () {
  const organizationName = usePortalOrganizationName()
  const brandLabel = String(organizationName || '').trim()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState<Config | null>(null)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [automationEnabled, setAutomationEnabled] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testSending, setTestSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/portal/hub/whatsapp-config')
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.ok) {
          setCfg(null)
          return
        }
        setCfg(data as Config)
        setPhoneNumberId(String(data.phone_number_id || ''))
        setWabaId(String(data.waba_id || ''))
        setAutomationEnabled(data.automation_enabled === true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave () {
    if (!phoneNumberId.trim()) {
      toast({ title: 'Informe o Phone Number ID', variant: 'destructive' })
      return
    }
    if (!accessToken.trim() && !cfg?.connected) {
      toast({ title: 'Informe o token de acesso permanente', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim() || undefined,
          access_token: accessToken.trim() || undefined,
          verify_token: verifyToken.trim() || undefined,
          automation_enabled: automationEnabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao salvar',
          description: String(data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      toast({ variant: 'success', title: 'Configuração salva' })
      setAccessToken('')
      setVerifyToken('')
      router.refresh()
      const r2 = await fetch('/api/portal/hub/whatsapp-config')
      const d2 = await r2.json().catch(() => null)
      if (r2.ok && d2?.ok) setCfg(d2 as Config)
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect () {
    if (!(await appConfirm({
      title: 'Remover integração WhatsApp Business?',
      description: 'A conexão com o WhatsApp será desfeita.',
      confirmLabel: 'Remover',
      destructive: true,
    }))) return
    setSaving(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-config', { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao desconectar', variant: 'destructive' })
        return
      }
      toast({ variant: 'success', title: 'WhatsApp desconectado' })
      setCfg(null)
      setPhoneNumberId('')
      setWabaId('')
      setAccessToken('')
      setVerifyToken('')
      setAutomationEnabled(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend () {
    if (!testTo.trim()) {
      toast({ title: 'Informe o número (DDD + número)', variant: 'destructive' })
      return
    }
    setTestSending(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testTo.trim(),
          text: brandLabel
            ? `Teste ${brandLabel} — integração WhatsApp.`
            : 'Teste de integração WhatsApp.',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Falha ao enviar',
          description: String(data?.detail || data?.error || 'Verifique token e número de teste no Meta.'),
          variant: 'destructive',
        })
        return
      }
      toast({ variant: 'success', title: 'Mensagem de teste enviada' })
    } finally {
      setTestSending(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Carregando WhatsApp…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden />
          WhatsApp Business (Cloud API)
        </CardTitle>
        <CardDescription>
          Configure o número e o webhook no Meta for Developers. O atendimento automático por IA usa a mesma API
          OpenAI configurada em ChatGPT no HUB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cfg?.webhook_url ? (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">URL do callback: </span>
            <code className="break-all text-xs">{cfg.webhook_url}</code>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wa-phone-id">Phone number ID</Label>
            <Input
              id="wa-phone-id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="ID do número na Meta"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-waba">WhatsApp Business Account ID (opcional)</Label>
            <Input
              id="wa-waba"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="WABA ID"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-token">Token de acesso permanente</Label>
          <Input
            id="wa-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={cfg?.access_token_masked ? `Atual: ${cfg.access_token_masked}` : 'EAA...'}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-verify">Verify token (webhook)</Label>
          <Input
            id="wa-verify"
            type="password"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            placeholder={
              cfg?.verify_token_configured ? 'Deixe em branco para manter' : 'Mesmo valor configurado na Meta'
            }
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Atendimento automatizado por IA</p>
            <p className="text-xs text-muted-foreground">
              Quando ativo, respostas iniciais e orçamentos usam o ChatGPT (requer conexão OpenAI no HUB).
            </p>
          </div>
          <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
          {cfg?.connected ? (
            <Button type="button" variant="outline" onClick={() => void handleDisconnect()} disabled={saving}>
              Desconectar
            </Button>
          ) : null}
        </div>

        <div className="rounded-md border border-dashed p-3 space-y-2">
          <p className="text-sm font-medium">Enviar mensagem de teste</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="wa-test-to">Número (apenas dígitos, com DDD)</Label>
              <Input
                id="wa-test-to"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="5511999999999"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={testSending || !cfg?.connected}
              onClick={() => void handleTestSend()}
            >
              {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar teste'}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Defina <code className="rounded bg-muted px-1">WHATSAPP_APP_SECRET</code> ou{' '}
          <code className="rounded bg-muted px-1">META_APP_SECRET</code> no servidor para validar assinaturas do
          webhook.
        </p>
      </CardContent>
    </Card>
  )
}
