import { brands, services } from '@/lib/data/services'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'

export type ServiceHub = {
  href: string
  serviceSlug: string
  serviceName: string
  brandSlug: string
  brandName: string
  deviceTypeSlug: string
  deviceTypeName: string
  label: string
}

/**
 * Hubs canônicos /servicos/{servico}-{marca}-{dispositivo}.
 * São o elo de descoberta entre /servicos e as páginas de modelo.
 */
export function listServiceHubs (filters?: {
  brandSlug?: string
  serviceSlug?: string
}): ServiceHub[] {
  const hubs: ServiceHub[] = []

  for (const service of services) {
    if (filters?.serviceSlug && service.slug !== filters.serviceSlug) continue

    for (const brandSlug of service.brands) {
      if (filters?.brandSlug && brandSlug !== filters.brandSlug) continue

      const brand = brands[brandSlug]
      if (!brand) continue

      const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []

      for (const deviceType of Object.values(brand.deviceTypes)) {
        if (excludedTypes.includes(deviceType.slug)) continue

        hubs.push({
          href: `/servicos/${buildServiceProductSlug({
            serviceSlug: service.slug,
            brandSlug,
            modelSlug: deviceType.slug,
          })}`,
          serviceSlug: service.slug,
          serviceName: service.name,
          brandSlug,
          brandName: brand.displayName,
          deviceTypeSlug: deviceType.slug,
          deviceTypeName: deviceType.displayName,
          label: `${service.name} ${deviceType.displayName}`,
        })
      }
    }
  }

  return hubs
}
