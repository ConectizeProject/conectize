import { addCustomerPortalMemberAction, removeCustomerPortalMemberAction } from './portal-member-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export type PortalMemberRow = {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  role: string | null
  created_at: string
}

export type SelectableRetailer = {
  id: string
  email: string | null
  full_name: string | null
}

type Props = {
  customerId: string
  members: PortalMemberRow[]
  selectableRetailers: SelectableRetailer[]
}

function formatRetailerLabel (u: SelectableRetailer): string {
  const name = (u.full_name || '').trim()
  const mail = (u.email || '').trim()
  if (name && mail) return `${name} (${mail})`
  if (mail) return mail
  return u.id.slice(0, 8)
}

export function PortalMembersAdminCard ({
  customerId,
  members,
  selectableRetailers,
}: Props) {
  const hasOptions = selectableRetailers.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal lojista (B2B)</CardTitle>
        <CardDescription>
          Escolha um usuário com papel lojista para vincular a esta loja. Só aparecem contas ainda sem
          vínculo ou já listadas abaixo após vincular.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={addCustomerPortalMemberAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="customerId" value={customerId} />
          <div className="space-y-2 flex-1 max-w-lg">
            <Label htmlFor="portal-member-user">Usuário lojista</Label>
            <select
              id="portal-member-user"
              name="userId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
              disabled={!hasOptions}
              defaultValue=""
            >
              <option value="" disabled>
                {hasOptions ? 'Selecione um usuário…' : 'Nenhum lojista disponível para vincular'}
              </option>
              {selectableRetailers.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatRetailerLabel(u)}
                </option>
              ))}
            </select>
            {!hasOptions ? (
              <p className="text-xs text-muted-foreground">
                Crie usuários com papel Lojista em Admin → Usuários ou remova o vínculo de outra loja.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={!hasOptions}>
            Vincular
          </Button>
        </form>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lojista vinculado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{m.email || m.user_id}</span>
                  {m.full_name ? (
                    <span className="text-muted-foreground"> — {m.full_name}</span>
                  ) : null}
                </div>
                <form action={removeCustomerPortalMemberAction}>
                  <input type="hidden" name="memberRowId" value={m.id} />
                  <input type="hidden" name="customerId" value={customerId} />
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    Remover
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
