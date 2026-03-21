import { Card, CardContent } from '@/components/ui/card'

export default function ProdutosLoading () {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-md bg-muted" />
          <div className="h-4 w-96 max-w-full rounded-md bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-md bg-muted" />
          <div className="h-9 w-40 rounded-md bg-muted" />
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="h-10 w-full max-w-md rounded-md bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 w-full rounded-md bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
