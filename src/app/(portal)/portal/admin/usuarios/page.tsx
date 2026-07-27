import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { UsuariosClient } from './UsuariosClient'

function isValidRole (value: string) {
  return (
    value === 'user' ||
    value === 'customer' ||
    value === 'staff' ||
    value === 'admin' ||
    value === 'retailer'
  )
}

function roleToOrgRole (role: string): 'admin' | 'staff' | 'user' {
  if (role === 'admin' || role === 'platform_admin') return 'admin'
  if (role === 'staff') return 'staff'
  return 'user'
}

async function updateRoleAction (formData: FormData) {
  'use server'

  const userId = String(formData.get('userId') || '').trim()
  const role = String(formData.get('role') || '').trim()
  const fullName = String(formData.get('fullName') || '').trim()
  const cpf = String(formData.get('cpf') || '').trim()
  const organizationIdInput = String(formData.get('organizationId') || '').trim()

  if (!userId) {
    redirect('/portal/admin/usuarios?error=dados_invalidos')
  }

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()
  const isEditingSelf = userId === user.id

  if (!isEditingSelf && !isValidRole(role)) {
    redirect('/portal/admin/usuarios?error=dados_invalidos')
  }

  const { data: me, error: meRoleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (!meRoleError && me?.role) ? me.role : 'user'
  const myNormalizedRole = myRole === 'customer' ? 'user' : myRole
  const isPlatformAdmin = myRole === 'platform_admin'
  if (myNormalizedRole !== 'admin' && !isPlatformAdmin) redirect('/portal/ordens')

  const payload: Record<string, unknown> = {}
  if (!isEditingSelf) {
    payload.role = role === 'customer' ? 'user' : role
  }
  if (formData.has('fullName')) {
    payload.full_name = fullName || null
  }
  if (formData.has('cpf')) {
    payload.cpf = cpf || null
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)

  if (error) redirect('/portal/admin/usuarios?error=nao_foi_possivel_atualizar')

  if (isPlatformAdmin && organizationIdInput && formData.has('organizationId')) {
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationIdInput)
      .maybeSingle()

    if (!orgRow?.id) {
      redirect('/portal/admin/usuarios?error=org_invalida')
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    const targetRole = String(targetUser?.role || role || 'user')
    const roleInOrg = roleToOrgRole(targetRole)

    try {
      const svc = createSupabaseServiceClient()
      const { data: currentMemberships } = await svc
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)

      const currentIds = (currentMemberships ?? []).map((m) => String(m.organization_id))
      const alreadyInTarget = currentIds.includes(organizationIdInput)

      if (!alreadyInTarget) {
        const { error: upsertErr } = await svc.from('organization_members').upsert(
          {
            organization_id: organizationIdInput,
            user_id: userId,
            role_in_org: roleInOrg,
          },
          { onConflict: 'organization_id,user_id' },
        )
        if (upsertErr) redirect('/portal/admin/usuarios?error=nao_foi_possivel_atualizar')

        const toRemove = currentIds.filter((id) => id !== organizationIdInput)
        if (toRemove.length > 0) {
          const { error: delErr } = await svc
            .from('organization_members')
            .delete()
            .eq('user_id', userId)
            .in('organization_id', toRemove)
          if (delErr) redirect('/portal/admin/usuarios?error=nao_foi_possivel_atualizar')
        }
      } else {
        await svc
          .from('organization_members')
          .update({ role_in_org: roleInOrg })
          .eq('user_id', userId)
          .eq('organization_id', organizationIdInput)
      }

      await svc.from('user_portal_context').upsert({
        user_id: userId,
        active_organization_id: organizationIdInput,
      })
    } catch {
      redirect('/portal/admin/usuarios?error=nao_foi_possivel_atualizar')
    }
  }

  redirect('/portal/admin/usuarios?ok=1')
}

type OrgOption = { id: string; slug: string; name: string | null; is_host: boolean }

export default async function AdminUsuariosPage ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; email?: string }>
}) {
  const { error, ok, email } = await searchParams
  const initialEmail = String(email ?? '').trim()

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me, error: meRoleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (!meRoleError && me?.role) ? me.role : 'user'
  const myNormalizedRole = myRole === 'customer' ? 'user' : myRole
  const isPlatformAdmin = myRole === 'platform_admin'
  if (myNormalizedRole !== 'admin' && !isPlatformAdmin) redirect('/portal/ordens')

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/ordens')

  let organizations: OrgOption[] = []
  let currentOrg: OrgOption | null = null
  if (isPlatformAdmin) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, slug, name, is_host')
      .order('name', { ascending: true })
    organizations = (orgs ?? []) as OrgOption[]
    currentOrg = organizations.find((o) => o.id === organizationId) ?? null
  }

  const membershipByUser = new Map<string, { organization_id: string; organization?: OrgOption | null }>()

  const { data: memberRows } = await supabase
    .from('organization_members')
    .select('user_id, organization_id')
    .eq('organization_id', organizationId)

  for (const row of memberRows ?? []) {
    membershipByUser.set(String(row.user_id), {
      organization_id: String(row.organization_id),
      organization: currentOrg,
    })
  }

  const memberIds = new Set(membershipByUser.keys())

  const { data: adminsAndStaff } = await supabase
    .from('users')
    .select('id, email, full_name, cpf, role, created_at')
    .in('role', ['admin', 'staff', 'platform_admin'])
    .order('created_at', { ascending: false })

  const enrich = (u: {
    id: string
    email: string | null
    full_name?: string | null
    cpf?: string | null
    role: string | null
    created_at: string
  }) => {
    const m = membershipByUser.get(u.id)
    const org = m?.organization
    return {
      ...u,
      organization_id: m?.organization_id ?? organizationId,
      organization_name: org?.name ?? org?.slug ?? null,
      organization_slug: org?.slug ?? null,
    }
  }

  const inScope = (adminsAndStaff ?? []).filter((u) => memberIds.has(u.id))

  const admins = inScope
    .filter((u) => u.role === 'admin' || u.role === 'platform_admin')
    .map(enrich)
  const staff = inScope
    .filter((u) => u.role === 'staff')
    .map(enrich)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários e permissões</h1>
        <p className="text-sm text-muted-foreground">
          Criação de usuários é feita no painel do Supabase. Aqui você ajusta os níveis de acesso.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {error === 'dados_invalidos'
            ? 'Dados inválidos.'
            : error === 'org_invalida'
              ? 'Organização inválida.'
              : 'Não foi possível atualizar agora.'}
        </p>
      ) : null}

      {ok ? (
        <p className="text-sm text-muted-foreground">
          Permissão atualizada.
        </p>
      ) : null}

      <UsuariosClient
        initialAdmins={admins}
        initialStaff={staff}
        currentUserId={user.id}
        updateRoleAction={updateRoleAction}
        initialEmailFilter={initialEmail}
        isPlatformAdmin={isPlatformAdmin}
        organizations={organizations}
      />
    </div>
  )
}
