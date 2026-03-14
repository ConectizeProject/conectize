import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { UsuariosClient } from './UsuariosClient'

function isValidRole (value: string) {
  return value === 'user' || value === 'customer' || value === 'staff' || value === 'admin'
}

async function updateRoleAction (formData: FormData) {
  'use server'

  const userId = String(formData.get('userId') || '').trim()
  const role = String(formData.get('role') || '').trim()
  const fullName = String(formData.get('fullName') || '').trim()
  const cpf = String(formData.get('cpf') || '').trim()

  if (!userId || !isValidRole(role)) {
    redirect('/portal/admin/usuarios?error=dados_invalidos')
  }

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) redirect('/portal/login')

  const { data: me, error: meRoleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (!meRoleError && me?.role) ? me.role : 'user'
  const myNormalizedRole = myRole === 'customer' ? 'user' : myRole
  if (myNormalizedRole !== 'admin') redirect('/portal/ordens')

  const payload: Record<string, unknown> = {
    role: role === 'customer' ? 'user' : role,
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

  redirect('/portal/admin/usuarios?ok=1')
}

export default async function AdminUsuariosPage ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; email?: string }>
}) {
  const { error, ok, email } = await searchParams
  const initialEmail = String(email ?? '').trim()

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) redirect('/portal/login')

  const { data: me, error: meRoleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (!meRoleError && me?.role) ? me.role : 'user'
  const myNormalizedRole = myRole === 'customer' ? 'user' : myRole
  if (myNormalizedRole !== 'admin') redirect('/portal/ordens')

  const { data: adminsAndStaff } = await supabase
    .from('users')
    .select('id, email, full_name, cpf, role, created_at')
    .in('role', ['admin', 'staff'])
    .order('created_at', { ascending: false })

  const admins = (adminsAndStaff ?? []).filter((u: { role?: string }) => u.role === 'admin')
  const staff = (adminsAndStaff ?? []).filter((u: { role?: string }) => u.role === 'staff')

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
          {error === 'dados_invalidos' ? 'Dados inválidos.' : 'Não foi possível atualizar agora.'}
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
      />
    </div>
  )
}

