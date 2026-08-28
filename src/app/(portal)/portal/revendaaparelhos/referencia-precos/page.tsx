import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { fetchSeminovosDevices } from '@/lib/seminovos/fetch-seminovos-data'
import { aggregateResaleReferencePricing } from '@/lib/seminovos/aggregate-resale-reference-pricing'
import { maskedFromCents } from '@/lib/utils/money'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function RevendaReferenciaPrecosPage () {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (
    normalizedRole !== 'staff' &&
    normalizedRole !== 'admin' &&
    normalizedRole !== 'platform_admin'
  ) redirect('/portal')

  const supabase = await createSupabaseServerClient()
  const devices = await fetchSeminovosDevices(supabase, {
    q: '',
    condition: '',
    storageGb: '',
    color: '',
    purchaseDateFrom: '',
    purchaseDateTo: '',
    stockType: 'all',
    includeSold: true,
  })
  const rows = aggregateResaleReferencePricing(devices)
  const groups = rows.reduce<Array<{ model: string; items: typeof rows }>>((acc, row) => {
    const model = (row.deviceName || '').trim() || '—'
    const last = acc[acc.length - 1]
    if (!last || last.model !== model) {
      acc.push({ model, items: [row] })
      return acc
    }
    last.items.push(row)
    return acc
  }, [])

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead>GB</TableHead>
            <TableHead className="text-right">Compra</TableHead>
            <TableHead className="text-right">Atacado</TableHead>
            <TableHead className="text-right">Varejo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Nenhum dado com valor de compra cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            groups.flatMap((group) => ([
              (
                <TableRow key={`group-${group.model}`}>
                  <TableCell colSpan={5} className="bg-muted/40 font-semibold">
                    {group.model}
                  </TableCell>
                </TableRow>
              ),
              ...group.items.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.condition || '—'}</TableCell>
                  <TableCell>{r.storageGb || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    R$ {maskedFromCents(r.minPurchaseCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.wholesaleValueCents != null && r.wholesaleValueCents > 0
                      ? `R$ ${maskedFromCents(r.wholesaleValueCents)}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.saleValueCents != null && r.saleValueCents > 0
                      ? `R$ ${maskedFromCents(r.saleValueCents)}`
                      : '—'}
                  </TableCell>
                </TableRow>
              )),
            ]))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
