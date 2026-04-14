import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'gestao' as const, label: 'Gestão de produtos', href: '/portal/produtos?tab=gestao' },
  { id: 'precos' as const, label: 'Tabela de preços', href: '/portal/produtos?tab=precos' },
  { id: 'tags' as const, label: 'Tags de precificação', href: '/portal/produtos?tab=tags' },
]

export type ProdutosStaffTabId = (typeof TABS)[number]['id']

export function ProdutosStaffTabsNav ({ activeTab }: { activeTab: ProdutosStaffTabId }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 border-b pb-2">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === t.id
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
