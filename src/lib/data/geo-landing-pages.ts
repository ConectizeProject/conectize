import type { FaqItem } from './business'

export type GeoLandingPage = {
  slug: string
  title: string
  description: string
  keywords: string
  eyebrow: string
  h1: string
  intro: string
  entitySummary: string
  serviceType: string
  whatsappMessage: string
  serviceLinks: Array<{
    label: string
    href: string
  }>
  sections: Array<{
    title: string
    body: string
  }>
  faq: FaqItem[]
}

export const geoLandingPages: GeoLandingPage[] = [
  {
    slug: 'assistencia-tecnica-celular-bh',
    title: 'Assistência Técnica de Celular em BH | Conectize',
    description: 'Assistência técnica de celular em Belo Horizonte para Android e Apple, com troca de tela, bateria, placa, câmera, conector, coleta em domicílio e garantia.',
    keywords: 'assistência técnica celular bh, conserto celular belo horizonte, assistência técnica de celular em belo horizonte, reparo celular bh, coleta celular bh',
    eyebrow: 'Assistência técnica em BH',
    h1: 'Assistência técnica de celular em Belo Horizonte',
    intro: 'A Conectize atende conserto de celulares Android e produtos Apple em Belo Horizonte, com diagnóstico, orçamento por WhatsApp, coleta em domicílio e garantia de 6 meses nos serviços realizados.',
    entitySummary: 'A Conectize é uma assistência técnica localizada na R. Padre Rolim, 620, Santa Efigênia, Belo Horizonte. A empresa realiza reparos em celulares, iPhone, iPad, MacBook e Apple Watch, incluindo troca de tela, bateria, vidro, placa, conector, câmera, áudio e danos por líquido.',
    serviceType: 'Assistência técnica de celular',
    whatsappMessage: 'Olá! Gostaria de um orçamento para assistência técnica de celular em Belo Horizonte.',
    serviceLinks: [
      { label: 'Troca de tela', href: '/troca-de-tela-celular-bh' },
      { label: 'Troca de bateria', href: '/servicos?servico=troca-de-bateria' },
      { label: 'Reparo de placa', href: '/servicos?servico=reparo-de-placa' },
      { label: 'Coleta em domicílio', href: '/coleta' }
    ],
    sections: [
      {
        title: 'O que a assistência cobre',
        body: 'Atendemos problemas de tela quebrada, vidro trincado, bateria descarregando rápido, aparelho que não liga, conector com mau contato, câmera falhando, áudio baixo, danos por líquido e correções de software.'
      },
      {
        title: 'Como funciona o atendimento',
        body: 'O cliente informa o modelo e o defeito pelo WhatsApp, recebe orientação inicial e pode combinar atendimento presencial ou coleta em domicílio em Belo Horizonte. Após diagnóstico, o orçamento é confirmado antes do reparo.'
      },
      {
        title: 'Localização e cobertura',
        body: 'A loja fica em Santa Efigênia e atende clientes de Belo Horizonte, incluindo Centro, Savassi, Funcionários, Lourdes, Floresta, Barro Preto, Santo Antônio, Carmo e Serra.'
      }
    ],
    faq: [
      {
        q: 'A Conectize conserta celular em Belo Horizonte?',
        a: 'Sim. A Conectize realiza assistência técnica de celulares Android e produtos Apple em Belo Horizonte, com atendimento presencial e coleta em domicílio.'
      },
      {
        q: 'Quais serviços de celular são atendidos?',
        a: 'Troca de tela, troca de vidro, troca de bateria, reparo de placa, conector, câmera, áudio, danos por líquido e correções de software.'
      },
      {
        q: 'A assistência oferece garantia?',
        a: 'Sim. Os serviços realizados têm garantia de 6 meses, conforme o tipo de reparo e peça instalada.'
      }
    ]
  },
  {
    slug: 'assistencia-apple-bh',
    title: 'Assistência Apple em BH | iPhone, iPad e MacBook',
    description: 'Assistência Apple em Belo Horizonte para iPhone, iPad, MacBook e Apple Watch. Troca de tela, vidro, bateria, câmera, conector e coleta em domicílio.',
    keywords: 'assistência apple bh, conserto iphone belo horizonte, assistência iphone bh, conserto macbook bh, troca tela iphone bh',
    eyebrow: 'Especialistas Apple',
    h1: 'Assistência Apple em Belo Horizonte',
    intro: 'A Conectize atende produtos Apple em Belo Horizonte, incluindo iPhone, iPad, MacBook e Apple Watch, com diagnóstico técnico, peças de qualidade, coleta em domicílio e garantia.',
    entitySummary: 'A Conectize é uma assistência técnica Apple em BH para reparos em iPhone, iPad, MacBook e Apple Watch. O atendimento cobre tela, vidro, bateria, câmera, conector, áudio, software e danos por líquido.',
    serviceType: 'Assistência técnica Apple',
    whatsappMessage: 'Olá! Gostaria de um orçamento para assistência Apple em Belo Horizonte.',
    serviceLinks: [
      { label: 'Conserto de iPhone', href: '/conserto-iphone-bh' },
      { label: 'Troca de tela do iPhone', href: '/servicos/troca-de-tela-apple-iphone' },
      { label: 'Troca de bateria do iPhone', href: '/servicos/troca-de-bateria-apple-iphone' },
      { label: 'Coleta em domicílio', href: '/coleta' }
    ],
    sections: [
      {
        title: 'Aparelhos Apple atendidos',
        body: 'Atendemos iPhone, iPad, MacBook e Apple Watch. O diagnóstico considera modelo, sintomas, histórico de queda ou contato com líquido e recursos específicos do ecossistema Apple.'
      },
      {
        title: 'Serviços Apple mais procurados',
        body: 'Os reparos mais comuns incluem troca de tela, troca de vidro da tela, troca de vidro/tampa traseira, bateria, conector de carga, câmera, reparo de placa e correções de software.'
      },
      {
        title: 'Atendimento em BH',
        body: 'O orçamento pode ser solicitado por WhatsApp. A Conectize atende presencialmente em Santa Efigênia e oferece coleta e entrega em domicílio para Belo Horizonte.'
      }
    ],
    faq: [
      {
        q: 'A Conectize atende iPhone em Belo Horizonte?',
        a: 'Sim. A Conectize realiza conserto de iPhone em Belo Horizonte, incluindo tela, vidro, bateria, câmera, conector, placa e software.'
      },
      {
        q: 'Também atendem iPad, MacBook e Apple Watch?',
        a: 'Sim. A assistência atende iPad, MacBook e Apple Watch, conforme disponibilidade de peças e avaliação técnica do modelo.'
      },
      {
        q: 'Posso solicitar coleta para produto Apple?',
        a: 'Sim. A coleta em domicílio está disponível em Belo Horizonte e pode ser combinada pelo WhatsApp.'
      }
    ]
  },
  {
    slug: 'conserto-iphone-bh',
    title: 'Conserto de iPhone em BH | Conectize',
    description: 'Conserto de iPhone em Belo Horizonte com troca de tela, vidro, bateria, tampa traseira, câmera, conector, placa, coleta em domicílio e garantia.',
    keywords: 'conserto iphone bh, conserto de iphone belo horizonte, assistência iphone bh, troca tela iphone bh, troca bateria iphone bh',
    eyebrow: 'iPhone em Belo Horizonte',
    h1: 'Conserto de iPhone em Belo Horizonte',
    intro: 'A Conectize realiza conserto de iPhone em BH com diagnóstico técnico, orçamento por WhatsApp, coleta em domicílio e garantia de 6 meses nos serviços realizados.',
    entitySummary: 'Para iPhone, a Conectize atende troca de tela, vidro da tela, vidro/tampa traseira, bateria, conector de carga, câmera, áudio, reparo de placa, danos por líquido e software.',
    serviceType: 'Conserto de iPhone',
    whatsappMessage: 'Olá! Gostaria de um orçamento para conserto de iPhone em Belo Horizonte.',
    serviceLinks: [
      { label: 'Troca de tela do iPhone', href: '/servicos/troca-de-tela-apple-iphone' },
      { label: 'Troca de vidro do iPhone', href: '/servicos/troca-de-vidro-da-tela-apple-iphone' },
      { label: 'Troca de bateria do iPhone', href: '/servicos/troca-de-bateria-apple-iphone' },
      { label: 'Troca de tampa traseira do iPhone', href: '/servicos/troca-de-vidro-tampa-traseira-apple-iphone' }
    ],
    sections: [
      {
        title: 'Sintomas comuns no iPhone',
        body: 'Tela quebrada, toque falhando, vidro traseiro trincado, bateria descarregando rápido, câmera tremendo, iPhone que não carrega, aparelho que molhou ou não liga são sintomas avaliados no diagnóstico.'
      },
      {
        title: 'Processo de orçamento',
        body: 'O cliente informa o modelo do iPhone e o defeito pelo WhatsApp. A equipe orienta os próximos passos, confirma coleta ou entrega na loja e valida orçamento após diagnóstico quando necessário.'
      },
      {
        title: 'Garantia e testes',
        body: 'Após o reparo, são testadas funções relacionadas ao serviço, como toque, brilho, carga, câmera, áudio, botões e estabilidade. A garantia padrão é de 6 meses.'
      }
    ],
    faq: [
      {
        q: 'Vocês consertam iPhone com tela quebrada?',
        a: 'Sim. A Conectize faz troca de tela e troca de vidro da tela do iPhone, dependendo do estado do display e do toque.'
      },
      {
        q: 'Fazem troca de bateria de iPhone?',
        a: 'Sim. A troca de bateria é indicada para autonomia baixa, desligamento repentino, aquecimento ou bateria inchada.'
      },
      {
        q: 'Conserto de iPhone tem coleta em BH?',
        a: 'Sim. É possível combinar coleta e entrega em domicílio em Belo Horizonte pelo WhatsApp.'
      }
    ]
  },
  {
    slug: 'troca-de-tela-celular-bh',
    title: 'Troca de Tela de Celular em BH | Conectize',
    description: 'Troca de tela de celular em Belo Horizonte para iPhone, Samsung, Xiaomi, Motorola e LG, com diagnóstico, coleta em domicílio e garantia.',
    keywords: 'troca de tela celular bh, trocar tela celular belo horizonte, tela quebrada celular bh, troca tela iphone bh, troca tela samsung bh',
    eyebrow: 'Tela quebrada em BH',
    h1: 'Troca de tela de celular em Belo Horizonte',
    intro: 'A Conectize realiza troca de tela de celular em Belo Horizonte para iPhone e Android, com avaliação do display, toque, brilho, sensores, coleta em domicílio e garantia.',
    entitySummary: 'A troca de tela é indicada quando há display quebrado, manchas, linhas, tela preta com aparelho ligado, toque falhando ou brilho irregular. Em alguns casos, quando apenas o vidro externo quebrou, pode haver alternativa de troca de vidro.',
    serviceType: 'Troca de tela de celular',
    whatsappMessage: 'Olá! Gostaria de um orçamento para troca de tela de celular em Belo Horizonte.',
    serviceLinks: [
      { label: 'Troca de tela iPhone', href: '/servicos/troca-de-tela-apple-iphone' },
      { label: 'Troca de tela Samsung', href: '/servicos/troca-de-tela-samsung-smartphone' },
      { label: 'Troca de vidro da tela', href: '/servicos?servico=troca-de-vidro-da-tela' },
      { label: 'Coleta em domicílio', href: '/coleta' }
    ],
    sections: [
      {
        title: 'Quando precisa trocar a tela',
        body: 'A troca de tela costuma ser necessária quando o display apresenta manchas, linhas, tela apagada, toque fantasma, falha de toque ou vidro quebrado com dano no painel.'
      },
      {
        title: 'Marcas atendidas',
        body: 'A Conectize atende troca de tela para Apple, Samsung, Xiaomi, Motorola e LG, conforme modelo, disponibilidade de peça e diagnóstico do conjunto.'
      },
      {
        title: 'Diferença entre tela e vidro',
        body: 'Se o display e o toque estão perfeitos e apenas o vidro externo quebrou, a troca de vidro pode ser avaliada. Se há manchas, linhas ou toque falhando, geralmente é necessário trocar o conjunto da tela.'
      }
    ],
    faq: [
      {
        q: 'Quanto tempo demora troca de tela de celular?',
        a: 'O prazo varia por modelo e disponibilidade da peça. Em geral, serviços comuns podem ser concluídos em até 24-48h úteis.'
      },
      {
        q: 'Troca de tela tem garantia?',
        a: 'Sim. A troca de tela tem garantia de 6 meses para o serviço e peça instalada, conforme condições de uso.'
      },
      {
        q: 'Vocês trocam tela de Samsung e iPhone?',
        a: 'Sim. A Conectize atende troca de tela de iPhone, Samsung e outras marcas Android em Belo Horizonte.'
      }
    ]
  }
]

export function getGeoLandingPage(slug: string) {
  return geoLandingPages.find((page) => page.slug === slug)
}
