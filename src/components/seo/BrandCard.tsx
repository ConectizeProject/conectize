import Link from 'next/link'
import type { Brand } from '@/lib/types/seo'

interface BrandCardProps {
  brand: Brand
  serviceSlug: string
}

export function BrandCard ({ brand, serviceSlug }: BrandCardProps) {
  const totalModels = Object.values(brand.deviceTypes).reduce(
    (total, deviceType) => total + deviceType.models.length,
    0
  )
  const totalDeviceTypes = Object.keys(brand.deviceTypes).length
  const href = `/servicos/${brand.slug}/${serviceSlug}`
  
  return (
    <Link
      href={href}
      className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50 text-center"
    >
      <h3 className="text-xl font-bold text-foreground mb-2">
        {brand.displayName}
      </h3>
      <p className="text-muted-foreground text-sm">
        {`${totalDeviceTypes} tipos de equipamento • ${totalModels} ${totalModels === 1 ? 'modelo' : 'modelos'}`}
      </p>
    </Link>
  )
}

