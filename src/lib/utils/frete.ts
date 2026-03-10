// Coordenadas da Conectize (R. Padre Rolim, 620, Santa Efigênia, BH)
const CONECTIZE_LAT = -19.9276
const CONECTIZE_LNG = -43.9248

// CEP da Conectize
const CONECTIZE_CEP = '30130-094'

// Configuração da coleta (faixas e valores) para facilitar ajustes
export const COLETA_DISTANCE_MULTIPLIER = 1.8
export const COLETA_PRICE_TIERS: Array<{ maxKm: number | null; price: number }> = [
  { maxKm: 3, price: 0 },
  { maxKm: 5, price: 20 },
  { maxKm: 10, price: 30 },
  { maxKm: 15, price: 40 },
  { maxKm: 20, price: 50 },
  { maxKm: null, price: 60 }
]

export interface CepInfo {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface FreteResult {
  distancia: number // em km
  valor: number // em reais
  cepInfo: CepInfo | null
  erro?: string
}

/**
 * Calcula a distância entre duas coordenadas usando a fórmula de Haversine
 */
function calcularDistancia (lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Interface para resposta da BrasilAPI
 */
interface BrasilApiCepResponse {
  cep: string
  state: string
  city: string
  neighborhood?: string
  street?: string
  service?: string
}

/**
 * Interface para resposta da AwesomeAPI CEP (lat/lng por CEP)
 */
interface AwesomeApiCepResponse {
  cep: string
  lat: string
  lng: string
  city?: string
  state?: string
  address?: string
  district?: string
}

/**
 * Obtém coordenadas (lat/lng) a partir do CEP usando AwesomeAPI CEP
 * (mais confiável para CEPs no Brasil do que tentar geocodificar com Nominatim)
 */
async function obterCoordenadasPorCep (cep: string): Promise<{ lat: number; lng: number } | null> {
  const cepLimpo = cep.replace(/\D/g, '')

  if (cepLimpo.length !== 8) {
    return null
  }

  try {
    const response = await fetch(`https://cep.awesomeapi.com.br/json/${cepLimpo}`)

    if (!response.ok) {
      return null
    }

    const data: AwesomeApiCepResponse = await response.json()

    const lat = Number.parseFloat(data.lat)
    const lng = Number.parseFloat(data.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null
    }

    return { lat, lng }
  } catch (error) {
    console.error('Erro ao obter coordenadas na AwesomeAPI CEP:', error)
    return null
  }
}

/**
 * Obtém coordenadas de um endereço usando OpenStreetMap Nominatim
 * Usa logradouro, bairro e CEP para obter coordenadas mais precisas
 */
async function obterCoordenadas (
  cepInfo: CepInfo
): Promise<{ lat: number; lng: number } | null> {
  try {
    const cepLimpo = cepInfo.cep.replace(/\D/g, '')
    
    // Constrói query com mais informações para melhor precisão
    const queryParts = []
    if (cepInfo.logradouro) queryParts.push(cepInfo.logradouro)
    if (cepInfo.bairro) queryParts.push(cepInfo.bairro)
    queryParts.push(cepInfo.localidade)
    queryParts.push(cepInfo.uf)
    queryParts.push('Brasil')
    
    const query = queryParts.join(', ')

    const headers = {
      'User-Agent': 'Conectize/1.0 (contact@conectize.com.br)',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Referer': 'https://conectize.com.br'
    }

    const urls = [
      // 1) Busca estruturada por postalcode (melhor quando o CEP existe no OSM)
      `https://nominatim.openstreetmap.org/search?postalcode=${cepLimpo}&countrycodes=br&format=jsonv2&limit=5&addressdetails=1`,
      // 2) Query completa (logradouro+bairro+cidade+UF) sem travar no postalcode
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=br&format=jsonv2&limit=5&addressdetails=1`,
      // 3) Query simples (bairro+cidade+UF) sem travar no postalcode
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cepInfo.bairro}, ${cepInfo.localidade}, ${cepInfo.uf}, Brasil`)}&countrycodes=br&format=jsonv2&limit=5&addressdetails=1`
    ]

    for (const url of urls) {
      // Pequeno delay para reduzir chance de rate limiting quando houver mais de uma tentativa
      await new Promise(resolve => setTimeout(resolve, 250))

      const response = await fetch(url, { headers })

      if (!response.ok) {
        continue
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        continue
      }

      // Procura o resultado que melhor corresponde ao CEP (quando disponível)
      let melhorResultado = data[0]
      for (const item of data) {
        if (item?.address?.postcode) {
          const postcode = String(item.address.postcode).replace(/\D/g, '')
          if (postcode === cepLimpo) {
            melhorResultado = item
            break
          }
        }
      }

      if (melhorResultado?.lat && melhorResultado?.lon) {
        const lat = Number.parseFloat(melhorResultado.lat)
        const lng = Number.parseFloat(melhorResultado.lon)

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Erro ao obter coordenadas:', error)
    return null
  }
}

/**
 * Calcula o valor do frete baseado na distância
 */
function calcularValorFrete (distancia: number): number {
  for (const tier of COLETA_PRICE_TIERS) {
    if (tier.maxKm === null) {
      return tier.price
    }
    if (distancia <= tier.maxKm) {
      return tier.price
    }
  }

  return COLETA_PRICE_TIERS[COLETA_PRICE_TIERS.length - 1].price
}

/**
 * Calcula o frete baseado no CEP informado
 */
export async function calcularFrete (cep: string): Promise<FreteResult> {
  const cepLimpo = cep.replace(/\D/g, '')
  
  if (cepLimpo.length !== 8) {
    return {
      distancia: 0,
      valor: 0,
      cepInfo: null,
      erro: 'CEP não encontrado ou inválido'
    }
  }

  try {
    // Busca informações do CEP e coordenadas em uma única chamada à BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`)
    
    if (!response.ok) {
      return {
        distancia: 0,
        valor: 0,
        cepInfo: null,
        erro: 'CEP não encontrado ou inválido'
      }
    }
    
    const data: BrasilApiCepResponse = await response.json()
    
    // Converte o formato da BrasilAPI para o formato esperado
    const cepInfo: CepInfo = {
      cep: data.cep,
      logradouro: data.street || '',
      complemento: '',
      bairro: data.neighborhood || '',
      localidade: data.city,
      uf: data.state
    }

    // Valida se é Belo Horizonte
    if (cepInfo.localidade.toUpperCase() !== 'BELO HORIZONTE') {
      return {
        distancia: 0,
        valor: 0,
        cepInfo,
        erro: 'A coleta só é realizada em Belo Horizonte'
      }
    }

    // Obtém coordenadas usando Nominatim
    // Primeiro tenta lat/lng por CEP (AwesomeAPI). Se falhar, usa Nominatim como fallback.
    const coordenadas = (await obterCoordenadasPorCep(cepInfo.cep)) || (await obterCoordenadas(cepInfo))
    
    if (!coordenadas) {
      return {
        distancia: 0,
        valor: 0,
        cepInfo,
        erro: 'Não foi possível calcular a distância para este CEP'
      }
    }

    // Calcula a distância em linha reta
    const distanciaLinhaReta = calcularDistancia(
      CONECTIZE_LAT,
      CONECTIZE_LNG,
      coordenadas.lat,
      coordenadas.lng
    )

    // Multiplica por 2 para aproximar a distância real de rota (nas ruas)
    // Isso considera que a distância real é maior que a linha reta devido ao trajeto nas ruas
    const distancia = distanciaLinhaReta * COLETA_DISTANCE_MULTIPLIER

    // Calcula o valor do frete
    const valor = calcularValorFrete(distancia)

    return {
      distancia: Number(distancia.toFixed(1)), // Arredonda para 1 casa decimal
      valor,
      cepInfo
    }
  } catch (error) {
    console.error('Erro ao calcular frete:', error)
    return {
      distancia: 0,
      valor: 0,
      cepInfo: null,
      erro: 'Erro ao calcular o frete. Tente novamente.'
    }
  }
}

