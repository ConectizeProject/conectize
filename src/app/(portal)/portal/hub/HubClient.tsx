'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import {
  Bot,
  CalendarClock,
  Check,
  ExternalLink,
  History,
  Loader2,
  MessageCircle,
  Package,
  Play,
  QrCode,
  RefreshCw,
  ShoppingCart,
  Smartphone,
  Store,
  X,
  Zap,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { blingRefreshTokenErrorToMessage } from '@/lib/integrations/bling/refresh-token-errors'
import { usePortalOrganizationName } from '@/lib/portal/portal-branding-context'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { cn } from '@/lib/utils'
import { DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES } from '@/lib/whatsapp/evolution-auto-messages'
import { EvolutionAutoMessagesFields } from './EvolutionAutoMessagesFields'
import {
  HubInboxViewersPicker,
  type InboxAccessState,
} from './HubInboxViewersPicker'

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
    id: 'whatsapp_business',
    name: 'WhatsApp Business',
    description: 'Atendimento via WhatsApp Cloud API com automações e envio de mensagens de teste.',
    icon: MessageCircle,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    status: 'available',
    authType: 'api_key',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    id: 'whatsapp_evolution',
    name: 'WhatsApp Evolution',
    description:
      'Conexão WhatsApp Web via Evolution API (QR Code). Pode coexistir com o WhatsApp oficial—defina preferência ao enviar.',
    icon: Smartphone,
    color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
    status: 'available',
    authType: 'api_key',
    docsUrl: 'https://doc.evolution-api.com/',
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

type BlingConnection = {
  id: string
  platform_id: string
  metadata?: Record<string, unknown> | null
  created_at?: string
  token_expires_at?: string | null
}

type WhatsappConfig = {
  connected: boolean
  connection_id?: string | null
  inbox_restricted?: boolean
  phone_number_id: string
  waba_id: string
  automation_enabled: boolean
  verify_token_configured: boolean
  access_token_masked: string | null
  webhook_url: string
}

type WhatsappEvolutionInstance = {
  connection_id: string
  instance_name: string
  label: string | null
  display_label: string
  preferred_for_messages: boolean
  api_base_url_override: string
  automation_enabled: boolean
  auto_messages_enabled: boolean
  auto_message_templates: {
    os_opened?: string
    os_ready_for_pickup?: string
  }
  has_api_key?: boolean
  access_token_masked: string | null
}

type WhatsappEvolutionConfig = {
  connected: boolean
  instances: WhatsappEvolutionInstance[]
  uses_env_api_base: boolean
  env_api_key_fallback: boolean
  webhook_url: string
  webhook_secret_configured: boolean
}

function evolutionAutoMessageFormFromInstance (inst?: WhatsappEvolutionInstance | null) {
  return {
    enabled: inst?.auto_messages_enabled === true,
    osOpened:
      typeof inst?.auto_message_templates?.os_opened === 'string'
        ? inst.auto_message_templates.os_opened
        : DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_opened,
    ready:
      typeof inst?.auto_message_templates?.os_ready_for_pickup === 'string'
        ? inst.auto_message_templates.os_ready_for_pickup
        : DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_ready_for_pickup,
  }
}

type LojistasRoutineRun = {
  run_day: string
  status: 'running' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
  result: Record<string, unknown> | null
}

type LojistasRoutineStatus = {
  available: boolean
  today?: string
  last_run?: LojistasRoutineRun | null
}

function formatRunDayBr (runDay: string): string {
  const [y, m, d] = runDay.split('-')
  if (!y || !m || !d) return runDay
  return `${d}/${m}/${y}`
}

function lojistasRoutineBadge (routine: LojistasRoutineStatus): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
} {
  const last = routine.last_run
  if (last && routine.today && last.run_day === routine.today) {
    if (last.status === 'completed') {
      return { label: 'Enviada hoje', variant: 'default', className: 'bg-green-600 hover:bg-green-600' }
    }
    if (last.status === 'running') {
      return { label: 'Executando…', variant: 'secondary' }
    }
    return { label: 'Falhou hoje', variant: 'destructive' }
  }
  return { label: 'Agendada · ~9h', variant: 'outline' }
}

function isBlingTokenExpired (expiresAt: string | null | undefined) {
  if (!expiresAt) return true
  const expiry = Date.parse(expiresAt)
  if (Number.isNaN(expiry)) return true
  return expiry <= Date.now() + 60_000
}

function formatTokenExpiry (expiresAt: string | null | undefined) {
  if (!expiresAt) return 'Data de expiração desconhecida'
  try {
    const d = new Date(expiresAt)
    if (Number.isNaN(d.getTime())) return 'Data de expiração desconhecida'
    return `Token válido até ${d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
  } catch {
    return 'Data de expiração desconhecida'
  }
}

type Props = {
  initialConnections: string[]
  blingConnections?: BlingConnection[]
  isAdmin?: boolean
  chatgptModel?: string
}

function formatConnectionLabel(connection: BlingConnection, index: number) {
  if (connection.metadata && typeof connection.metadata === 'object' && 'nome' in connection.metadata && connection.metadata.nome) {
    return String(connection.metadata.nome)
  }
  if (connection.created_at) {
    try {
      const d = new Date(connection.created_at)
      return `Conectada em ${d.toLocaleDateString('pt-BR')}`
    } catch {
      // fallback
    }
  }
  return `Conta ${index + 1}`
}

function getBlingAccountPresentation (connection: BlingConnection, index: number) {
  const meta = connection.metadata && typeof connection.metadata === 'object'
    ? connection.metadata
    : null
  const nome = meta?.nome != null ? String(meta.nome).trim() : ''
  const email = meta?.email != null ? String(meta.email).trim() : ''
  const logoUrl = meta?.logoUrl != null ? String(meta.logoUrl).trim() : ''
  const label = nome || formatConnectionLabel(connection, index)
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'B'

  return {
    nome: label,
    email: email || null,
    logoUrl: logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : null,
    initials,
  }
}

function getBlingReconnectStatus (connection: BlingConnection) {
  const metadata = connection.metadata
  if (!metadata || typeof metadata !== 'object') return null

  const required = metadata.blingReconnectRequired === true
  if (!required) return null

  const reason = typeof metadata.blingReconnectReason === 'string'
    ? metadata.blingReconnectReason
    : 'invalid_grant'

  const lastError = typeof metadata.blingLastRefreshError === 'string'
    ? metadata.blingLastRefreshError
    : null

  if (reason !== 'invalid_grant') return null

  return {
    title: 'Reconexão necessária',
    description: 'O token de atualização do Bling expirou ou foi revogado. Desconecte e conecte novamente esta conta no HUB.',
    lastError,
  }
}

function LojistasRoutinePanel ({
  routine,
  onRun,
  isRunning,
}: {
  routine: LojistasRoutineStatus
  onRun?: () => void
  isRunning: boolean
}) {
  const badge = lojistasRoutineBadge(routine)
  const last = routine.last_run
  const devicesCount =
    last?.result && typeof last.result.devicesCount === 'number'
      ? last.result.devicesCount
      : null
  const lastError =
    last?.status === 'failed' && typeof last.result?.error === 'string'
      ? String(last.result.error)
      : null

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          Rotina: lista de seminovos p/ lojistas
        </p>
        <Badge variant={badge.variant} className={`shrink-0 text-[10px] ${badge.className || ''}`}>
          {badge.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Envia diariamente por volta das 9h (via GitHub Actions) a lista de atacado no grupo do WhatsApp.
      </p>
      {last ? (
        <p className="text-xs text-muted-foreground">
          Última execução: {formatRunDayBr(last.run_day)}
          {devicesCount !== null ? ` · ${devicesCount} aparelhos` : ''}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma execução registrada ainda.</p>
      )}
      {lastError ? (
        <p className="text-xs text-destructive break-words">Erro: {lastError}</p>
      ) : null}
      {onRun ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={isRunning}
          onClick={onRun}
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">{isRunning ? 'Enviando…' : 'Rodar agora'}</span>
        </Button>
      ) : null}
    </div>
  )
}

function BlingConnectionsPanel ({
  blingConnections,
  onDisconnectBlingConnection,
  onRefreshBlingToken,
  refreshingBlingId,
  oauthUrl,
}: {
  blingConnections: BlingConnection[]
  onDisconnectBlingConnection?: (connectionId: string) => void
  onRefreshBlingToken?: (connectionId: string) => void
  refreshingBlingId?: string | null
  oauthUrl?: string
}) {
  return (
    <div className="space-y-3">
      {blingConnections.length > 0 ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Contas conectadas</p>
          <ul className="space-y-3">
            {blingConnections.map((conn, index) => {
              const reconnectStatus = getBlingReconnectStatus(conn)
              const account = getBlingAccountPresentation(conn, index)

              return (
                <li
                  key={conn.id}
                  className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/50 p-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {account.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.logoUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md border bg-background object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-blue-500/10 text-xs font-semibold text-blue-700 dark:text-blue-300"
                        aria-hidden="true"
                      >
                        {account.initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="block truncate font-medium">{account.nome}</span>
                      {account.email ? (
                        <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{formatTokenExpiry(conn.token_expires_at)}</span>
                      {reconnectStatus ? (
                        <div className="mt-1 space-y-1">
                          <Badge variant="destructive" className="text-[10px]">
                            {reconnectStatus.title}
                          </Badge>
                          <p className="text-xs text-destructive">
                            {reconnectStatus.description}
                          </p>
                          {reconnectStatus.lastError ? (
                            <p className="text-[11px] text-muted-foreground break-words">
                              Erro: {reconnectStatus.lastError}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {isBlingTokenExpired(conn.token_expires_at) && (
                        <Badge variant="destructive" className="text-[10px]">
                          Token expirado ou próximo de expirar — use &quot;Renovar token&quot;
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
                    {onRefreshBlingToken ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={refreshingBlingId === conn.id}
                        onClick={() => onRefreshBlingToken(conn.id)}
                      >
                        {refreshingBlingId === conn.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1">Renovar token</span>
                      </Button>
                    ) : null}
                    {onDisconnectBlingConnection ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDisconnectBlingConnection(conn.id)}
                      >
                        Desconectar
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta Bling conectada ainda.
        </p>
      )}
      {oauthUrl ? (
        <Button size="sm" asChild>
          <a href={oauthUrl}>
            {blingConnections.length > 0 ? 'Conectar outra conta' : 'Conectar conta Bling'}
          </a>
        </Button>
      ) : null}
    </div>
  )
}

function IntegrationCard({
  integration,
  isConnected,
  onOpenDetails,
}: {
  integration: Integration
  isConnected: boolean
  onOpenDetails?: () => void
}) {
  const Icon = integration.icon
  const isComingSoon = integration.status === 'coming_soon'
  const isInteractive = Boolean(onOpenDetails)

  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors border-2',
        isConnected ? 'border-green-300 dark:border-green-700/60' : 'border-gray-200 dark:border-gray-700',
        isInteractive && 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isComingSoon && 'opacity-90',
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={() => {
        if (!isInteractive) return
        onOpenDetails?.()
      }}
      onKeyDown={(e) => {
        if (!isInteractive) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenDetails?.()
        }
      }}
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
        <div className={`rounded-lg p-3 shrink-0 ${integration.color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle className="text-base leading-tight truncate">{integration.name}</CardTitle>
          <div>
            {isConnected ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : isComingSoon ? (
              <Badge variant="secondary">Em breve</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Não configurado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

export function HubClient({ initialConnections, blingConnections: initialBlingConnections = [], isAdmin = false, chatgptModel = 'gpt-5-mini' }: Props) {
  const organizationName = usePortalOrganizationName()
  const brandLabel = String(organizationName || '').trim()
  const router = useRouter()
  const [connections, setConnections] = useState<Set<string>>(new Set(initialConnections))
  const [blingConnections, setBlingConnections] = useState<BlingConnection[]>(initialBlingConnections)
  useEffect(() => {
    setBlingConnections(initialBlingConnections)
  }, [initialBlingConnections])
  const [connectDialog, setConnectDialog] = useState<Integration | null>(null)
  const [blingDialogOpen, setBlingDialogOpen] = useState(false)
  const [infoDialog, setInfoDialog] = useState<Integration | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>(chatgptModel)
  const [loading, setLoading] = useState(false)
  const [refreshingBlingId, setRefreshingBlingId] = useState<string | null>(null)
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [whatsappSaving, setWhatsappSaving] = useState(false)
  const [whatsappTestSending, setWhatsappTestSending] = useState(false)
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsappConfig | null>(null)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [automationEnabled, setAutomationEnabled] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [evolutionDialogOpen, setEvolutionDialogOpen] = useState(false)
  const [evolutionLoading, setEvolutionLoading] = useState(false)
  const [evolutionSaving, setEvolutionSaving] = useState(false)
  const [evolutionTestSending, setEvolutionTestSending] = useState(false)
  const [evolutionConfig, setEvolutionConfig] = useState<WhatsappEvolutionConfig | null>(null)
  const [evolutionEditingConnectionId, setEvolutionEditingConnectionId] = useState<string | null>(null)
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('')
  const [evolutionLabel, setEvolutionLabel] = useState('')
  const [evolutionApiKey, setEvolutionApiKey] = useState('')
  const [evolutionBaseOverride, setEvolutionBaseOverride] = useState('')
  const [evolutionPreferred, setEvolutionPreferred] = useState(false)
  const [evolutionAutomation, setEvolutionAutomation] = useState(false)
  const [evolutionAutoMessagesEnabled, setEvolutionAutoMessagesEnabled] = useState(false)
  const [evolutionTplOsOpened, setEvolutionTplOsOpened] = useState(
    DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_opened,
  )
  const [evolutionTplReadyPickup, setEvolutionTplReadyPickup] = useState(
    DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_ready_for_pickup,
  )
  const [evolutionTestTo, setEvolutionTestTo] = useState('')
  const [evolutionStatusChecking, setEvolutionStatusChecking] = useState(false)
  const [evolutionStatusHints, setEvolutionStatusHints] = useState<string[] | null>(null)
  const [evolutionSyncing, setEvolutionSyncing] = useState(false)
  const [evolutionConnectionState, setEvolutionConnectionState] = useState<
    'unknown' | 'open' | 'close' | 'connecting'
  >('unknown')
  const [evolutionQrBase64, setEvolutionQrBase64] = useState<string | null>(null)
  const [evolutionPairingCode, setEvolutionPairingCode] = useState<string | null>(null)
  const [evolutionQrLoading, setEvolutionQrLoading] = useState(false)
  const [evolutionQrPolling, setEvolutionQrPolling] = useState(false)
  const evolutionQrPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [evolutionInboxAccess, setEvolutionInboxAccess] = useState<InboxAccessState>({
    unrestricted: true,
    userIds: [],
  })
  const [whatsappInboxAccess, setWhatsappInboxAccess] = useState<InboxAccessState>({
    unrestricted: true,
    userIds: [],
  })
  const [lojistasRoutine, setLojistasRoutine] = useState<LojistasRoutineStatus | null>(null)
  const [lojistasRoutineRunning, setLojistasRoutineRunning] = useState(false)

  const loadLojistasRoutineStatus = useCallback(async () => {
    const res = await fetch('/api/portal/hub/whatsapp-lojistas-broadcast')
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) return
    setLojistasRoutine(data as LojistasRoutineStatus)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void loadLojistasRoutineStatus()
  }, [isAdmin, loadLojistasRoutineStatus])

  useEffect(() => {
    if (!isAdmin) return
    void (async () => {
      try {
        const [waRes, evoRes] = await Promise.all([
          fetch('/api/portal/hub/whatsapp-config'),
          fetch('/api/portal/hub/whatsapp-evolution-config'),
        ])
        const waData = await waRes.json().catch(() => null)
        if (waRes.ok && waData?.ok) {
          setWhatsappConfig(waData as WhatsappConfig)
        }
        const evoData = await evoRes.json().catch(() => null)
        if (evoRes.ok && evoData?.ok) {
          setEvolutionConfig(evoData as WhatsappEvolutionConfig)
        }
      } catch {
        // badge usa fallback de connections do SSR
      }
    })()
  }, [isAdmin])

  async function handleRunLojistasRoutine () {
    if (!(await appConfirm({
      title: 'Enviar lista de seminovos?',
      description: 'Enviar agora a lista de seminovos no grupo de lojistas do WhatsApp.',
      confirmLabel: 'Enviar agora',
    }))) return

    setLojistasRoutineRunning(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-lojistas-broadcast', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Falha ao enviar a lista',
          description: String((data as { hint?: string })?.hint || data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      const devicesCount = typeof data.devicesCount === 'number' ? data.devicesCount : null
      toast({
        variant: 'success',
        title: 'Lista enviada ao grupo',
        description: devicesCount !== null ? `${devicesCount} aparelhos na lista.` : undefined,
      })
    } finally {
      setLojistasRoutineRunning(false)
      void loadLojistasRoutineStatus()
    }
  }

  function resetEvolutionQrState () {
    setEvolutionQrPolling(false)
    setEvolutionQrBase64(null)
    setEvolutionPairingCode(null)
    setEvolutionConnectionState('unknown')
    if (evolutionQrPollRef.current) {
      clearInterval(evolutionQrPollRef.current)
      evolutionQrPollRef.current = null
    }
  }

  const evolutionConnectRequestBody = useCallback(() => ({
    connection_id: evolutionEditingConnectionId || undefined,
    instance_name: evolutionInstanceName.trim() || undefined,
    api_key: evolutionApiKey.trim() || undefined,
    api_base_url_override: evolutionBaseOverride.trim() || undefined,
  }), [
    evolutionEditingConnectionId,
    evolutionInstanceName,
    evolutionApiKey,
    evolutionBaseOverride,
  ])

  const pollEvolutionConnectionState = useCallback(async () => {
    if (!evolutionInstanceName.trim()) return
    const res = await fetch('/api/portal/hub/whatsapp-evolution-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...evolutionConnectRequestBody(),
        check_only: true,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) return
    const state = String(data.state || 'unknown') as typeof evolutionConnectionState
    setEvolutionConnectionState(state)
    if (state === 'open') {
      setEvolutionQrPolling(false)
      setEvolutionQrBase64(null)
      toast({ variant: 'success', title: 'WhatsApp conectado', description: 'Instância Evolution pronta para uso.' })
    }
  }, [evolutionInstanceName, evolutionConnectRequestBody])

  useEffect(() => {
    if (!evolutionDialogOpen || !evolutionQrPolling) {
      if (evolutionQrPollRef.current) {
        clearInterval(evolutionQrPollRef.current)
        evolutionQrPollRef.current = null
      }
      return
    }
    void pollEvolutionConnectionState()
    evolutionQrPollRef.current = setInterval(() => {
      void pollEvolutionConnectionState()
    }, 3000)
    return () => {
      if (evolutionQrPollRef.current) {
        clearInterval(evolutionQrPollRef.current)
        evolutionQrPollRef.current = null
      }
    }
  }, [evolutionDialogOpen, evolutionQrPolling, pollEvolutionConnectionState])

  useEffect(() => {
    if (!evolutionDialogOpen || !evolutionInstanceName.trim()) return
    void pollEvolutionConnectionState()
  }, [evolutionDialogOpen, evolutionEditingConnectionId, pollEvolutionConnectionState])

  async function handleEvolutionStartQrConnect () {
    if (!evolutionInstanceName.trim()) {
      toast({ title: 'Informe o nome da instância', variant: 'destructive' })
      return
    }
    setEvolutionQrLoading(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-evolution-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evolutionConnectRequestBody()),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Não foi possível gerar o QR Code',
          description: String((data as { hint?: string })?.hint || data?.error || 'Verifique URL e API key da Evolution.'),
          variant: 'destructive',
        })
        return
      }
      const state = String(data.state || 'unknown') as typeof evolutionConnectionState
      setEvolutionConnectionState(state)
      setEvolutionQrBase64(typeof data.qr_base64 === 'string' ? data.qr_base64 : null)
      setEvolutionPairingCode(typeof data.pairing_code === 'string' ? data.pairing_code : null)
      if (state === 'open') {
        setEvolutionQrPolling(false)
        toast({ variant: 'success', title: 'WhatsApp já conectado' })
        return
      }
      if (!data.qr_base64) {
        toast({
          title: 'QR Code indisponível',
          description: 'A Evolution não retornou imagem. Confira se a instância existe e se a API está acessível.',
          variant: 'destructive',
        })
        return
      }
      setEvolutionQrPolling(true)
    } finally {
      setEvolutionQrLoading(false)
    }
  }

  async function refreshEvolutionConnectionState () {
    if (!evolutionInstanceName.trim()) return
    setEvolutionQrLoading(true)
    try {
      await pollEvolutionConnectionState()
    } finally {
      setEvolutionQrLoading(false)
    }
  }

  const [blingLookupSkus, setBlingLookupSkus] = useState<string[]>([])
  const [blingLookupDraft, setBlingLookupDraft] = useState('')
  const [blingLookupGtins, setBlingLookupGtins] = useState<string[]>([])
  const [blingLookupGtinDraft, setBlingLookupGtinDraft] = useState('')
  const [blingLookupLoading, setBlingLookupLoading] = useState(false)

  async function loadWhatsappConfig () {
    setWhatsappLoading(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-config')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao carregar WhatsApp',
          description: String(data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }

      const config = data as WhatsappConfig
      setWhatsappConfig(config)
      setPhoneNumberId(String(config.phone_number_id || ''))
      setWabaId(String(config.waba_id || ''))
      setAutomationEnabled(config.automation_enabled === true)
    } finally {
      setWhatsappLoading(false)
    }
  }

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
    if (!(await appConfirm({
      title: `Desconectar ${integration.name}?`,
      confirmLabel: 'Desconectar',
      destructive: true,
    }))) return

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
      setConnectDialog(null)
      setApiKey('')
      toast({ variant: 'success', title: 'Desconectado', description: `${integration.name} desconectado.` })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshBlingToken (connectionId: string) {
    setRefreshingBlingId(connectionId)
    try {
      const res = await fetch(
        `/api/portal/hub/connections/item/${encodeURIComponent(connectionId)}/refresh-token`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        const apiMessage = typeof data?.message === 'string' ? data.message.trim() : ''
        const code = typeof data?.error === 'string' ? data.error : ''
        const detail = typeof data?.detail === 'string' ? data.detail : ''
        const description = apiMessage
          || blingRefreshTokenErrorToMessage(code || detail)
        toast({ title: 'Erro ao renovar token', description, variant: 'destructive' })
        return
      }

      setBlingConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? { ...c, token_expires_at: data.token_expires_at ?? c.token_expires_at }
            : c
        )
      )
      toast({
        variant: 'success',
        title: 'Token renovado',
        description: 'A conexão com o Bling foi atualizada.',
      })
      router.refresh()
    } finally {
      setRefreshingBlingId(null)
    }
  }

  async function handleDisconnectBlingConnection(connectionId: string) {
    if (!(await appConfirm({
      title: 'Desconectar esta conta do Bling?',
      confirmLabel: 'Desconectar',
      destructive: true,
    }))) return

    setLoading(true)
    try {
      const res = await fetch(`/api/portal/hub/connections/item/${connectionId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao desconectar', variant: 'destructive' })
        return
      }

      setBlingConnections((prev) => prev.filter((c) => c.id !== connectionId))
      setConnections((prev) => {
        const next = new Set(prev)
        if (blingConnections.length <= 1) next.delete('bling')
        return next
      })
      toast({ variant: 'success', title: 'Conta desconectada', description: 'Conta do Bling removida.' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenWhatsappConfig () {
    setWhatsappDialogOpen(true)
    await loadWhatsappConfig()
  }

  async function handleSaveWhatsappConfig () {
    if (!phoneNumberId.trim()) {
      toast({ title: 'Informe o Phone Number ID', variant: 'destructive' })
      return
    }
    if (!accessToken.trim() && !whatsappConfig?.connected) {
      toast({ title: 'Informe o token de acesso permanente', variant: 'destructive' })
      return
    }

    setWhatsappSaving(true)
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
          inbox_access: {
            unrestricted: whatsappInboxAccess.unrestricted,
            viewer_user_ids: whatsappInboxAccess.userIds,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao salvar',
          description: String((data as { hint?: string })?.hint || data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }

      setAccessToken('')
      setVerifyToken('')
      toast({ variant: 'success', title: 'Configuração salva' })
      setConnections((prev) => new Set(prev).add('whatsapp_business'))
      router.refresh()
      await loadWhatsappConfig()
    } finally {
      setWhatsappSaving(false)
    }
  }

  async function handleDisconnectWhatsappConfig () {
    if (!(await appConfirm({
      title: 'Remover integração WhatsApp Business?',
      confirmLabel: 'Remover',
      destructive: true,
    }))) return

    setWhatsappSaving(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-config', { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao desconectar', variant: 'destructive' })
        return
      }

      setWhatsappConfig(null)
      setPhoneNumberId('')
      setWabaId('')
      setAccessToken('')
      setVerifyToken('')
      setAutomationEnabled(false)
      setTestTo('')
      setConnections((prev) => {
        const next = new Set(prev)
        next.delete('whatsapp_business')
        return next
      })
      toast({ variant: 'success', title: 'WhatsApp desconectado' })
      router.refresh()
    } finally {
      setWhatsappSaving(false)
    }
  }

  async function handleSendWhatsappTest () {
    if (!testTo.trim()) {
      toast({ title: 'Informe o número (DDD + número)', variant: 'destructive' })
      return
    }

    setWhatsappTestSending(true)
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
          description: String(data?.detail || data?.error || 'Verifique token e número.'),
          variant: 'destructive',
        })
        return
      }
      const ch = data.channel === 'evolution' ? 'Evolution' : 'Cloud API'
      toast({ variant: 'success', title: 'Mensagem de teste enviada', description: `Canal: ${ch}.` })
    } finally {
      setWhatsappTestSending(false)
    }
  }

  async function loadEvolutionConfig (): Promise<WhatsappEvolutionConfig | null> {
    setEvolutionLoading(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-evolution-config')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao carregar Evolution API',
          description: String(data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return null
      }
      const config = data as WhatsappEvolutionConfig
      setEvolutionConfig(config)
      const instances = config.instances || []
      const first = instances[0]
      const editingId = evolutionEditingConnectionId && instances.some((i) => i.connection_id === evolutionEditingConnectionId)
        ? evolutionEditingConnectionId
        : first?.connection_id ?? null
      setEvolutionEditingConnectionId(editingId)
      const editing = instances.find((i) => i.connection_id === editingId)
      setEvolutionInstanceName(String(editing?.instance_name || ''))
      setEvolutionLabel(String(editing?.label || ''))
      setEvolutionPreferred(editing?.preferred_for_messages === true)
      setEvolutionAutomation(editing?.automation_enabled === true)
      const autoMsgs = evolutionAutoMessageFormFromInstance(editing)
      setEvolutionAutoMessagesEnabled(autoMsgs.enabled)
      setEvolutionTplOsOpened(autoMsgs.osOpened)
      setEvolutionTplReadyPickup(autoMsgs.ready)
      setEvolutionBaseOverride(String(editing?.api_base_url_override || ''))
      return config
    } finally {
      setEvolutionLoading(false)
    }
    return null
  }

  function selectEvolutionInstanceForEdit (inst: WhatsappEvolutionInstance) {
    resetEvolutionQrState()
    setEvolutionEditingConnectionId(inst.connection_id)
    setEvolutionInstanceName(inst.instance_name)
    setEvolutionLabel(String(inst.label || ''))
    setEvolutionPreferred(inst.preferred_for_messages)
    setEvolutionAutomation(inst.automation_enabled)
    const autoMsgs = evolutionAutoMessageFormFromInstance(inst)
    setEvolutionAutoMessagesEnabled(autoMsgs.enabled)
    setEvolutionTplOsOpened(autoMsgs.osOpened)
    setEvolutionTplReadyPickup(autoMsgs.ready)
    setEvolutionBaseOverride(String(inst.api_base_url_override || ''))
    setEvolutionApiKey('')
  }

  function startNewEvolutionInstance () {
    resetEvolutionQrState()
    setEvolutionEditingConnectionId(null)
    setEvolutionInstanceName('')
    setEvolutionLabel('')
    setEvolutionPreferred(false)
    setEvolutionAutomation(false)
    setEvolutionAutoMessagesEnabled(false)
    setEvolutionTplOsOpened(DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_opened)
    setEvolutionTplReadyPickup(DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_ready_for_pickup)
    setEvolutionBaseOverride('')
    setEvolutionApiKey('')
    setEvolutionInboxAccess({ unrestricted: true, userIds: [] })
  }

  async function handleOpenEvolutionConfig () {
    setEvolutionDialogOpen(true)
    resetEvolutionQrState()
    await loadEvolutionConfig()
  }

  async function handleSaveEvolutionConfig () {
    if (!evolutionInstanceName.trim()) {
      toast({ title: 'Informe o nome da instância na Evolution', variant: 'destructive' })
      return
    }

    setEvolutionSaving(true)
    try {
      const res = await fetch('/api/portal/hub/whatsapp-evolution-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: evolutionEditingConnectionId || undefined,
          instance_name: evolutionInstanceName.trim(),
          label: evolutionLabel.trim() || undefined,
          api_key: evolutionApiKey.trim() || undefined,
          api_base_url_override: evolutionBaseOverride.trim() || undefined,
          preferred_for_messages: evolutionPreferred,
          automation_enabled: evolutionAutomation,
          auto_messages_enabled: evolutionAutoMessagesEnabled,
          auto_message_templates: {
            os_opened: evolutionTplOsOpened,
            os_ready_for_pickup: evolutionTplReadyPickup,
          },
          inbox_access: {
            unrestricted: evolutionInboxAccess.unrestricted,
            viewer_user_ids: evolutionInboxAccess.userIds,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Erro ao salvar',
          description: String((data as { hint?: string })?.hint || data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      setEvolutionApiKey('')
      const savedId = String((data as { connection?: { id?: string } }).connection?.id || '')
      if (savedId) setEvolutionEditingConnectionId(savedId)
      toast({ variant: 'success', title: 'Evolution API configurada' })
      setConnections((prev) => new Set(prev).add('whatsapp_evolution'))
      router.refresh()
      await loadEvolutionConfig()
    } finally {
      setEvolutionSaving(false)
    }
  }

  async function handleDisconnectEvolutionConfig () {
    const id = evolutionEditingConnectionId
    if (!id) return
    if (!(await appConfirm({
      title: 'Remover esta instância Evolution?',
      confirmLabel: 'Remover',
      destructive: true,
    }))) return
    setEvolutionSaving(true)
    try {
      const res = await fetch(`/api/portal/hub/whatsapp-evolution-config/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao desconectar', variant: 'destructive' })
        return
      }
      toast({ variant: 'success', title: 'Instância removida' })
      setEvolutionEditingConnectionId(null)
      const reloaded = await loadEvolutionConfig()
      if (!reloaded?.instances?.length) {
        setConnections((prev) => {
          const next = new Set(prev)
          next.delete('whatsapp_evolution')
          return next
        })
      }
      router.refresh()
    } finally {
      setEvolutionSaving(false)
    }
  }

  async function handleEvolutionDiagnostics () {
    setEvolutionStatusChecking(true)
    setEvolutionStatusHints(null)
    try {
      const qs = evolutionEditingConnectionId
        ? `?connection_id=${encodeURIComponent(evolutionEditingConnectionId)}`
        : ''
      const res = await fetch(`/api/portal/hub/whatsapp-evolution-status${qs}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Diagnóstico indisponível',
          description: String(data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      const hints = Array.isArray(data.hints) ? (data.hints as string[]) : []
      const last = data.last_24h as {
        integration_webhooks?: number
        whatsapp_conversations?: number
        last_payload_analysis?: {
          parsed_inbound_count?: number
          message_type?: string | null
          from_me?: boolean | null
          data_shape?: string
        } | null
      } | undefined
      const analysis = last?.last_payload_analysis
      const summary = [
        `Webhooks (24h): ${last?.integration_webhooks ?? 0}`,
        `Conversas WhatsApp: ${last?.whatsapp_conversations ?? 0}`,
        data.hub?.service_finds_hub === false
          ? 'Servidor não achou o hub pela instância salva.'
          : null,
        analysis
          ? `Último payload: ${analysis.data_shape ?? '—'}, tipo ${analysis.message_type ?? '—'}, fromMe ${analysis.from_me ?? '—'}, parse ${analysis.parsed_inbound_count ?? 0}`
          : null,
      ].filter(Boolean) as string[]
      setEvolutionStatusHints([...summary, ...hints])
      if (hints.length === 0 && (last?.whatsapp_conversations ?? 0) > 0) {
        toast({ variant: 'success', title: 'Integração parece OK', description: 'Há conversas na base.' })
      }
    } finally {
      setEvolutionStatusChecking(false)
    }
  }

  async function handleEvolutionSyncChats () {
    setEvolutionSyncing(true)
    try {
      if (!evolutionEditingConnectionId) {
        toast({ title: 'Selecione ou salve uma instância', variant: 'destructive' })
        return
      }
      const res = await fetch('/api/portal/hub/whatsapp-evolution-sync-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: evolutionEditingConnectionId, limit: 150 }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        const err = String(data?.error || '')
        const hint = String((data as { hint?: string })?.hint || '')
        const desc =
          hint ||
          (err.includes('Unauthorized') || res.status === 401
            ? 'API key ou nome da instância incorretos na Evolution.'
            : err === 'whatsapp_evolution_not_configured'
              ? 'Defina WHATSAPP_EVOLUTION_API_URL e API key no servidor ou no hub.'
              : err || 'Verifique a Evolution API.')
        toast({
          title: 'Falha ao sincronizar',
          description: desc,
          variant: 'destructive',
        })
        return
      }
      const legacyNote = (data as { migration_recommended?: boolean; hint?: string }).migration_recommended
        ? ` ${(data as { hint?: string }).hint || ''}`
        : ''
      toast({
        variant: 'success',
        title: 'Conversas sincronizadas',
        description: `${data.synced ?? 0} no total (${data.direct ?? 0} diretas, ${data.groups ?? 0} grupos).${legacyNote}`,
      })
    } finally {
      setEvolutionSyncing(false)
    }
  }

  async function handleSendEvolutionTest () {
    if (!evolutionTestTo.trim()) {
      toast({ title: 'Informe o número', variant: 'destructive' })
      return
    }
    setEvolutionTestSending(true)
    try {
      if (!evolutionEditingConnectionId) {
        toast({ title: 'Selecione ou salve uma instância', variant: 'destructive' })
        return
      }
      const res = await fetch('/api/portal/hub/whatsapp-evolution-test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: evolutionEditingConnectionId,
          to: evolutionTestTo.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Falha ao enviar',
          description: String(data?.detail || data?.error || 'Verifique instância Evolution e API.'),
          variant: 'destructive',
        })
        return
      }
      toast({ variant: 'success', title: 'Teste Evolution enviado' })
    } finally {
      setEvolutionTestSending(false)
    }
  }

  function addBlingLookupSku (raw: string) {
    const parts = String(raw || '')
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setBlingLookupSkus((prev) => {
      const seen = new Set(prev.map((sku) => sku.toLowerCase()))
      const next = [...prev]
      for (const sku of parts) {
        const key = sku.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        next.push(sku)
        if (next.length >= 50) break
      }
      return next
    })
    setBlingLookupDraft('')
  }

  function removeBlingLookupSku (sku: string) {
    setBlingLookupSkus((prev) => prev.filter((item) => item !== sku))
  }

  function addBlingLookupGtin (raw: string) {
    const parts = String(raw || '')
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setBlingLookupGtins((prev) => {
      const seen = new Set(prev.map((gtin) => gtin.replace(/\D/g, '')))
      const next = [...prev]
      for (const gtin of parts) {
        const key = gtin.replace(/\D/g, '')
        if (!key || seen.has(key)) continue
        seen.add(key)
        next.push(gtin)
        if (next.length >= 50) break
      }
      return next
    })
    setBlingLookupGtinDraft('')
  }

  function removeBlingLookupGtin (gtin: string) {
    setBlingLookupGtins((prev) => prev.filter((item) => item !== gtin))
  }

  async function handleBlingSearchSync () {
    const draft = blingLookupDraft.trim()
    const skus = [...blingLookupSkus]
    if (draft) {
      const key = draft.toLowerCase()
      if (!skus.some((sku) => sku.toLowerCase() === key)) {
        skus.push(draft)
      }
    }

    const gtinDraft = blingLookupGtinDraft.trim()
    const gtins = [...blingLookupGtins]
    if (gtinDraft) {
      const key = gtinDraft.replace(/\D/g, '')
      if (key && !gtins.some((gtin) => gtin.replace(/\D/g, '') === key)) {
        gtins.push(gtinDraft)
      }
    }

    if (skus.length === 0 && gtins.length === 0) {
      toast({ title: 'Informe ao menos um SKU ou GTIN', variant: 'destructive' })
      return
    }

    setBlingLookupLoading(true)
    try {
      const res = await fetch('/api/portal/hub/bling/search-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus, gtins }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        const error = String(data?.error || '')
        const onlyGtins = skus.length === 0 && gtins.length > 0
        toast({
          title: 'Falha ao sincronizar produto',
          description:
            error === 'product_not_found'
              ? onlyGtins
                ? gtins.length > 1
                  ? 'Nenhum dos GTINs foi encontrado no Bling.'
                  : 'Produto não encontrado no Bling com esse GTIN.'
                : skus.length > 1 || gtins.length > 0
                  ? 'Nenhum dos códigos foi encontrado no Bling.'
                  : 'Produto não encontrado no Bling com esse SKU.'
              : String(data?.message || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }

      const created = Number(data?.created || 0)
      const updated = Number(data?.updated || 0)
      const notFound = Number(data?.notFound || 0)
      const parts = [
        created > 0 ? `${created} criado(s)` : null,
        updated > 0 ? `${updated} atualizado(s)` : null,
        notFound > 0 ? `${notFound} não encontrado(s)` : null,
      ].filter(Boolean)

      const lookupCount = skus.length + gtins.length
      toast({
        variant: 'success',
        title: lookupCount === 1 ? 'Produto sincronizado' : 'Produtos sincronizados',
        description: parts.length > 0
          ? parts.join(' · ')
          : String(data?.productName || 'Sincronização concluída.'),
      })
      setBlingLookupSkus([])
      setBlingLookupDraft('')
      setBlingLookupGtins([])
      setBlingLookupGtinDraft('')
      router.refresh()
    } finally {
      setBlingLookupLoading(false)
    }
  }

  async function handleBlingSyncLatest () {
    if (!(await appConfirm({
      title: 'Sincronizar os últimos 50 criados?',
      description: 'Busca no Bling os 50 produtos mais recentemente incluídos e cria/atualiza no catálogo desta empresa.',
      confirmLabel: 'Sincronizar',
    }))) return

    setBlingLookupLoading(true)
    try {
      const res = await fetch('/api/portal/hub/bling/search-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'latest', limit: 50 }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Falha ao sincronizar',
          description:
            String(data?.error || '') === 'product_not_found'
              ? 'Nenhum produto recente encontrado no Bling.'
              : String(data?.message || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }

      const created = Number(data?.created || 0)
      const updated = Number(data?.updated || 0)
      const fetched = Number(data?.fetched || created + updated)
      toast({
        variant: 'success',
        title: 'Últimos produtos sincronizados',
        description: `${fetched} processado(s) · ${created} criado(s) · ${updated} atualizado(s)`,
      })
      router.refresh()
    } finally {
      setBlingLookupLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          {brandLabel
            ? `O HUB permite integrar ${brandLabel} a marketplaces, ERPs e ferramentas de IA. `
            : 'O HUB permite integrar sua operação a marketplaces, ERPs e ferramentas de IA. '}
          Cada integração pode ser configurada individualmente. Em breve você poderá criar
          automações como: novo pedido no Mercado Livre → criar OS automaticamente.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Integrações disponíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {integrations.map((integration) => {
            const isConnected =
              integration.id === 'bling'
                ? blingConnections.length > 0
                : integration.id === 'whatsapp_business'
                  ? Boolean(whatsappConfig?.connected || connections.has('whatsapp_business'))
                  : integration.id === 'whatsapp_evolution'
                    ? Boolean(evolutionConfig?.connected || connections.has('whatsapp_evolution'))
                    : connections.has(integration.id)

            return (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isConnected={isConnected}
                onOpenDetails={() => {
                  if (integration.status === 'coming_soon') {
                    setInfoDialog(integration)
                    return
                  }
                  if (integration.id === 'bling') {
                    setBlingDialogOpen(true)
                    return
                  }
                  if (integration.id === 'whatsapp_business') {
                    void handleOpenWhatsappConfig()
                    return
                  }
                  if (integration.id === 'whatsapp_evolution') {
                    void handleOpenEvolutionConfig()
                    return
                  }
                  if (integration.id === 'chatgpt') {
                    setSelectedModel(chatgptModel)
                    setConnectDialog(integration)
                    return
                  }
                  setSelectedModel('gpt-5-mini')
                  setConnectDialog(integration)
                }}
              />
            )
          })}
        </div>
      </div>

      <Dialog
        open={!!infoDialog}
        onOpenChange={(open) => {
          if (!open) setInfoDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoDialog?.name}</DialogTitle>
            <DialogDescription>
              {infoDialog?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Badge variant="secondary">Em breve</Badge>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            {infoDialog?.docsUrl ? (
              <Button type="button" variant="outline" asChild>
                <a href={infoDialog.docsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Documentação
                </a>
              </Button>
            ) : <span />}
            <Button type="button" variant="outline" onClick={() => setInfoDialog(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {connectDialog && connections.has(connectDialog.id) ? (
              <div className="rounded-md border border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20 p-3 space-y-1">
                <p className="text-xs font-medium text-foreground">Status da conexão</p>
                <p className="text-xs text-muted-foreground">
                  Integração ativa
                  {connectDialog.id === 'chatgpt' ? (
                    <>
                      {' · '}Modelo:{' '}
                      <span className="font-medium text-foreground">{selectedModel}</span>
                    </>
                  ) : null}
                </p>
              </div>
            ) : connectDialog ? (
              <div className="rounded-md border border-gray-200 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Integração ainda não configurada. Siga os passos abaixo para conectar.
                </p>
              </div>
            ) : null}
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
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {connectDialog?.docsUrl ? (
                <Button type="button" variant="outline" asChild>
                  <a href={connectDialog.docsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Documentação
                  </a>
                </Button>
              ) : null}
              {connectDialog && connections.has(connectDialog.id) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={loading}
                  onClick={() => void handleDisconnect(connectDialog)}
                >
                  Desconectar
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={blingDialogOpen}
        onOpenChange={setBlingDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Bling</DialogTitle>
            <DialogDescription>
              ERP Bling: contas conectadas, sincronização de produtos e status do token.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <BlingConnectionsPanel
              blingConnections={blingConnections}
              onDisconnectBlingConnection={handleDisconnectBlingConnection}
              onRefreshBlingToken={isAdmin ? handleRefreshBlingToken : undefined}
              refreshingBlingId={refreshingBlingId}
              oauthUrl={isAdmin ? '/api/portal/hub/oauth/bling' : undefined}
            />

            {isAdmin && blingConnections.length > 0 ? (
              <div className="rounded-md border p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Buscar produto e sincronizar</p>
                  <p className="text-xs text-muted-foreground">
                    Adicione SKUs e/ou GTINs (Enter ou sair do campo). SKU usa <code className="rounded bg-muted px-1">codigo/codigos</code>; GTIN usa <code className="rounded bg-muted px-1">gtins</code>.
                  </p>
                </div>
                <div className="rounded-md border border-dashed bg-muted/20 p-2.5 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">URL do webhook (cadastre no app Bling → Webhooks)</p>
                  <code className="block break-all text-[11px] text-foreground">
                    https://www.conectize.com.br/api/portal/bling/webhook
                  </code>
                  <p>
                    Confira se o servidor &quot;Prod&quot; no Bling aponta exatamente para essa URL. O portal confirma o recebimento na hora e processa o produto em seguida.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">SKUs</p>
                  <div
                    className={cn(
                      'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5',
                      blingLookupLoading && 'opacity-70',
                    )}
                  >
                    {blingLookupSkus.map((sku) => (
                      <span
                        key={sku}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs font-medium"
                      >
                        <span className="truncate">{sku}</span>
                        <button
                          type="button"
                          className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label={`Remover ${sku}`}
                          disabled={blingLookupLoading}
                          onClick={() => removeBlingLookupSku(sku)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <Input
                      value={blingLookupDraft}
                      onChange={(e) => setBlingLookupDraft(e.target.value)}
                      onBlur={() => {
                        if (blingLookupDraft.trim()) addBlingLookupSku(blingLookupDraft)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addBlingLookupSku(blingLookupDraft)
                          return
                        }
                        if (e.key === 'Backspace' && !blingLookupDraft && blingLookupSkus.length > 0) {
                          e.preventDefault()
                          removeBlingLookupSku(blingLookupSkus[blingLookupSkus.length - 1])
                        }
                      }}
                      placeholder={blingLookupSkus.length > 0 ? 'Outro SKU + Enter' : 'Ex: SKU-IPHONE-15 + Enter'}
                      disabled={blingLookupLoading}
                      className="h-7 min-w-[10rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">GTINs / códigos de barras</p>
                  <div
                    className={cn(
                      'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5',
                      blingLookupLoading && 'opacity-70',
                    )}
                  >
                    {blingLookupGtins.map((gtin) => (
                      <span
                        key={gtin}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs font-medium"
                      >
                        <span className="truncate">{gtin}</span>
                        <button
                          type="button"
                          className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label={`Remover ${gtin}`}
                          disabled={blingLookupLoading}
                          onClick={() => removeBlingLookupGtin(gtin)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <Input
                      value={blingLookupGtinDraft}
                      onChange={(e) => setBlingLookupGtinDraft(e.target.value)}
                      onBlur={() => {
                        if (blingLookupGtinDraft.trim()) addBlingLookupGtin(blingLookupGtinDraft)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addBlingLookupGtin(blingLookupGtinDraft)
                          return
                        }
                        if (e.key === 'Backspace' && !blingLookupGtinDraft && blingLookupGtins.length > 0) {
                          e.preventDefault()
                          removeBlingLookupGtin(blingLookupGtins[blingLookupGtins.length - 1])
                        }
                      }}
                      placeholder={blingLookupGtins.length > 0 ? 'Outro GTIN + Enter' : 'Ex: 7891234567890 + Enter'}
                      disabled={blingLookupLoading}
                      inputMode="numeric"
                      className="h-7 min-w-[10rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {blingLookupSkus.length === 0 && blingLookupGtins.length === 0
                      ? 'Nenhum SKU ou GTIN adicionado'
                      : [
                        blingLookupSkus.length > 0
                          ? `${blingLookupSkus.length} SKU(s)`
                          : null,
                        blingLookupGtins.length > 0
                          ? `${blingLookupGtins.length} GTIN(s)`
                          : null,
                      ].filter(Boolean).join(' · ')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleBlingSyncLatest()}
                      disabled={blingLookupLoading}
                    >
                      {blingLookupLoading ? 'Buscando…' : 'Últimos 50 criados'}
                    </Button>
                    <Button
                      onClick={() => void handleBlingSearchSync()}
                      disabled={
                        blingLookupLoading
                        || (
                          blingLookupSkus.length === 0
                          && !blingLookupDraft.trim()
                          && blingLookupGtins.length === 0
                          && !blingLookupGtinDraft.trim()
                        )
                      }
                    >
                      {blingLookupLoading ? 'Buscando…' : 'Sincronizar'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href="https://developer.bling.com.br/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Documentação
                </a>
              </Button>
              {isAdmin ? (
                <Button type="button" variant="outline" asChild>
                  <Link href="/portal/admin/webhooks?platform=bling" prefetch={false}>
                    <History className="h-4 w-4 mr-1" />
                    Histórico de webhooks
                  </Link>
                </Button>
              ) : null}
            </div>
            <Button type="button" variant="outline" onClick={() => setBlingDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={whatsappDialogOpen}
        onOpenChange={(open) => {
          setWhatsappDialogOpen(open)
          if (!open) {
            setAccessToken('')
            setVerifyToken('')
            setTestTo('')
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp Business</DialogTitle>
            <DialogDescription>
              Centralize os dados da Cloud API, webhook e automação por IA em um único lugar.
            </DialogDescription>
          </DialogHeader>

          {whatsappLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando configurações do WhatsApp…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {whatsappConfig?.connected ? (
                <div className="rounded-md border border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20 p-3 space-y-1">
                  <p className="text-xs font-medium text-foreground">Status da conexão</p>
                  <p className="text-xs text-muted-foreground">
                    Número conectado:{' '}
                    <span className="font-medium text-foreground">{whatsappConfig.phone_number_id || '—'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Automação IA:{' '}
                    <span className="font-medium text-foreground">
                      {whatsappConfig.automation_enabled ? 'Ativa' : 'Desativada'}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    WhatsApp Business ainda não configurado. Preencha os dados abaixo para conectar.
                  </p>
                </div>
              )}

              {whatsappConfig?.webhook_url ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">URL do callback: </span>
                  <code className="break-all text-xs">{whatsappConfig.webhook_url}</code>
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
                  placeholder={whatsappConfig?.access_token_masked ? `Atual: ${whatsappConfig.access_token_masked}` : 'EAA...'}
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
                  placeholder={whatsappConfig?.verify_token_configured ? 'Deixe em branco para manter' : 'Mesmo valor configurado na Meta'}
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Atendimento automatizado por IA</p>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, respostas iniciais e orçamentos usam o ChatGPT.
                  </p>
                </div>
                <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
              </div>

              {isAdmin ? (
                <HubInboxViewersPicker
                  connectionId={whatsappConfig?.connection_id ?? null}
                  disabled={whatsappSaving || whatsappLoading}
                  value={whatsappInboxAccess}
                  onChange={setWhatsappInboxAccess}
                />
              ) : null}

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
                    disabled={whatsappTestSending || !whatsappConfig?.connected}
                    onClick={() => void handleSendWhatsappTest()}
                  >
                    {whatsappTestSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar teste'}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                O teste usa a prioridade do portal: oficial por padrão; ative preferência Evolution no card Evolution
                se quiser usar o Baileys.
              </p>

              <p className="text-xs text-muted-foreground">
                Defina <code className="rounded bg-muted px-1">WHATSAPP_APP_SECRET</code> ou{' '}
                <code className="rounded bg-muted px-1">META_APP_SECRET</code> no servidor para validar assinaturas do webhook.
              </p>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Documentação
                </a>
              </Button>
              {whatsappConfig?.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={whatsappSaving}
                  onClick={() => void handleDisconnectWhatsappConfig()}
                >
                  Desconectar
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={whatsappSaving}
                onClick={() => setWhatsappDialogOpen(false)}
              >
                Fechar
              </Button>
              <Button
                type="button"
                disabled={whatsappSaving || whatsappLoading}
                onClick={() => void handleSaveWhatsappConfig()}
              >
                {whatsappSaving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={evolutionDialogOpen}
        onOpenChange={(open) => {
          setEvolutionDialogOpen(open)
          if (!open) {
            resetEvolutionQrState()
            setEvolutionApiKey('')
            setEvolutionTestTo('')
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp Evolution API</DialogTitle>
            <DialogDescription>
              Configure a instância Evolution, conecte o WhatsApp pelo QR Code abaixo e aponte o webhook para a URL indicada.
            </DialogDescription>
          </DialogHeader>

          {evolutionLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando Evolution…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {evolutionConfig?.connected ? (
                <div className="rounded-md border border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20 p-3 space-y-1">
                  <p className="text-xs font-medium text-foreground">Status da conexão</p>
                  <p className="text-xs text-muted-foreground">
                    Instâncias Evolution:{' '}
                    <span className="font-medium text-foreground">
                      {evolutionConfig.instances?.length ?? 0}
                    </span>
                  </p>
                  {(evolutionConfig.instances || []).map((inst) => (
                    <p key={inst.connection_id} className="text-xs text-muted-foreground">
                      · {inst.display_label}
                      {inst.preferred_for_messages ? ' (preferida)' : ''}
                      {inst.auto_messages_enabled ? ' · msgs auto' : ''}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Nenhuma instância Evolution configurada. Crie ou conecte uma instância abaixo.
                  </p>
                </div>
              )}

              {isAdmin && lojistasRoutine?.available ? (
                <LojistasRoutinePanel
                  routine={lojistasRoutine}
                  onRun={() => void handleRunLojistasRoutine()}
                  isRunning={lojistasRoutineRunning}
                />
              ) : null}

              {evolutionConfig?.webhook_url ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div>
                    <span className="font-medium">Webhook (POST): </span>
                    <code className="break-all text-xs">{evolutionConfig.webhook_url}</code>
                  </div>
                  {evolutionConfig.webhook_secret_configured ? (
                    <p className="text-xs text-muted-foreground">
                      Configure o header <code className="rounded bg-muted px-1">x-whatsapp-evolution-secret</code> na
                      Evolution com o mesmo valor de WHATSAPP_EVOLUTION_WEBHOOK_SECRET.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Opcional: defina WHATSAPP_EVOLUTION_WEBHOOK_SECRET no app e repita o valor em um header customizado
                      na Evolution.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground space-y-2">
                <p>
                  Se a Evolution roda no Docker, o webhook não pode ser <code className="rounded bg-muted px-1">localhost</code>{' '}
                  — use{' '}
                  <code className="rounded bg-muted px-1 break-all">
                    http://host.docker.internal:3000/api/webhooks/whatsapp-evolution
                  </code>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={evolutionStatusChecking}
                    onClick={() => void handleEvolutionDiagnostics()}
                  >
                    {evolutionStatusChecking ? 'Verificando…' : 'Verificar integração (24h)'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={evolutionSyncing || !evolutionEditingConnectionId}
                    onClick={() => void handleEvolutionSyncChats()}
                  >
                    {evolutionSyncing ? 'Sincronizando…' : 'Sincronizar conversas (incl. grupos)'}
                  </Button>
                </div>
                {evolutionStatusHints && evolutionStatusHints.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1 text-foreground">
                    {evolutionStatusHints.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => startNewEvolutionInstance()}>
                  Nova instância
                </Button>
              </div>
              {(evolutionConfig?.instances?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {evolutionConfig?.instances.map((inst) => (
                    <Button
                      key={inst.connection_id}
                      type="button"
                      size="sm"
                      variant={evolutionEditingConnectionId === inst.connection_id ? 'default' : 'outline'}
                      onClick={() => selectEvolutionInstanceForEdit(inst)}
                    >
                      {inst.display_label}
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="evo-label">Nome no portal (opcional)</Label>
                <Input
                  id="evo-label"
                  value={evolutionLabel}
                  onChange={(e) => setEvolutionLabel(e.target.value)}
                  placeholder="ex: Loja centro"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evo-instance">Nome da instância (Evolution)</Label>
                <Input
                  id="evo-instance"
                  value={evolutionInstanceName}
                  onChange={(e) => setEvolutionInstanceName(e.target.value)}
                  placeholder="ex: conectize-prod"
                  autoComplete="off"
                />
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Conexão WhatsApp (QR Code)</p>
                    <p className="text-xs text-muted-foreground">
                      Gera o QR na Evolution API e aguarda o pareamento no celular.
                    </p>
                  </div>
                  <Badge
                    variant={
                      evolutionConnectionState === 'open'
                        ? 'default'
                        : evolutionConnectionState === 'connecting'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {evolutionConnectionState === 'open'
                      ? 'Conectado'
                      : evolutionConnectionState === 'connecting'
                        ? 'Aguardando leitura'
                        : evolutionConnectionState === 'close'
                          ? 'Desconectado'
                          : 'Status desconhecido'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={evolutionQrLoading || !evolutionInstanceName.trim()}
                    onClick={() => void handleEvolutionStartQrConnect()}
                  >
                    {evolutionQrLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="mr-2 h-4 w-4" />
                    )}
                    {evolutionQrBase64 ? 'Atualizar QR Code' : 'Conectar via QR Code'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={evolutionQrLoading || !evolutionInstanceName.trim()}
                    onClick={() => void refreshEvolutionConnectionState()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar status
                  </Button>
                </div>

                {evolutionPairingCode ? (
                  <p className="text-xs text-muted-foreground">
                    Código de pareamento: <span className="font-mono font-medium text-foreground">{evolutionPairingCode}</span>
                  </p>
                ) : null}

                {evolutionQrBase64 ? (
                  <div className="flex flex-col items-center gap-2 rounded-md border bg-background p-4">
                    <img
                      src={evolutionQrBase64}
                      alt="QR Code WhatsApp Evolution"
                      className="h-52 w-52 max-w-full object-contain"
                    />
                    <p className="text-center text-xs text-muted-foreground max-w-sm">
                      No WhatsApp: Menu → Aparelhos conectados → Conectar aparelho → escaneie o QR Code.
                      {evolutionQrPolling ? ' Aguardando confirmação…' : ''}
                    </p>
                  </div>
                ) : evolutionConnectionState === 'open' ? (
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Instância conectada. Salve as configurações e sincronize as conversas se necessário.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="evo-key">API key (header apikey)</Label>
                <Input
                  id="evo-key"
                  type="password"
                  value={evolutionApiKey}
                  onChange={(e) => setEvolutionApiKey(e.target.value)}
                  placeholder={
                    (() => {
                      const editing = evolutionConfig?.instances.find(
                        (i) => i.connection_id === evolutionEditingConnectionId,
                      )
                      if (editing?.access_token_masked) {
                        return `Mantém atual (${editing.access_token_masked}) — preencha só para trocar`
                      }
                      if (editing?.has_api_key) {
                        return 'Mantém a chave já salva — preencha só para trocar'
                      }
                      if (evolutionConfig?.env_api_key_fallback) {
                        return 'Opcional se WHATSAPP_EVOLUTION_API_KEY estiver no servidor'
                      }
                      return 'Mesmo AUTHENTICATION_API_KEY da Evolution'
                    })()
                  }
                  autoComplete="off"
                />
                {evolutionEditingConnectionId
                  && (evolutionConfig?.instances.find((i) => i.connection_id === evolutionEditingConnectionId)?.has_api_key
                    || evolutionConfig?.instances.find((i) => i.connection_id === evolutionEditingConnectionId)?.access_token_masked)
                  && !evolutionApiKey.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      A chave já está salva nesta instância. Deixe em branco para mantê-la.
                    </p>
                  ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="evo-base">URL base da Evolution (override opcional)</Label>
                <Input
                  id="evo-base"
                  value={evolutionBaseOverride}
                  onChange={(e) => setEvolutionBaseOverride(e.target.value)}
                  placeholder={
                    evolutionConfig?.uses_env_api_base
                      ? 'Deixe vazio para usar WHATSAPP_EVOLUTION_API_URL'
                      : 'https://evolution.seudominio.com'
                  }
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Preferir Evolution para envio</p>
                  <p className="text-xs text-muted-foreground">
                    Se o WhatsApp oficial também estiver ativo, mensagens do portal usam Evolution quando ligado.
                  </p>
                </div>
                <Switch checked={evolutionPreferred} onCheckedChange={setEvolutionPreferred} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Atendimento automatizado por IA (Evolution inbound)</p>
                  <p className="text-xs text-muted-foreground">
                    Fluxo igual ao oficial: mensagens vindas pela Evolution podem responder via ChatGPT.
                  </p>
                </div>
                <Switch checked={evolutionAutomation} onCheckedChange={setEvolutionAutomation} />
              </div>

              <EvolutionAutoMessagesFields
                enabled={evolutionAutoMessagesEnabled}
                osOpened={evolutionTplOsOpened}
                readyForPickup={evolutionTplReadyPickup}
                onEnabledChange={setEvolutionAutoMessagesEnabled}
                onOsOpenedChange={setEvolutionTplOsOpened}
                onReadyForPickupChange={setEvolutionTplReadyPickup}
              />

              {isAdmin ? (
                <HubInboxViewersPicker
                  connectionId={evolutionEditingConnectionId}
                  disabled={evolutionSaving || evolutionLoading}
                  value={evolutionInboxAccess}
                  onChange={setEvolutionInboxAccess}
                />
              ) : null}

              <div className="rounded-md border border-dashed p-3 space-y-2">
                <p className="text-sm font-medium">Teste direto via Evolution API</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="evo-test-to">Número (DDI + DDD)</Label>
                    <Input
                      id="evo-test-to"
                      value={evolutionTestTo}
                      onChange={(e) => setEvolutionTestTo(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={evolutionTestSending || !evolutionEditingConnectionId}
                    onClick={() => void handleSendEvolutionTest()}
                  >
                    {evolutionTestSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Enviar teste'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a
                  href="https://doc.evolution-api.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Documentação
                </a>
              </Button>
              {evolutionEditingConnectionId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={evolutionSaving}
                  onClick={() => void handleDisconnectEvolutionConfig()}
                >
                  Remover instância
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={evolutionSaving}
                onClick={() => setEvolutionDialogOpen(false)}
              >
                Fechar
              </Button>
              <Button
                type="button"
                disabled={evolutionSaving || evolutionLoading}
                onClick={() => void handleSaveEvolutionConfig()}
              >
                {evolutionSaving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
