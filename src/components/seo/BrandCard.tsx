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
  const deviceTypes = Object.values(brand.deviceTypes)
  
  // Se há apenas um tipo de equipamento, redireciona direto para a lista de modelos
  const href = totalDeviceTypes === 1
    ? `/servicos/${serviceSlug}/${brand.slug}/${deviceTypes[0].slug}`
    : `/servicos/${serviceSlug}/${brand.slug}`
  
  return (
    <Link
      href={href}
      className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50 text-center"
    >
      <h3 className="text-xl font-bold text-foreground mb-2">
        {brand.displayName}
      </h3>
      <p className="text-muted-foreground text-sm">
        {totalDeviceTypes === 1 
          ? `${totalModels} ${totalModels === 1 ? 'modelo disponível' : 'modelos disponíveis'}`
          : `${totalDeviceTypes} tipos de equipamento • ${totalModels} ${totalModels === 1 ? 'modelo' : 'modelos'}`
        }
      </p>
    </Link>
  )
}

