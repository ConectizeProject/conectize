import type { Service, Brand, DeviceType } from '../types/seo'

export const services: Service[] = [
  {
    slug: 'troca-de-tela',
    name: 'Troca de Tela',
    description: 'Serviço especializado de troca de tela para celulares e tablets. Utilizamos telas de alta qualidade, 100% compatíveis, garantindo a melhor experiência visual e funcionalidade do seu dispositivo.',
    shortDescription: 'Troca de tela para celulares, watches, notebooks e tablets',
    keywords: ['troca de tela', 'tela quebrada', 'reparo de tela', 'substituição de tela'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg']
  },
  {
    slug: 'troca-de-vidro-da-tela',
    name: 'Troca de Vidro da Tela',
    description: 'Serviço especializado de troca de vidro da tela para celulares e tablets. Utilizamos vidros de alta qualidade, garantindo a melhor experiência visual e funcionalidade do seu dispositivo.',
    shortDescription: 'Troca de vidro para celulares, watches e tablets',
    keywords: ['troca de vidro', 'vidro quebrado', 'reparo de vidro', 'substituição de vidro', 'troca de vidro da tela'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg']
  },
  {
    slug: 'troca-de-bateria',
    name: 'Troca de Bateria',
    description: 'Substituição de bateria com peças de alta qualidade. Restauramos a autonomia do seu dispositivo, garantindo maior durabilidade e segurança.',
    shortDescription: 'Troca de bateria com peças de alta qualidade',
    keywords: ['troca de bateria', 'bateria descarregando', 'bateria inchada', 'autonomia'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg']
  },
  {
    slug: 'reparo-de-placa',
    name: 'Reparo de Placa',
    description: 'Diagnóstico e reparo de placas-mãe (PCB) com equipamentos profissionais. Resolvemos problemas de não liga, curto-circuito, componentes danificados e muito mais.',
    shortDescription: 'Reparo profissional placas e componentes eletrônicos',
    keywords: ['reparo de placa', 'placa queimada', 'não liga', 'curto-circuito'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg'],
    excludedDeviceTypes: {
      apple: ['watch']
    }
  },
  {
    slug: 'troca-de-conector',
    name: 'Troca de Conector de Carga',
    description: 'Substituição do conector de carregamento (porta USB-C ou Lightning) com solda profissional. Restauramos a capacidade de carregamento e transferência de dados.',
    shortDescription: 'Troca e reparo de conectores de carregamento',
    keywords: ['conector de carregamento', 'porta USB', 'não carrega', 'Lightning'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg'],
    excludedDeviceTypes: {
      apple: ['watch']
    }
  },
  {
    slug: 'troca-de-camera',
    name: 'Reparo de Câmera',
    description: 'Reparo e substituição de câmera frontal ou traseira com módulos de alta qualidade. Garantimos qualidade de imagem e todas as funcionalidades do sistema de câmeras.',
    shortDescription: 'Reparo de câmera frontal e traseira',
    keywords: ['reparo de câmera', 'câmera quebrada', 'câmera embaçada', 'flash', 'troca de câmera'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg'],
    excludedDeviceTypes: {
      apple: ['watch']
    }
  },
  {
    slug: 'correcoes-de-software',
    name: 'Correções de Software',
    description: 'Serviços de correção e otimização de software incluindo remoção de vírus, reset de fábrica, atualização de sistema, recuperação de dados e muito mais.',
    shortDescription: 'Correções e otimização de software e remoção de vírus',
    keywords: ['remoção de vírus', 'reset de fábrica', 'atualização de sistema', 'recuperação de dados', 'formatação'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg'],
    excludedDeviceTypes: {
      apple: ['watch']
    }
  },
  {
    slug: 'reparo-de-audio',
    name: 'Reparo de Áudio',
    description: 'Correção de problemas de áudio incluindo alto-falante, microfone, fone de ouvido e sistema de som. Restauramos a qualidade de áudio do seu dispositivo.',
    shortDescription: 'Reparo de sistema de microfones e auto falantes',
    keywords: ['alto-falante', 'microfone', 'fone de ouvido', 'áudio'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg'],
    excludedDeviceTypes: {
      apple: ['watch']
    }
  },
  {
    slug: 'reparo-de-agua',
    name: 'Reparo de Danos por Água',
    description: 'Limpeza e reparo de aparelhos que sofreram contato com líquidos. Realizamos limpeza ultrassônica, substituição de componentes danificados e recuperação de dados quando possível.',
    shortDescription: 'Reparo de danos por água',
    keywords: ['molhou', 'danos por água', 'limpeza ultrassônica', 'recuperação'],
    brands: ['apple', 'samsung', 'xiaomi', 'motorola', 'lg']
  }
]

export const brands: Record<string, Brand> = {
  apple: {
    slug: 'apple',
    name: 'Apple',
    displayName: 'Apple',
    deviceTypes: {
      iphone: {
        slug: 'iphone',
        name: 'iPhone',
        displayName: 'iPhone',
        models: [
          'iphone-17-pro-max',
          'iphone-17-pro',
          'iphone-17',
          'iphone-16-pro-max',
          'iphone-16-pro',
          'iphone-16',
          'iphone-15-pro-max',
          'iphone-15-pro',
          'iphone-15-plus',
          'iphone-15',
          'iphone-14-pro-max',
          'iphone-14-pro',
          'iphone-14-plus',
          'iphone-14',
          'iphone-13-pro-max',
          'iphone-13-pro',
          'iphone-13-mini',
          'iphone-13',
          'iphone-12-pro-max',
          'iphone-12-pro',
          'iphone-12-mini',
          'iphone-12',
          'iphone-11-pro-max',
          'iphone-11-pro',
          'iphone-11',
          'iphone-xs-max',
          'iphone-xs',
          'iphone-xr',
          'iphone-x',
          'iphone-8-plus',
          'iphone-8',
          'iphone-7-plus',
          'iphone-7',
          'iphone-6s-plus',
          'iphone-6s',
          'iphone-6-plus',
          'iphone-6',
          'iphone-se-2022',
          'iphone-se-2020',
          'iphone-se',
          'iphone-5s',
          'iphone-5c',
          'iphone-5'
        ]
      },
      ipad: {
        slug: 'ipad',
        name: 'iPad',
        displayName: 'iPad',
        models: [
          'ipad-pro-12-9',
          'ipad-pro-11',
          'ipad-air',
          'ipad'
        ]
      },
      macbook: {
        slug: 'macbook',
        name: 'MacBook',
        displayName: 'MacBook',
        models: [
          'macbook-pro',
          'macbook-air'
        ]
      },
      watch: {
        slug: 'watch',
        name: 'Apple Watch',
        displayName: 'Apple Watch',
        models: [
          'apple-watch-series-9',
          'apple-watch-series-8',
          'apple-watch-ultra',
          'apple-watch-se'
        ]
      }
    }
  },
  samsung: {
    slug: 'samsung',
    name: 'Samsung',
    displayName: 'Samsung',
    deviceTypes: {
      smartphone: {
        slug: 'smartphone',
        name: 'Smartphone',
        displayName: 'Smartphone',
        models: [
          'galaxy-s24-ultra',
          'galaxy-s24-plus',
          'galaxy-s24',
          'galaxy-s23-ultra',
          'galaxy-s23-plus',
          'galaxy-s23',
          'galaxy-s22-ultra',
          'galaxy-s22-plus',
          'galaxy-s22',
          'galaxy-note-20-ultra',
          'galaxy-a54',
          'galaxy-a34',
          'galaxy-a14'
        ]
      },
      tablet: {
        slug: 'tablet',
        name: 'Tablet',
        displayName: 'Tablet',
        models: [
          'galaxy-tab-s9',
          'galaxy-tab-s8',
          'galaxy-tab-a8'
        ]
      }
    }
  },
  xiaomi: {
    slug: 'xiaomi',
    name: 'Xiaomi',
    displayName: 'Xiaomi',
    deviceTypes: {
      smartphone: {
        slug: 'smartphone',
        name: 'Smartphone',
        displayName: 'Smartphone',
        models: [
          'xiaomi-14-pro',
          'xiaomi-14',
          'xiaomi-13-pro',
          'xiaomi-13',
          'redmi-note-13-pro',
          'redmi-note-13',
          'redmi-12',
          'poco-x6-pro',
          'poco-f5'
        ]
      }
    }
  },
  motorola: {
    slug: 'motorola',
    name: 'Motorola',
    displayName: 'Motorola',
    deviceTypes: {
      smartphone: {
        slug: 'smartphone',
        name: 'Smartphone',
        displayName: 'Smartphone',
        models: [
          'moto-edge-40-pro',
          'moto-edge-40',
          'moto-g84',
          'moto-g73',
          'moto-g54',
          'moto-e40'
        ]
      }
    }
  },
  lg: {
    slug: 'lg',
    name: 'LG',
    displayName: 'LG',
    deviceTypes: {
      smartphone: {
        slug: 'smartphone',
        name: 'Smartphone',
        displayName: 'Smartphone',
        models: [
          'lg-g8',
          'lg-v60',
          'lg-k62',
          'lg-k52'
        ]
      }
    }
  }
}

export function getServiceBySlug (slug: string): Service | undefined {
  return services.find(s => s.slug === slug)
}

export function getBrandBySlug (slug: string): Brand | undefined {
  return brands[slug]
}

export function getDeviceTypeBySlug (brandSlug: string, deviceTypeSlug: string): DeviceType | undefined {
  const brand = brands[brandSlug]
  if (!brand) return undefined
  
  return brand.deviceTypes[deviceTypeSlug]
}

export function getModelBySlug (brandSlug: string, deviceTypeSlug: string, modelSlug: string): { brand: Brand; deviceType: DeviceType; modelSlug: string } | undefined {
  const deviceType = getDeviceTypeBySlug(brandSlug, deviceTypeSlug)
  if (!deviceType) return undefined
  
  const modelExists = deviceType.models.includes(modelSlug)
  if (!modelExists) return undefined
  
  const brand = brands[brandSlug]
  if (!brand) return undefined
  
  return { brand, deviceType, modelSlug }
}

export function getModelBySlugAnyType (brandSlug: string, modelSlug: string): { brand: Brand; deviceType: DeviceType; modelSlug: string } | undefined {
  const brand = getBrandBySlug(brandSlug)
  if (!brand) return undefined

  for (const deviceType of Object.values(brand.deviceTypes)) {
    if (deviceType.models.includes(modelSlug)) return { brand, deviceType, modelSlug }
  }

  return undefined
}
