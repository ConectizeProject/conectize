import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ClienteDetailClient } from './ClienteDetailClient'
import { PortalMembersAdminCard, type PortalMemberRow } from './PortalMembersAdminCard'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{
  memberError?: string
  memberOk?: string
  memberRemoved?: string
}>

export default async function ClienteDetailPage ({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const sp = await searchParams
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const isAdmin = role === 'admin'

  const supabase = await createSupabaseServerClient()
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone')
    .eq('id', id)
    .maybeSingle()

  if (error || !customer) notFound()

  let portalMembers: PortalMemberRow[] = []
  if (isAdmin) {
    const { data: rows } = await supabase
      .from('customer_portal_members')
      .select('id, user_id, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })

    const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id)
    const { data: usersRows } =
      ids.length > 0
        ? await supabase
          .from('users')
          .select('id, email, full_name, role')
          .in('id', ids)
        : { data: [] as { id: string; email: string | null; full_name: string | null; role: string | null }[] }

    const byUser = new Map((usersRows ?? []).map((u) => [u.id, u]))
    portalMembers = (rows ?? []).map((r: { id: string; user_id: string; created_at: string }) => {
      const u = byUser.get(r.user_id)
      return {
        id: r.id,
        user_id: r.user_id,
        email: u?.email ?? null,
        full_name: u?.full_name ?? null,
        role: u?.role ?? null,
        created_at: r.created_at,
      }
    })
  }

  let selectableRetailers: Array<{ id: string; email: string | null; full_name: string | null }> = []
  if (isAdmin) {
    const [{ data: retailers }, { data: allMemberships }] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('role', 'retailer')
        .order('email', { ascending: true }),
      supabase.from('customer_portal_members').select('user_id, customer_id'),
    ])

    const memberUserIdsThis = new Set(portalMembers.map((m) => m.user_id))
    const linkedOtherShop = new Set(
      (allMemberships ?? [])
        .filter((m: { customer_id: string }) => m.customer_id !== customer.id)
        .map((m: { user_id: string }) => m.user_id),
    )

    selectableRetailers = (retailers ?? [])
      .filter(
        (u: { id: string }) =>
          !memberUserIdsThis.has(u.id) && !linkedOtherShop.has(u.id),
      )
      .map((u: { id: string; email: string | null; full_name: string | null }) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
      }))
  }

  const displayName = customer.is_company
    ? (customer.company_name || customer.trade_name || customer.full_name || 'Empresa')
    : (customer.full_name || 'Cliente')
  const document = formatCpfCnpj(String(customer.cnpj || customer.cpf || ''))

  const memberErr = sp.memberError
  const memberErrMsg =
    memberErr === 'usuario_nao_encontrado'
      ? 'Usuário não encontrado com este e-mail.'
      : memberErr === 'precisa_ser_retailer'
        ? 'O usuário precisa ter o papel “lojista” (retailer).'
        : memberErr === 'ja_vinculado'
          ? 'Este usuário já está vinculado (ou já possui vínculo em outra loja).'
          : memberErr === 'invalido'
            ? 'Dados inválidos.'
            : memberErr === 'db'
              ? 'Não foi possível salvar.'
              : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal/clientes">← Clientes</Link>
          </Button>
          <h1 className="text-2xl font-bold mt-2">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{document}</p>
        </div>
      </div>

      {isAdmin && memberErrMsg ? (
        <Alert variant="destructive">
          <AlertTitle>Vínculo</AlertTitle>
          <AlertDescription>{memberErrMsg}</AlertDescription>
        </Alert>
      ) : null}

      {isAdmin && sp.memberOk ? (
        <Alert>
          <AlertTitle>Vínculo criado</AlertTitle>
          <AlertDescription>O usuário foi vinculado a esta loja.</AlertDescription>
        </Alert>
      ) : null}

      {isAdmin && sp.memberRemoved ? (
        <Alert>
          <AlertTitle>Removido</AlertTitle>
          <AlertDescription>O vínculo do portal foi removido.</AlertDescription>
        </Alert>
      ) : null}

      {isAdmin ? (
        <PortalMembersAdminCard
          customerId={customer.id}
          members={portalMembers}
          selectableRetailers={selectableRetailers}
        />
      ) : null}

      <ClienteDetailClient
        customerId={customer.id}
        customerName={displayName}
      />
    </div>
  )
}
