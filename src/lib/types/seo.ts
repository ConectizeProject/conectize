export interface Service {
  slug: string
  name: string
  description: string
  shortDescription: string
  keywords: string[]
  brands: string[]
  excludedDeviceTypes?: Record<string, string[]> // marca -> tipos de dispositivo excluídos
}

export interface Brand {
  slug: string
  name: string
  displayName: string
  deviceTypes: Record<string, DeviceType>
}

export interface DeviceType {
  slug: string
  name: string
  displayName: string
  models: string[]
}

export interface Model {
  slug: string
  name: string
  displayName: string
  brand: string
  deviceType: string
  service: string
  year?: number
}

export interface SEOData {
  service: Service
  brand?: Brand
  deviceType?: DeviceType
  model?: Model
}

export interface BreadcrumbItem {
  label: string
  href: string
}

