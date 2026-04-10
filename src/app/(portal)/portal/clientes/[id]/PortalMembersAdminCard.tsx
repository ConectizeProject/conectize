import { addCustomerPortalMemberAction, removeCustomerPortalMemberAction } from './portal-member-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type PortalMemberRow = {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  role: string | null
  created_at: string
}

type Props = {
  customerId: string
  members: PortalMemberRow[]
}

export function PortalMembersAdminCard ({ customerId, members }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal lojista (B2B)</CardTitle>
        <CardDescription>
          Usuários com perfil lojista vinculados a este cadastro podem ver OS, varejo e financeiro da
          loja. O e-mail deve ser de uma conta já existente com papel “lojista”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={addCustomerPortalMemberAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="customerId" value={customerId} />
          <div className="space-y-2 flex-1 max-w-md">
            <Label htmlFor="portal-member-email">E-mail do usuário lojista</Label>
            <Input
              id="portal-member-email"
              name="userEmail"
              type="email"
              autoComplete="off"
              placeholder="nome@empresa.com.br"
              required
            />
          </div>
          <Button type="submit">Vincular</Button>
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
