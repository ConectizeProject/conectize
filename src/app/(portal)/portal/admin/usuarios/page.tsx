import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function isValidRole (value: string) {
  return value === 'user' || value === 'customer' || value === 'staff' || value === 'admin'
}

async function updateRoleAction (formData: FormData) {
  'use server'

  const userId = String(formData.get('userId') || '').trim()
  const role = String(formData.get('role') || '').trim()

  if (!userId || !isValidRole(role)) {
    redirect('/portal/admin/usuarios?error=dados_invalidos')
  }

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) redirect('/portal/login')

  const { data: me, error: meRoleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (!meRoleError && me?.role) ? me.role : 'user'
  const myNormalizedRole = myRole === 'customer' ? 'user' : myRole
  if (myNormalizedRole !== 'admin') redirect('/portal/ordens')

  const { error } = await supabase
    .from('users')
    .update({ role: role === 'customer' ? 'user' : role })
    .eq('id', userId)

  if (error) redirect('/portal/admin/usuarios?error=nao_foi_possivel_atualizar')

  redirect('/portal/admin/usuarios?ok=1')
}

export default async function AdminUsuariosPage ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>
}) {
  const { error, ok } = await searchParams

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) redirect('/portal/login')

  const { data: me, error: meRoleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (!meRoleError && me?.role) ? me.role : 'user'
  const myNormalizedRole = myRole === 'customer' ? 'user' : myRole
  if (myNormalizedRole !== 'admin') redirect('/portal/ordens')

  const { data: users } = await supabase
    .from('users')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: false })

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

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Roles: user, staff, admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[220px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email || u.id}</TableCell>
                    <TableCell>
                      <form action={updateRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={(u.role === 'customer' ? 'user' : u.role) || 'user'}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="user">user</option>
                          <option value="staff">staff</option>
                          <option value="admin">admin</option>
                        </select>
                        <Button type="submit" size="sm" variant="secondary">
                          Salvar
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.id === user.id ? 'Você' : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

