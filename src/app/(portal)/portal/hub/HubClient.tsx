'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Bot,
  Check,
  ExternalLink,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Zap,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type SetupStep = { text: string; link?: { url: string; label: string } }

type Integration = {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  status: 'available' | 'coming_soon'
  authType: 'api_key' | 'oauth'
  docsUrl?: string
  setupSteps?: SetupStep[]
  oauthUrl?: string
}

const integrations: Integration[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT / OpenAI',
    description: 'Ajuda a criar e editar ordens de serviço: sugerir título, melhorar descrição e sugerir serviços a partir do que o cliente relatou.',
    icon: Bot,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    status: 'available',
    authType: 'api_key',
    docsUrl: 'https://platform.openai.com/docs',
    setupSteps: [
      { text: 'Acesse o painel da OpenAI' },
      { text: 'Crie uma API Key', link: { url: 'https://platform.openai.com/api-keys', label: 'platform.openai.com/api-keys' } },
      { text: 'Cole a chave no campo abaixo' },
    ],
  },
  {
    id: 'mercado_livre',
    name: 'Mercado Livre',
    description: 'Sincronize pedidos, produtos e mensagens do Mercado Livre.',
    icon: ShoppingCart,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    status: 'coming_soon',
    authType: 'oauth',
    docsUrl: 'https://developers.mercadolivre.com.br',
  },
  {
    id: 'bling',
    name: 'Bling',
    description: 'ERP Bling: pedidos, estoque, boletos e NF-e em um só lugar.',
    icon: Package,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    status: 'available',
    authType: 'oauth',
    docsUrl: 'https://developer.bling.com.br/',
    oauthUrl: '/api/portal/hub/oauth/bling',
  },
  {
    id: 'shopee',
    name: 'Shopee',
    description: 'Conecte sua loja Shopee para sincronizar vendas e produtos.',
    icon: Store,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    status: 'coming_soon',
    authType: 'oauth',
    docsUrl: 'https://open.shopee.com',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Integre com Amazon Seller Central para pedidos e inventário.',
    icon: Zap,
    color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    status: 'coming_soon',
    authType: 'oauth',
    docsUrl: 'https://developer-docs.amazon.com',
  },
]

const OPENAI_MODELS = [
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (recomendado - mais econômico)' },
  { value: 'gpt-5.2', label: 'GPT-5.2 (mais preciso)' },
  { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro (máxima precisão)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (alternativa econômica)' },
  { value: 'gpt-4o', label: 'GPT-4o (versão anterior)' },
] as const

type Props = {
  initialConnections: string[]
  isAdmin?: boolean
  chatgptModel?: string
}

function IntegrationCard({
  integration,
  isConnected,
  isAdmin,
  onConnect,
  onDisconnect,
  onConfigure,
}: {
  integration: Integration
  isConnected: boolean
  isAdmin: boolean
  onConnect: () => void
  onDisconnect: () => void
  onConfigure?: () => void
}) {
  const Icon = integration.icon
  const isComingSoon = integration.status === 'coming_soon'
  const canConnectApiKey = isAdmin && !isComingSoon && integration.authType === 'api_key'
  const canConnectOAuth = isAdmin && !isComingSoon && integration.authType === 'oauth' && integration.oauthUrl
  const canConnect = canConnectApiKey || canConnectOAuth

  return (
    <Card className="overflow-hidden transition-colors hover:bg-muted/50">
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <div className={`rounded-lg p-3 ${integration.color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">{integration.name}</CardTitle>
            <div className="flex items-center gap-2">
              {isConnected && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600 shrink-0">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
              {isComingSoon && (
                <Badge variant="secondary" className="shrink-0">
                  Em breve
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-sm">{integration.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          {canConnect && (
            <>
              {isConnected ? (
                <>
                  {integration.id === 'chatgpt' && onConfigure ? (
                    <Button size="sm" variant="outline" onClick={onConfigure}>
                      <Settings className="h-4 w-4 mr-1" />
                      Configurar
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={onDisconnect}>
                    Desconectar
                  </Button>
                </>
              ) : integration.oauthUrl ? (
                <Button size="sm" asChild>
                  <a href={integration.oauthUrl}>Conectar</a>
                </Button>
              ) : (
                <Button size="sm" onClick={onConnect}>
                  Conectar
                </Button>
              )}
            </>
          )}
          {integration.docsUrl && (
            <Button size="sm" variant="ghost" asChild>
              <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                Documentação
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function HubClient({ initialConnections, isAdmin = false, chatgptModel = 'gpt-5-mini' }: Props) {
  const router = useRouter()
  const [connections, setConnections] = useState<Set<string>>(new Set(initialConnections))
  const [connectDialog, setConnectDialog] = useState<Integration | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>(chatgptModel)
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    if (!connectDialog) return
    const key = apiKey.trim()
    if (!key) {
      toast({ title: 'Informe a API Key', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/portal/hub/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: connectDialog.id,
          api_key: key,
          model: connectDialog.id === 'chatgpt' ? selectedModel : undefined,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao conectar',
          description: data?.error === 'api_key_required' ? 'API Key é obrigatória.' : 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }

      setConnections((prev) => new Set(prev).add(connectDialog.id))
      setConnectDialog(null)
      setApiKey('')
      toast({ variant: 'success', title: 'Conectado', description: `${connectDialog.name} conectado com sucesso.` })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateModel() {
    if (!selectedModel) return

    setLoading(true)
    try {
      const res = await fetch('/api/portal/hub/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: 'chatgpt',
          model: selectedModel,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao atualizar',
          description: 'Não foi possível atualizar o modelo.',
          variant: 'destructive',
        })
        return
      }

      setConnectDialog(null)
      toast({ variant: 'success', title: 'Modelo atualizado', description: `Modelo alterado para ${OPENAI_MODELS.find((m) => m.value === selectedModel)?.label || selectedModel}.` })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect(integration: Integration) {
    if (!confirm(`Desconectar ${integration.name}?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/portal/hub/connections/${integration.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao desconectar', variant: 'destructive' })
        return
      }

      setConnections((prev) => {
        const next = new Set(prev)
        next.delete(integration.id)
        return next
      })
      toast({ variant: 'success', title: 'Desconectado', description: `${integration.name} desconectado.` })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          O HUB permite conectar o Conectize com marketplaces, ERPs e ferramentas de IA.
          Cada integração pode ser configurada individualmente. Em breve você poderá criar
          automações como: novo pedido no Mercado Livre → criar OS automaticamente.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Integrações disponíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              isConnected={connections.has(integration.id)}
              isAdmin={isAdmin}
              onConnect={() => {
                setSelectedModel(integration.id === 'chatgpt' ? chatgptModel : 'gpt-5-mini')
                setConnectDialog(integration)
              }}
              onDisconnect={() => handleDisconnect(integration)}
              onConfigure={
                integration.id === 'chatgpt' && connections.has('chatgpt')
                  ? () => {
                      setSelectedModel(chatgptModel)
                      setConnectDialog(integration)
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <Dialog
        open={!!connectDialog}
        onOpenChange={(open) => {
          if (!open) {
            setConnectDialog(null)
            setApiKey('')
            setSelectedModel(chatgptModel)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {connectDialog?.id === 'chatgpt' && connections.has('chatgpt')
                ? 'Configurar ChatGPT'
                : `Conectar ${connectDialog?.name}`}
            </DialogTitle>
            <DialogDescription>
              {connectDialog?.id === 'chatgpt' && connections.has('chatgpt')
                ? 'Altere o modelo do GPT que será usado para ajudar na criação de ordens de serviço.'
                : 'Siga os passos abaixo para obter sua API Key e cole no campo indicado.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {connectDialog?.id === 'chatgpt' && (
              <div className="space-y-2">
                <Label htmlFor="model">Modelo do GPT</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={loading}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Modelos mais rápidos são mais econômicos. Modelos mais precisos podem ter melhor qualidade.
                </p>
              </div>
            )}
            {connectDialog?.setupSteps && connectDialog.setupSteps.length > 0 && !connections.has(connectDialog.id) && (
              <div className="rounded-md border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Como obter a API Key</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  {connectDialog.setupSteps.map((step, i) => (
                    <li key={i}>
                      {step.link ? (
                        <a
                          href={step.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {step.text}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        step.text
                      )}
                    </li>
                  ))}
                </ol>
                {connectDialog.docsUrl && (
                  <a
                    href={connectDialog.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
                  >
                    Ver documentação completa
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
            {!connections.has(connectDialog?.id || '') && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialog(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={
                connectDialog?.id === 'chatgpt' && connections.has('chatgpt')
                  ? handleUpdateModel
                  : handleConnect
              }
              disabled={loading}
            >
              {loading
                ? 'Salvando…'
                : connectDialog?.id === 'chatgpt' && connections.has('chatgpt')
                  ? 'Salvar'
                  : 'Conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
