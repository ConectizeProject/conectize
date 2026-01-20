import Link from 'next/link'
import type { DeviceType } from '@/lib/types/seo'

interface DeviceTypeCardProps {
  deviceType: DeviceType
  serviceSlug: string
  brandSlug: string
}

export function DeviceTypeCard ({ deviceType, serviceSlug, brandSlug }: DeviceTypeCardProps) {
  return (
    <Link
      href={`/servicos/${brandSlug}/${serviceSlug}`}
      className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50 text-center"
    >
      <h3 className="text-xl font-bold text-foreground mb-2">
        {deviceType.displayName}
      </h3>
      <p className="text-muted-foreground text-sm">
        {deviceType.models.length} {deviceType.models.length === 1 ? 'modelo disponível' : 'modelos disponíveis'}
      </p>
    </Link>
  )
}


