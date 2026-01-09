import Link from 'next/link'
import type { Service } from '@/lib/types/seo'

interface ServiceCardProps {
  service: Service
}

export function ServiceCard ({ service }: ServiceCardProps) {
  return (
    <Link
      href={`/servicos/${service.slug}`}
      className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50"
    >
      <h3 className="text-xl font-bold text-foreground mb-2">
        {service.name}
      </h3>
      <p className="text-muted-foreground text-sm mb-4">
        {service.shortDescription}
      </p>
      <span className="text-primary text-sm font-medium hover:underline">
        Ver detalhes →
      </span>
    </Link>
  )
}


