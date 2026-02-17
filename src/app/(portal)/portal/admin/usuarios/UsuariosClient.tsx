'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type UserRow = {
  id: string
  email: string | null
  role: string | null
  created_at: string
}

function filterByEmail(users: UserRow[], emailFilter: string): UserRow[] {
  if (!emailFilter.trim()) return users
  const lower = emailFilter.trim().toLowerCase()
  return users.filter((u) => (u.email ?? '').toLowerCase().includes(lower))
}

function UserTableRow({
  u,
  currentUserId,
  updateRoleAction,
}: {
  u: UserRow
  currentUserId: string
  updateRoleAction: (formData: FormData) => void
}) {
  const normalizedRole = u.role === 'customer' ? 'user' : u.role || 'user'
  return (
    <TableRow>
      <TableCell className="font-medium">{u.email || u.id}</TableCell>
      <TableCell>
        <form action={updateRoleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={u.id} />
          <select
            name="role"
            defaultValue={normalizedRole}
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
        {u.id === currentUserId ? 'Você' : ''}
      </TableCell>
    </TableRow>
  )
}

type Props = {
  initialAdmins: UserRow[]
  initialStaff: UserRow[]
  currentUserId: string
  updateRoleAction: (formData: FormData) => void
}

export function UsuariosClient({
  initialAdmins,
  initialStaff,
  currentUserId,
  updateRoleAction,
}: Props) {
  const [emailFilter, setEmailFilter] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [adminsOpen, setAdminsOpen] = useState(true)
  const [staffOpen, setStaffOpen] = useState(true)

  const loadUsers = useCallback(async () => {
    if (usersLoaded) return
    setUsersLoading(true)
    try {
      const res = await fetch('/api/portal/admin/usuarios?roles=user,customer')
      const data = await res.json()
      if (data?.ok && Array.isArray(data.users)) {
        setUsers(data.users)
        setUsersLoaded(true)
      }
    } finally {
      setUsersLoading(false)
    }
  }, [usersLoaded])

  const handleUsersOpenChange = useCallback(
    (open: boolean) => {
      setUsersOpen(open)
      if (open && !usersLoaded && !usersLoading) {
        loadUsers()
      }
    },
    [loadUsers, usersLoaded, usersLoading]
  )

  const filteredAdmins = filterByEmail(initialAdmins, emailFilter)
  const filteredStaff = filterByEmail(initialStaff, emailFilter)
  const filteredUsers = filterByEmail(users, emailFilter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários</CardTitle>
        <CardDescription>
          Roles: user, staff, admin. Admins e staff carregados. Usuários carregam ao expandir.
        </CardDescription>
        <div className="pt-2">
          <Label htmlFor="email-filter" className="sr-only">
            Filtrar por e-mail
          </Label>
          <Input
            id="email-filter"
            type="search"
            placeholder="Filtrar por e-mail..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={adminsOpen} onOpenChange={setAdminsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-medium hover:underline">
            {adminsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Admins ({filteredAdmins.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[220px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.length > 0 ? (
                  filteredAdmins.map((u) => (
                    <UserTableRow
                      key={u.id}
                      u={u}
                      currentUserId={currentUserId}
                      updateRoleAction={updateRoleAction}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-sm">
                      Nenhum admin encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={staffOpen} onOpenChange={setStaffOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-medium hover:underline">
            {staffOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Staff ({filteredStaff.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[220px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((u) => (
                    <UserTableRow
                      key={u.id}
                      u={u}
                      currentUserId={currentUserId}
                      updateRoleAction={updateRoleAction}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-sm">
                      Nenhum staff encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={usersOpen} onOpenChange={handleUsersOpenChange}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-medium hover:underline">
            {usersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Usuários ({usersLoaded ? filteredUsers.length : '…'})
          </CollapsibleTrigger>
          <CollapsibleContent>
            {usersLoading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando usuários...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[220px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <UserTableRow
                        key={u.id}
                        u={u}
                        currentUserId={currentUserId}
                        updateRoleAction={updateRoleAction}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground text-sm">
                        {usersLoaded ? 'Nenhum usuário encontrado.' : 'Expanda para carregar.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
