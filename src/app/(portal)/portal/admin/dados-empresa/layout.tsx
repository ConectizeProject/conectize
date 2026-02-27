import { DadosEmpresaSubmenu } from './DadosEmpresaSubmenu'

export default function DadosEmpresaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações gerais</h1>
        <p className="text-sm text-muted-foreground">
          Configurações gerais, aparelhos e formas de pagamento.
        </p>
      </div>

      <DadosEmpresaSubmenu />

      {children}
    </div>
  )
}
