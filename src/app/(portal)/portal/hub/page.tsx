import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { HubClient } from './HubClient'
import { HubToastClient } from './HubToastClient'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const me = appUser
  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole === 'staff') redirect('/portal/ordens')

  const { data: connections } = await supabase
    .from('hub_connections')
    .select('id, platform_id, metadata, created_at, token_expires_at')
    .order('created_at', { ascending: false })

  const connectedPlatforms = new Set((connections || []).map((c: { platform_id: string }) => c.platform_id))
  const chatgptConnection = connections?.find((c: { platform_id: string }) => c.platform_id === 'chatgpt')
  const chatgptModel = (chatgptConnection?.metadata as { model?: string } | null)?.model || 'gpt-5-mini'
  const blingConnections = (connections || []).filter(
    (c: { platform_id: string }) => c.platform_id === 'bling'
  ) as Array<{
    id: string
    platform_id: string
    metadata?: Record<string, unknown> | null
    created_at?: string
    token_expires_at?: string | null
  }>
  const meliConnections = (connections || []).filter(
    (c: { platform_id: string }) => c.platform_id === 'mercado_livre'
  ) as Array<{
    id: string
    platform_id: string
    metadata?: Record<string, unknown> | null
    created_at?: string
    token_expires_at?: string | null
  }>

  return (
    <div className="space-y-6">
      <HubToastClient />
      <div>
        <h1 className="text-2xl font-bold">HUB de integrações</h1>
        <p className="text-sm text-muted-foreground">
          Conecte seu sistema com outras plataformas. Configure automações, sincronize pedidos, clientes e muito mais.
        </p>
      </div>

      <HubClient
        initialConnections={Array.from(connectedPlatforms)}
        blingConnections={blingConnections}
        meliConnections={meliConnections}
        isAdmin={me?.role === 'admin' || me?.role === 'platform_admin'}
        chatgptModel={chatgptModel}
      />
    </div>
  )
}
