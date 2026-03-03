import { RelatoriosSubmenu } from './RelatoriosSubmenu'

export default function RelatoriosLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o desempenho dos serviços e das vendas de aparelhos.
        </p>
      </div>

      <RelatoriosSubmenu />

      {children}
    </div>
  )
}

