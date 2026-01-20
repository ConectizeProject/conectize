'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ServicesFilters = dynamic(
  () => import('./ServicesFilters').then(m => m.ServicesFilters),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="h-10 rounded-md bg-muted/40" />
          <div className="h-10 rounded-md bg-muted/40" />
          <div className="h-10 rounded-md bg-muted/40" />
          <div className="h-10 rounded-md bg-muted/40" />
          <div className="h-10 rounded-md bg-muted/40" />
        </CardContent>
      </Card>
    )
  }
)

export function ServicesFiltersLazy () {
  return <ServicesFilters />
}

