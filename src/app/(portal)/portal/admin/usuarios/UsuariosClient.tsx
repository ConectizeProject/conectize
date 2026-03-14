'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

type UserRow = {
  id: string
  email: string | null
  full_name?: string | null
  cpf?: string | null
  role: string | null
  created_at: string
}

function filterByEmail (users: UserRow[], emailFilter: string): UserRow[] {
  if (!emailFilter.trim()) return users
  const lower = emailFilter.trim().toLowerCase()
  return users.filter((u) => (u.email ?? '').toLowerCase().includes(lower))
}

function roleLabel (role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  return 'Usuário'
}

function roleVariant (role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'admin') return 'default'
  if (role === 'staff') return 'secondary'
  return 'outline'
}

function UserCard ({
  u,
  currentUserId,
  onEdit,
}: {
  u: UserRow
  currentUserId: string
  onEdit: (user: UserRow) => void
}) {
  const normalizedRole = u.role === 'customer' ? 'user' : u.role || 'user'
  const displayName = (u.full_name ?? '').trim() || u.email || u.id.slice(0, 8)
  const isYou = u.id === currentUserId

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="font-medium truncate" title={u.email ?? u.id}>
              {displayName}
            </p>
            {u.email && u.email !== displayName && (
              <p className="text-sm text-muted-foreground truncate" title={u.email}>
                {u.email}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={roleVariant(normalizedRole)}>
              {roleLabel(normalizedRole)}
            </Badge>
            {isYou && (
              <span className="text-xs text-muted-foreground">Você</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onEdit(u)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const DEBOUNCE_MS = 400

type Props = {
  initialAdmins: UserRow[]
  initialStaff: UserRow[]
  currentUserId: string
  updateRoleAction: (formData: FormData) => void
  initialEmailFilter?: string
}

export function UsuariosClient ({
  initialAdmins,
  initialStaff,
  currentUserId,
  updateRoleAction,
  initialEmailFilter = '',
}: Props) {
  const router = useRouter()
  const pathname = usePathname() || '/portal/admin/usuarios'
  const [emailFilter, setEmailFilter] = useState(initialEmailFilter)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstMount = useRef(true)
  const [editUser, setEditUser] = useState<UserRow | null>(null)

  useEffect(() => {
    setEmailFilter(initialEmailFilter)
  }, [initialEmailFilter])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      const current = typeof window !== 'undefined' ? window.location.search : ''
      const params = new URLSearchParams(current)
      if (emailFilter.trim()) {
        params.set('email', emailFilter.trim())
      } else {
        params.delete('email')
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [emailFilter, pathname, router])

  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [adminsOpen, setAdminsOpen] = useState(true)
  const [staffOpen, setStaffOpen] = useState(true)
  const [usersOpen, setUsersOpen] = useState(false)

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

  const normalizedEditRole = editUser
    ? (editUser.role === 'customer' ? 'user' : editUser.role || 'user')
    : 'user'

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
          <CollapsibleContent className="pt-3">
            {filteredAdmins.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAdmins.map((u) => (
                  <UserCard
                    key={u.id}
                    u={u}
                    currentUserId={currentUserId}
                    onEdit={setEditUser}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Nenhum admin encontrado.</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={staffOpen} onOpenChange={setStaffOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-medium hover:underline">
            {staffOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Staff ({filteredStaff.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {filteredStaff.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStaff.map((u) => (
                  <UserCard
                    key={u.id}
                    u={u}
                    currentUserId={currentUserId}
                    onEdit={setEditUser}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Nenhum staff encontrado.</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={usersOpen} onOpenChange={handleUsersOpenChange}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-medium hover:underline">
            {usersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Usuários ({usersLoaded ? filteredUsers.length : '…'})
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {usersLoading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando usuários...</span>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredUsers.map((u) => (
                  <UserCard
                    key={u.id}
                    u={u}
                    currentUserId={currentUserId}
                    onEdit={setEditUser}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                {usersLoaded ? 'Nenhum usuário encontrado.' : 'Expanda para carregar.'}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          {editUser && (
            <form action={updateRoleAction}>
              <input type="hidden" name="userId" value={editUser.id} />
              <DialogHeader>
                <DialogTitle>Editar usuário</DialogTitle>
                <DialogDescription>
                  Atualize os dados básicos e o nível de acesso.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-full-name">Nome</Label>
                  <Input
                    id="edit-full-name"
                    name="fullName"
                    defaultValue={editUser.full_name || ''}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cpf">CPF</Label>
                  <Input
                    id="edit-cpf"
                    name="cpf"
                    defaultValue={editUser.cpf || ''}
                    placeholder="Somente números"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Nível de acesso</Label>
                  <select
                    id="edit-role"
                    name="role"
                    defaultValue={normalizedEditRole}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="user">Usuário</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
