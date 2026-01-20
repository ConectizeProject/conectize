import Link from 'next/link'
import type { Model } from '@/lib/types/seo'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'

interface ModelCardProps {
  model: Model
  serviceSlug: string
  brandSlug: string
  deviceTypeSlug: string
}

export function ModelCard ({ model, serviceSlug, brandSlug, deviceTypeSlug: _deviceTypeSlug }: ModelCardProps) {
  return (
    <Link
      href={`/servicos/${buildServiceProductSlug({ serviceSlug, brandSlug, modelSlug: model.slug })}`}
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

