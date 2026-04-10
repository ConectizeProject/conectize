export default function VendasAparelhosLoading () {
  return (
    <div className="space-y-4 p-1">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-24 w-full max-w-xl animate-pulse rounded-md bg-muted" />
      <p className="text-sm text-muted-foreground">
        Carregando relatório de vendas de aparelhos…
      </p>
      <p className="text-xs text-muted-foreground">
        Se esta mensagem some mas a página não termina, veja o terminal do Next: logs
        {' '}
        <code className="rounded bg-muted px-1">[vendas-aparelhos]</code>
        {' '}
        indicam em que etapa o servidor parou.
      </p>
    </div>
  )
}
