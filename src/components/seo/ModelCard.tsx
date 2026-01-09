import Link from 'next/link'
import type { Model } from '@/lib/types/seo'

interface ModelCardProps {
  model: Model
  serviceSlug: string
  brandSlug: string
  deviceTypeSlug: string
}

export function ModelCard ({ model, serviceSlug, brandSlug, deviceTypeSlug }: ModelCardProps) {
  return (
    <Link
      href={`/servicos/${serviceSlug}/${brandSlug}/${deviceTypeSlug}/${model.slug}`}
      className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50"
    >
      <h3 className="text-lg font-bold text-foreground mb-2">
        {model.displayName || model.name}
      </h3>
      {model.year && (
        <p className="text-muted-foreground text-sm mb-2">
          {model.year}
        </p>
      )}
      <span className="text-primary text-sm font-medium hover:underline">
        Ver orçamento →
      </span>
    </Link>
  )
}

