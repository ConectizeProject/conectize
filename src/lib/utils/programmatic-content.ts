import type { Service, Brand, DeviceType, Model } from '@/lib/types/seo'

type FaqItem = { q: string; a: string }

export type ProgrammaticContent = {
    title: string
    description: string
    h1: string
    sections: {
        intro: string
        technical: string
        problems: string[]
        process: string
        faq: FaqItem[]
    }
}

type Input = {
    service: Service
    brand: Brand
    deviceType: DeviceType
    model?: Model
}

const city = 'Belo Horizonte'

function normalizeSpaces(value: string) {
    return value.replace(/\s+/g, ' ').trim()
}

function truncateWords(value: string, maxLength: number) {
    const text = normalizeSpaces(value)
    if (text.length <= maxLength) return text
    const cut = text.slice(0, maxLength)
    const lastSpace = cut.lastIndexOf(' ')
    if (lastSpace > 20) return cut.slice(0, lastSpace).trim()
    return cut.trim()
}

function ensureTitle(value: string) {
    const base = normalizeSpaces(value)
    if (base.length <= 60) return base
    return truncateWords(base, 60)
}

function ensureDescription(value: string) {
    const base = normalizeSpaces(value)
    if (base.length >= 120 && base.length <= 155) return base
    if (base.length > 155) return truncateWords(base, 155)

    // padding curto e específico (sem genéricos)
    const suffix = ' Atendemos em BH com retirada e devolução quando necessário.'
    return truncateWords(`${base}${suffix}`, 155)
}

function compactService(service: Service) {
    const map: Record<string, string> = {
        'troca-de-tela': 'Troca de tela',
        'troca-de-vidro-da-tela': 'Troca de vidro',
        'troca-de-vidro-tampa-traseira': 'Troca de vidro/tampa traseira',
        'troca-de-bateria': 'Troca de bateria',
        'reparo-de-placa': 'Reparo de placa',
        'troca-de-conector': 'Troca de conector',
        'troca-de-camera': 'Reparo de câmera',
        'correcoes-de-software': 'Correção de software',
        'reparo-de-audio': 'Reparo de áudio',
        'reparo-de-agua': 'Danos por líquido'
    }

    return map[service.slug] || service.name
}

function getDeviceLabel(brand: Brand, deviceType: DeviceType, model?: Model) {
    if (!model) return deviceType.displayName

    const base = model.displayName || model.name
    const type = deviceType.displayName

    // evita repetição tipo "iPhone iPhone 15"
    if (base.toLowerCase().includes(type.toLowerCase())) return base

    // evita repetição com marca quando modelo já carrega a marca (ex: "Galaxy S24")
    if (base.toLowerCase().includes(brand.displayName.toLowerCase())) return base

    return `${type} ${base}`
}

function getBrandProfile(brand: Brand) {
    const slug = brand.slug

    if (slug === 'motorola') {
        return {
            angle: 'módulos, custo-benefício e linhas Moto G/Edge',
            technicalFocus: 'módulos e flex, alinhamento do conjunto e vedação',
            series: ['Moto G', 'Moto Edge', 'Moto E'],
            faq: [
                {
                    q: 'Em Motorola, a câmera fica tremendo: é OIS ou módulo solto?',
                    a: 'Nos Moto G/Edge isso costuma ser OIS com desgaste, impacto no suporte do módulo ou flex com mau-contato. Fazemos teste de estabilização e inspeção do encaixe antes de definir troca ou reparo.'
                },
                {
                    q: 'Trocar a câmera do Moto G afeta o app nativo ou o foco?',
                    a: 'Após a substituição, validamos foco automático, macro (quando existe), gravação e HDR no app nativo. Quando há falha persistente, investigamos flex e placa do circuito da câmera.'
                },
                {
                    q: 'Câmera frontal do Motorola parou após queda: é só o módulo?',
                    a: 'Pode ser módulo, flex ou conector. O diagnóstico verifica alimentação do circuito e resposta do sensor; se o conector estiver danificado, o reparo pode envolver micro-solda.'
                }
            ]
        }
    }

    if (slug === 'samsung') {
        return {
            angle: 'AMOLED, OIS e famílias Galaxy S/A',
            technicalFocus: 'OIS, sensores múltiplos e checagem do módulo no app Samsung',
            series: ['Galaxy S', 'Galaxy A', 'Galaxy Tab'],
            faq: [
                {
                    q: 'Em Samsung Galaxy, câmera com “Aviso: falha” é módulo ou software?',
                    a: 'Pode ser travamento do app, falha de inicialização do sensor, flex rompido ou módulo com curto. O diagnóstico compara comportamento em câmera nativa e testes de hardware para isolar a causa.'
                },
                {
                    q: 'A câmera Samsung ficou com manchas/névoa: precisa trocar lente?',
                    a: 'Mancha pode ser contaminação interna, dano no sensor ou vedação comprometida. Avaliamos se é possível limpeza do conjunto; quando o sensor foi afetado, a troca do módulo é o caminho mais estável.'
                },
                {
                    q: 'OIS fazendo barulho no Galaxy S é normal?',
                    a: 'Leve ruído ao chacoalhar pode ocorrer pelo conjunto do OIS. Se há vibração forte, tremor no vídeo ou foco instável, normalmente indica falha no estabilizador e requer intervenção no módulo.'
                }
            ]
        }
    }

    if (slug === 'apple') {
        return {
            angle: 'integração iOS, calibração e cuidado com Face ID/TrueDepth',
            technicalFocus: 'calibração, vedação e validação de recursos do iOS',
            series: ['iPhone', 'iPad', 'MacBook'],
            faq: [
                {
                    q: 'No iPhone, a câmera pode perder recursos após o reparo?',
                    a: 'Alguns recursos dependem de calibração e compatibilidade do conjunto. Após o serviço, testamos foco, modo retrato, vídeo e sensores auxiliares; na câmera frontal, seguimos procedimentos para não comprometer o TrueDepth.'
                },
                {
                    q: 'Trocar a câmera frontal do iPhone afeta o Face ID?',
                    a: 'O Face ID depende do conjunto TrueDepth. Quando o problema é na câmera frontal (imagem), avaliamos se o defeito está no módulo de câmera ou em componentes do TrueDepth para evitar impactos no reconhecimento.'
                },
                {
                    q: 'iPhone com câmera preta após atualização do iOS: é hardware?',
                    a: 'Nem sempre. Verificamos permissões, app câmera e logs de inicialização do sensor. Se o sensor não responde (mesmo após testes), tratamos como falha de módulo, flex ou circuito na placa.'
                }
            ]
        }
    }

    if (slug === 'xiaomi') {
        return {
            angle: 'MIUI, linhas Redmi/Poco e módulos custo-benefício',
            technicalFocus: 'módulos, flex e checagens de compatibilidade MIUI',
            series: ['Redmi Note', 'Poco', 'Xiaomi'],
            faq: [
                {
                    q: 'No Xiaomi/Redmi, câmera com lag é problema de módulo ou MIUI?',
                    a: 'Pode ser MIUI, cache do app ou sensor com falha. Fazemos testes com câmera nativa, checamos estabilização/foco e validamos se há aquecimento/consumo anormal indicando defeito físico.'
                },
                {
                    q: 'Câmera do Poco ficou desfocada depois de queda: dá pra ajustar?',
                    a: 'Quando há desalinhamento do conjunto, pode ser possível corrigir o encaixe; se o atuador de foco ou o OIS foi danificado, a solução confiável é a troca do módulo.'
                },
                {
                    q: 'O vidro da câmera do Xiaomi trincou: troca do vidro resolve?',
                    a: 'Se o sensor e o foco não foram afetados, a troca do vidro pode ser suficiente. Se entrou poeira/umidade e há manchas, avaliamos necessidade de intervenção no módulo para estabilizar o resultado.'
                }
            ]
        }
    }

    // fallback: ainda sem repetir perguntas (inclui marca no enunciado)
    return {
        angle: `características específicas da linha ${brand.displayName}`,
        technicalFocus: `checagem de módulo, flex e compatibilidade do conjunto em ${brand.displayName}`,
        series: [brand.displayName],
        faq: [
            {
                q: `Em ${brand.displayName}, o que costuma causar câmera preta/intermitente?`,
                a: 'Geralmente envolve mau-contato em flex/conector, módulo com falha ou curto no circuito do sensor. O diagnóstico isola o ponto com testes de inicialização e inspeção do conjunto.'
            },
            {
                q: `A câmera de ${brand.displayName} ficou tremendo: é OIS ou impacto?`,
                a: 'Quando há tremor no vídeo e foco instável, costuma ser falha do estabilizador (OIS) ou suporte do módulo após impacto. Testamos estabilização e integridade do encaixe.'
            },
            {
                q: `Depois do reparo em ${brand.displayName}, quais testes vocês fazem?`,
                a: 'Validamos foco, vídeo, flash (quando integrado), troca entre lentes e estabilidade do sensor no app nativo. Se algum recurso falha, investigamos flex e circuito da placa.'
            }
        ]
    }
}

function getFaq(service: Service, brand: Brand, deviceType: DeviceType, model?: Model): FaqItem[] {
    const deviceLabel = getDeviceLabel(brand, deviceType, model)
    const serviceNameLower = service.name.toLowerCase()
    const isApple = brand.slug === 'apple'
    const isSamsung = brand.slug === 'samsung'
    const isWatch = deviceType.slug === 'watch'
    const isMacbook = deviceType.slug === 'macbook'

    if (service.slug === 'troca-de-camera') {
        return getBrandProfile(brand).faq
    }

    if (service.slug === 'troca-de-tela') {
        if (isWatch) {
            return [
                {
                    q: `Troca de tela no ${deviceLabel}: quando é necessária?`,
                    a: 'Quando há falta de imagem, manchas, linhas no display ou toque comprometido. Se for apenas trinca estética e o display estiver perfeito, avaliamos se existe opção de troca de vidro (quando aplicável).'
                },
                {
                    q: 'Trincou, mas ainda funciona: dá para usar assim?',
                    a: 'Não é recomendado. A trinca pode evoluir, deixar entrar umidade/poeira e piorar o dano. Em relógios, isso pode comprometer a vedação e acelerar corrosão interna.'
                },
                {
                    q: 'O reparo afeta vedação/resistência à água?',
                    a: 'A vedação original pode ser comprometida quando o aparelho é aberto. Aplicamos selagem e testes funcionais, mas não prometemos resistência à água como condição de uso.'
                },
                {
                    q: 'Qual é o prazo e a garantia?',
                    a: 'Em geral até 24–48h úteis, variando por disponibilidade e complexidade. Garantia de 6 meses para o serviço e peça instalada.'
                }
            ]
        }

        if (isApple) {
            return [
                {
                    q: `O que pode indicar necessidade de ${serviceNameLower} no ${deviceLabel}?`,
                    a: 'Manchas pretas, linhas, toque falhando, imagem piscando ou tela sem imagem. Se o vidro quebrou mas o display está perfeito, pode existir opção de troca de vidro dependendo do modelo.'
                },
                {
                    q: 'Trocar a tela pode afetar Face ID e sensores?',
                    a: 'O Face ID depende do conjunto frontal e de procedimentos corretos. Fazemos montagem com cuidado e testes de proximidade, câmera frontal e recursos do iOS para manter a experiência estável.'
                },
                {
                    q: 'E o True Tone / brilho automático?',
                    a: 'Alguns recursos dependem de compatibilidade do conjunto e calibração. Após o reparo, validamos brilho, toque e sensores para garantir o melhor resultado possível.'
                },
                {
                    q: 'Qual é o prazo e a garantia?',
                    a: 'Em geral até 24–48h úteis, variando por complexidade. Garantia de 6 meses para o serviço e peça instalada.'
                }
            ]
        }

        if (isSamsung) {
            return [
                {
                    q: `Troca de tela em ${brand.displayName}: quando precisa?`,
                    a: 'Quando há manchas (AMOLED), linhas, tela preta com aparelho ligado, brilho irregular ou toque com falhas. Trinca no vidro pode evoluir e virar dano no painel.'
                },
                {
                    q: 'Tela com linhas e “ghost touch” é sempre display?',
                    a: 'Na maioria dos casos sim, mas também pode envolver flex/conector. Fazemos diagnóstico antes para confirmar se é conjunto de tela ou contato.'
                },
                {
                    q: 'O biométrico (quando existe) continua funcionando?',
                    a: 'Depende do modelo e do conjunto. Após o serviço, validamos toque e funcionalidades; quando há leitor sob a tela, o comportamento pode variar conforme compatibilidade.'
                },
                {
                    q: 'Qual é o prazo e a garantia?',
                    a: 'Em geral até 24–48h úteis. Garantia de 6 meses para o serviço e peça instalada.'
                }
            ]
        }
    }

    if (service.slug === 'troca-de-vidro-da-tela') {
        return [
            {
                q: `Qual a diferença entre troca de vidro e ${serviceNameLower}?`,
                a: 'A troca de vidro é indicada quando apenas o vidro externo trincou e o display/toque estão perfeitos. Se há manchas, linhas ou falha de toque, normalmente é necessário trocar o conjunto da tela.'
            },
            {
                q: `Como saber se meu ${deviceLabel} pode trocar só o vidro?`,
                a: 'Precisamos confirmar que o painel está íntegro: sem manchas, sem linhas, brilho estável e toque perfeito. Se houver “vazamento” preto ou falha de toque, a troca de vidro não resolve.'
            },
            {
                q: 'Troca de vidro mantém a qualidade de imagem e toque?',
                a: 'Quando o display está realmente íntegro, o objetivo é manter imagem e toque originais, apenas restaurando o acabamento. O resultado depende do estado do painel e do processo de colagem/alinhamento.'
            },
            {
                q: 'Qual é o prazo e a garantia?',
                a: 'Em geral até 24–48h úteis, variando por modelo. Garantia de 6 meses para o serviço.'
            }
        ]
    }

    if (service.slug === 'troca-de-vidro-tampa-traseira') {
        return [
            {
                q: `Quando vale fazer troca de vidro/tampa traseira no ${deviceLabel}?`,
                a: 'Quando a traseira está trincada, solta, arranhada ou com encaixe comprometido após queda. Avaliamos se basta substituir o vidro traseiro ou se a tampa/housing completo precisa ser trocado.'
            },
            {
                q: 'Qual a diferença para troca de vidro da tela?',
                a: 'A troca de vidro da tela envolve o conjunto frontal e depende de display/toque íntegros. A troca de vidro/tampa traseira restaura a parte externa traseira, acabamento, encaixe e proteção dos componentes internos.'
            },
            {
                q: 'Vidro traseiro quebrado pode afetar câmera ou bateria?',
                a: 'Pode. Impacto na traseira pode desalinhar lentes, comprometer vedação e pressionar bateria ou flex. Por isso verificamos câmeras, encaixes e sinais de empeno antes de fechar o aparelho.'
            },
            {
                q: 'Qual é o prazo e a garantia?',
                a: 'Em geral até 24-48h úteis, variando por modelo e disponibilidade da tampa. Garantia de 6 meses para o serviço e peça instalada.'
            }
        ]
    }

    if (service.slug === 'troca-de-bateria') {
        return [
            {
                q: `Quais sinais indicam troca de bateria no ${deviceLabel}?`,
                a: 'Autonomia caiu muito, desligamento inesperado, aquecimento, carga oscilando ou bateria inchada. Em caso de inchaço, evite pressionar o aparelho e procure assistência.'
            },
            {
                q: 'Trocar a bateria apaga meus dados?',
                a: 'Não. A troca é de hardware e não exige formatação. Ainda assim, recomendamos backup quando possível antes de qualquer manutenção.'
            },
            {
                q: 'Carregamento lento pode ser bateria ou conector?',
                a: 'Pode ser ambos. Se o aparelho só carrega em certa posição ou perde conexão, pode indicar porta de carga. Se carrega, mas dura pouco, tende a ser bateria degradada.'
            },
            {
                q: 'Qual é o prazo e a garantia?',
                a: 'Em geral até 24h úteis. Garantia de 6 meses para o serviço e peça instalada.'
            }
        ]
    }

    if (service.slug === 'troca-de-conector') {
        return [
            {
                q: `Quando precisa ${serviceNameLower} no ${deviceLabel}?`,
                a: 'Quando só carrega em certa posição, há folga na porta, oxidação, falha de dados ou carregamento intermitente. Antes, avaliamos se é apenas sujeira/obstrução.'
            },
            {
                q: 'Limpeza resolve ou precisa trocar?',
                a: 'Se o problema for sujeira/fiapos ou mau-contato leve, a limpeza pode resolver. Se houver folga, pinos danificados ou oxidação avançada, a troca tende a ser a solução estável.'
            },
            {
                q: 'Depois de trocar o conector, volta a transferir dados?',
                a: 'Quando a falha é na porta, sim. Após o serviço testamos carga e comunicação com computador (quando aplicável).'
            },
            {
                q: 'Qual é o prazo e a garantia?',
                a: 'Em geral até 24h úteis. Garantia de 6 meses para o serviço.'
            }
        ]
    }

    if (service.slug === 'reparo-de-placa') {
        return [
            {
                q: `Quando o ${deviceLabel} precisa de reparo de placa?`,
                a: 'Quando não liga, não carrega, reinicia em loop, aquece ao conectar na fonte ou perde funções (rede, áudio, carga) por falha no circuito.'
            },
            {
                q: 'Dá para recuperar dados em reparo de placa?',
                a: 'Em muitos casos, sim. A viabilidade depende do tipo de dano (curto, oxidação, circuito de armazenamento). Avaliamos o cenário e priorizamos segurança dos dados.'
            },
            {
                q: 'Quanto tempo demora?',
                a: 'Varia bastante por diagnóstico e complexidade. Após a análise, informamos o prazo e o orçamento antes de seguir.'
            },
            {
                q: 'A garantia vale para qualquer caso?',
                a: 'A garantia depende do tipo de reparo e do estado geral da placa. Explicamos claramente o que foi corrigido e o que fica fora de cobertura.'
            }
        ]
    }

    if (service.slug === 'correcoes-de-software') {
        if (isMacbook) {
            return [
                {
                    q: 'O que entra em correções de software no MacBook?',
                    a: 'Diagnóstico de boot, correção de sistema, remoção de conflitos, otimização e ajustes de conta/rede. Sempre que possível, priorizamos backup antes de intervenções.'
                },
                {
                    q: 'Pode perder arquivos?',
                    a: 'O objetivo é preservar dados, mas problemas de armazenamento podem exigir medidas mais profundas. Quando houver risco, avisamos antes e orientamos o melhor caminho.'
                },
                {
                    q: 'Quanto tempo leva?',
                    a: 'Depende do sintoma (boot, update, lentidão). Muitos casos são resolvidos no mesmo dia; outros dependem de testes e backup.'
                }
            ]
        }

        return [
            {
                q: 'O que entra em correções de software?',
                a: 'Ajustes de sistema, remoção de travamentos, otimização, correção de apps e orientações para reduzir consumo/anomalias. Quando necessário, fazemos reinstalação com backup.'
            },
            {
                q: 'Isso resolve travamento e reinício?',
                a: 'Quando a causa é software, sim. Se persistir, avaliamos hardware (bateria, armazenamento, placa) para fechar diagnóstico.'
            },
            {
                q: 'Preciso formatar?',
                a: 'Nem sempre. Tentamos correções sem apagar dados primeiro. Se a reinstalação for o caminho mais estável, avisamos e orientamos backup.'
            }
        ]
    }

    if (service.slug === 'reparo-de-audio') {
        return [
            {
                q: 'Meu áudio está abafado: é sujeira ou defeito?',
                a: 'Pode ser obstrução (poeira/umidade) ou falha de alto-falante/microfone. O diagnóstico testa chamadas, gravação e saída de som para definir limpeza vs troca.'
            },
            {
                q: 'Microfone baixo em ligação é sempre microfone?',
                a: 'Não. Pode envolver rede, app, obstrução ou circuito. Testamos microfones e rotas de áudio para isolar a causa.'
            },
            {
                q: 'Qual é o prazo e a garantia?',
                a: 'Em geral até 24–48h úteis. Garantia de 6 meses quando há troca de componente.'
            }
        ]
    }

    if (service.slug === 'reparo-de-agua') {
        return [
            {
                q: 'Molhou: o que fazer imediatamente?',
                a: 'Desligue, não conecte no carregador e evite aquecer (secador). Se possível, leve o quanto antes para limpeza técnica e inspeção de oxidação.'
            },
            {
                q: 'Depois que seca, pode voltar a funcionar sozinho?',
                a: 'Pode, mas não significa que está tudo bem. A oxidação pode evoluir e causar falhas dias depois. A limpeza técnica reduz muito esse risco.'
            },
            {
                q: 'Dá para recuperar dados?',
                a: 'Em muitos casos, sim. Avaliamos prioridade de recuperação e o estado da placa antes de qualquer intervenção mais profunda.'
            }
        ]
    }

    // fallback: FAQ genérico por serviço
    return [
        {
            q: `O que está incluído no serviço de ${service.name}?`,
            a: 'Diagnóstico, execução do reparo/troca, testes pós-serviço e orientações de uso. Quando necessário, avaliamos também componentes associados ao sintoma.'
        },
        {
            q: `Qual é o prazo para ${serviceNameLower} no ${deviceLabel}?`,
            a: 'O prazo varia por complexidade e disponibilidade de peças, mas muitos casos são concluídos em até 24–48h úteis.'
        },
        {
            q: 'Vocês oferecem garantia?',
            a: 'Sim. Em geral a garantia é de 6 meses, variando conforme o tipo de serviço e peça instalada.'
        }
    ]
}

function getServiceProblems(service: Service, brand: Brand, deviceType: DeviceType) {
    const slug = service.slug
    const brandSlug = brand.slug
    const typeSlug = deviceType.slug

    if (slug === 'troca-de-camera') {
        if (brandSlug === 'samsung') {
            return [
                'Vídeo tremido com OIS “batendo” em Galaxy S',
                'Aviso “Falha na câmera” ao abrir o app',
                'Manchas no sensor em fotos claras',
                'Foco caçando (não trava) em câmera principal',
                'Câmera grande-angular não alterna',
                'Selfie com imagem borrada e ruído em baixa luz'
            ]
        }

        if (brandSlug === 'motorola') {
            return [
                'Imagem tremendo nos Moto Edge (OIS instável)',
                'Foco travando em macro/automático',
                'Câmera abrindo e fechando sozinha',
                'Fotos com névoa após quebra da vedação',
                'Câmera frontal sem imagem após queda',
                'Erro intermitente por flex/conector'
            ]
        }

        if (brandSlug === 'apple') {
            return [
                'Câmera traseira com tremor e foco instável',
                'Tela preta ao trocar de lente no app',
                'Modo retrato falhando por leitura de sensor',
                'Selfie sem foco/ruído após impacto',
                'Vídeo com artefatos (sensor instável)',
                'Falha intermitente ligada a flex do conjunto'
            ]
        }

        if (brandSlug === 'xiaomi') {
            return [
                'Câmera lenta/engasgando na MIUI com sensor ruim',
                'Fotos com manchas por contaminação interna',
                'Foco não trava em modo retrato',
                'Grande-angular não abre ou fecha o app',
                'Selfie com imagem lavada após queda',
                'Erro ao alternar entre lentes em Redmi/Poco'
            ]
        }

        return [
            'Câmera preta ou intermitente ao abrir',
            'Foco travando (não ajusta)',
            'Imagem tremendo por estabilização instável',
            'Manchas/névoa por contaminação interna',
            'Falha ao alternar entre lentes',
            'Selfie sem imagem após impacto'
        ]
    }

    if (slug === 'troca-de-vidro-tampa-traseira') {
        if (brandSlug === 'apple') {
            return [
                'Vidro traseiro do iPhone trincado após queda',
                'Tampa traseira soltando ou com frestas',
                'Lente da câmera desalinhada após impacto',
                'Traseira riscada ou quebrada perto das bordas',
                'Carcaça empenada pressionando bateria',
                'Vedação comprometida com entrada de poeira'
            ]
        }

        if (brandSlug === 'samsung') {
            return [
                'Back glass de Galaxy trincado ou estilhaçado',
                'Tampa traseira descolando nas bordas',
                'Moldura traseira empenada após queda',
                'Câmeras com aro deslocado ou folga',
                'Vidro traseiro arranhado com risco de corte',
                'Bateria estufando e levantando a tampa'
            ]
        }

        if (brandSlug === 'motorola') {
            return [
                'Tampa traseira do Moto G quebrada',
                'Traseira soltando após queda',
                'Moldura com folga perto dos botões',
                'Vidro/carcaça riscado e com quinas quebradas',
                'Câmera traseira com aro comprometido',
                'Tampa aberta por bateria inchada'
            ]
        }

        if (brandSlug === 'xiaomi') {
            return [
                'Vidro traseiro de Redmi/Poco trincado',
                'Tampa traseira descolando nas laterais',
                'Carcaça empenada perto do módulo de câmera',
                'Rachadura avançando para as bordas',
                'Poeira entrando pela traseira quebrada',
                'Acabamento traseiro solto após impacto'
            ]
        }

        return [
            'Vidro traseiro trincado ou estilhaçado',
            'Tampa traseira descolando',
            'Moldura/carcaça empenada',
            'Câmera traseira desalinhada após queda',
            'Bordas quebradas com risco de corte',
            'Vedação comprometida por impacto'
        ]
    }

    if (slug === 'troca-de-tela' || slug === 'troca-de-vidro-da-tela') {
        if (brandSlug === 'samsung') {
            return [
                'AMOLED com manchas verdes/pretas',
                'Toque “fantasma” após queda',
                'Linhas verticais em tela Galaxy',
                'Brilho irregular e flicker em baixa luz',
                'Vidro trincado com display ainda aceso',
                'Falha no biométrico sob a tela (quando existe)'
            ]
        }

        if (brandSlug === 'apple') {
            return [
                'Tela com toques aleatórios no iPhone',
                'Linhas e pontos pretos no display',
                'Vidro trincado com LCD/OLED íntegro',
                'Brilho instável e sensores de proximidade falhando',
                'Imagem “lavada” após impacto no conjunto',
                'Problemas no True Tone após troca (quando aplicável)'
            ]
        }

        if (brandSlug === 'motorola') {
            return [
                'Tela apagando com impacto lateral',
                'Toque falhando em bordas (Moto G)',
                'Trinca no vidro com display preservado',
                'Mancha escura por pressão no painel',
                'Flicker em brilho baixo',
                'Aparelho ligando sem imagem (flat rompido)'
            ]
        }

        if (brandSlug === 'xiaomi') {
            return [
                'Tela com linhas e toque irregular em Redmi',
                'Vidro quebrado e display aceso',
                'Brilho caindo e escurecendo sozinho',
                'Ghost touch em Poco',
                'Manchas após pressão no painel',
                'Aquecimento e dreno por curto no conjunto'
            ]
        }

        return [
            'Vidro trincado e risco de corte',
            'Mancha preta expandindo no painel',
            'Linhas verticais/horizontais',
            'Toque falhando em partes da tela',
            'Tela apagada com aparelho ligado',
            'Brilho irregular e flicker'
        ]
    }

    if (slug === 'troca-de-bateria') {
        if (brandSlug === 'apple') {
            return [
                'Autonomia caiu rápido mesmo em repouso',
                'iPhone desligando em percentual alto',
                'Aquecimento ao carregar',
                'Saúde da bateria muito baixa e picos de consumo',
                'Carga travando (não passa de certa %)',
                'Inchaço pressionando tela/carcaça'
            ]
        }

        if (brandSlug === 'samsung') {
            return [
                'Dreno acelerado em standby',
                'Aquecimento com carregamento rápido',
                'Desligamento ao abrir câmera/jogos',
                'Carga oscilando com USB-C',
                'Queda brusca de 30% para 5%',
                'Bateria estufando e levantando tampa'
            ]
        }

        if (brandSlug === 'motorola') {
            return [
                'Moto G descarregando durante a noite',
                'Carregamento lento mesmo com TurboPower',
                'Desligamento repentino com 20–30%',
                'Aquecimento perto do conector',
                'Bateria inchando e abrindo a traseira',
                'Autonomia ruim após atualização/uso intenso'
            ]
        }

        if (brandSlug === 'xiaomi') {
            return [
                'Redmi/Poco com queda brusca de porcentagem',
                'Aquecimento ao usar câmera e 5G',
                'Carga lenta com USB-C (mesmo com carregador original)',
                'Dreno em MIUI com bateria degradada',
                'Desligamento sob carga',
                'Inchaço pressionando a tampa'
            ]
        }

        return [
            'Autonomia reduzida no dia a dia',
            'Aquecimento ao carregar/usar apps pesados',
            'Desligamento inesperado',
            'Carga lenta ou instável',
            'Queda brusca de porcentagem',
            'Inchaço e deformação da carcaça'
        ]
    }

    if (slug === 'reparo-de-placa') {
        return [
            'Aparelho não liga e não carrega',
            'Curto após contato com líquido',
            'Reiniciando em loop',
            'Sem sinal/sem Wi‑Fi por falha no circuito',
            'Sem áudio/microfone por componente na placa',
            'Aquecimento imediato ao conectar na fonte'
        ]
    }

    if (slug === 'troca-de-conector') {
        return [
            'Só carrega em certa posição do cabo',
            'Conector com folga e mau-contato',
            'Oxidação/umidade na porta de carga',
            'Não reconhece no computador (dados)',
            'Carregamento intermitente com USB-C/Lightning',
            'Aparelho acusa “umidade” sem motivo'
        ]
    }

    if (slug === 'correcoes-de-software') {
        if (typeSlug === 'macbook') {
            return [
                'Mac travando no boot ou atualizando sem concluir',
                'Conta iCloud bloqueada por sessão antiga',
                'Lentidão após atualização do macOS',
                'Apps fechando sozinhos por conflito',
                'Falhas de rede e perfis corrompidos',
                'Backup/recuperação de dados com erros'
            ]
        }

        return [
            'Travando e reiniciando do nada',
            'Apps fechando e erro ao abrir câmera',
            'Armazenamento cheio “fantasma”',
            'Loop de logo ao iniciar',
            'Notificações/serviços travados',
            'Vírus/adware e pop-ups'
        ]
    }

    if (slug === 'reparo-de-audio') {
        return [
            'Microfone baixo em ligações',
            'Alto-falante chiando ou estourado',
            'Sem áudio em vídeos',
            'Fone não reconhece (P2/USB-C)',
            'Som abafado por sujeira/umidade',
            'Áudio falhando intermitente'
        ]
    }

    if (slug === 'reparo-de-agua') {
        return [
            'Aparelho não liga após molhar',
            'Oxidação e falha intermitente',
            'Tela piscando após contato com líquido',
            'Sem áudio/câmera após infiltração',
            'Carregamento falhando por curto',
            'Aquecimento e dreno anormal'
        ]
    }

    return [
        'Sintomas variando por uso e impacto',
        'Falhas intermitentes no dia a dia',
        'Problemas após queda ou pressão',
        'Erros ao abrir apps relacionados',
        'Aquecimento ou consumo anormal',
        'Falhas de componentes específicos'
    ]
}

function getServiceProcess(service: Service, brand: Brand, deviceType: DeviceType, model?: Model) {
    const serviceSlug = service.slug
    const brandSlug = brand.slug
    const type = deviceType.slug
    const modelLabel = model?.displayName ? ` no ${model.displayName}` : ''

    if (serviceSlug === 'troca-de-camera') {
        if (brandSlug === 'apple') {
            return normalizeSpaces(
                `Checamos o conjunto de câmeras do iOS (troca de lente, foco, vídeo) e inspecionamos flex/conectores. ` +
                `Se o defeito for no módulo, substituímos e validamos retrato e estabilização${modelLabel}. ` +
                `Na câmera frontal, o cuidado é preservar o conjunto TrueDepth quando aplicável.`
            )
        }

        if (brandSlug === 'samsung') {
            return normalizeSpaces(
                `Executamos testes no app nativo Samsung e verificamos OIS, alternância entre lentes e resposta do sensor. ` +
                `Abrimos o aparelho com controle térmico, analisamos flex e suporte do módulo e corrigimos vedação${modelLabel}. ` +
                `Ao final, validamos foco, vídeo e estabilidade em diferentes condições de luz.`
            )
        }

        if (brandSlug === 'motorola') {
            return normalizeSpaces(
                `Confirmamos o sintoma com testes de foco/OIS e conferimos o encaixe do módulo e o flex. ` +
                `Nos Moto G/Edge, avaliamos vibração e retorno do estabilizador antes de substituir o conjunto${modelLabel}. ` +
                `Depois, testamos macro (quando existe), HDR e gravação para garantir consistência.`
            )
        }

        if (brandSlug === 'xiaomi') {
            return normalizeSpaces(
                `Validamos o comportamento na MIUI e isolamos se a falha é do app, flex ou módulo. ` +
                `Abrimos o aparelho, verificamos contaminação/vedação e substituímos o conjunto quando o sensor não responde${modelLabel}. ` +
                `Finalizamos com testes de alternância entre lentes e estabilidade do vídeo.`
            )
        }
    }

    if (serviceSlug === 'troca-de-tela' || serviceSlug === 'troca-de-vidro-da-tela') {
        if (brandSlug === 'samsung') {
            return normalizeSpaces(
                `Em Samsung, priorizamos integridade do AMOLED e do flex. ` +
                `Removemos o conjunto com aquecimento controlado, transferimos componentes e recalibramos toque e brilho${modelLabel}. ` +
                `Quando é troca de vidro, o foco é manter o painel e restaurar a estética com alinhamento preciso.`
            )
        }

        if (brandSlug === 'apple') {
            return normalizeSpaces(
                `No iPhone/iPad, o processo considera sensores e calibrações do iOS. ` +
                `Fazemos a desmontagem com controle de adesivo, instalamos o conjunto e validamos toque, brilho e proximidade${modelLabel}. ` +
                `Se for vidro, avaliamos se o painel está íntegro antes de seguir.`
            )
        }

        if (brandSlug === 'motorola') {
            return normalizeSpaces(
                `Nos Motorola, o foco é preservar o frame e evitar tensão no flex. ` +
                `Retiramos o conjunto, verificamos microtrincas no painel e alinhamos a nova tela/vidro para não gerar toque irregular${modelLabel}. ` +
                `Ao final, validamos brilho, toque em bordas e resposta do sensor de proximidade.`
            )
        }

        if (brandSlug === 'xiaomi') {
            return normalizeSpaces(
                `Em Xiaomi/Redmi/Poco, checamos o conjunto de display e o comportamento do toque. ` +
                `Fazemos a substituição com alinhamento e vedação para reduzir entrada de poeira${modelLabel}. ` +
                `Finalizamos com testes de brilho, toque contínuo e estabilidade em apps.`
            )
        }
    }

    if (serviceSlug === 'troca-de-vidro-tampa-traseira') {
        if (brandSlug === 'apple') {
            return normalizeSpaces(
                `No iPhone/iPad, avaliamos a traseira, aro das câmeras e sinais de empeno antes da troca. ` +
                `Removemos o vidro/tampa com controle térmico, instalamos a peça compatível e validamos câmeras, botões, carga por indução quando aplicável e acabamento${modelLabel}.`
            )
        }

        if (brandSlug === 'samsung') {
            return normalizeSpaces(
                `Em Samsung, removemos a tampa traseira preservando flex, lentes e vedação do conjunto. ` +
                `Depois instalamos o back glass/tampa compatível, conferimos alinhamento do módulo de câmera e validamos fechamento sem frestas${modelLabel}.`
            )
        }

        if (brandSlug === 'motorola') {
            return normalizeSpaces(
                `Nos Motorola, checamos se a tampa traseira quebrou por impacto ou por pressão de bateria estufada. ` +
                `Fazemos a substituição com alinhamento de carcaça, inspeção de botões e teste de encaixe para evitar folgas${modelLabel}.`
            )
        }

        if (brandSlug === 'xiaomi') {
            return normalizeSpaces(
                `Em Xiaomi/Redmi/Poco, avaliamos módulo de câmera, cola da tampa e possíveis empenos na moldura. ` +
                `A troca restaura acabamento traseiro, reduz entrada de poeira e finaliza com teste de câmera e fechamento${modelLabel}.`
            )
        }
    }

    if (serviceSlug === 'troca-de-bateria') {
        if (brandSlug === 'apple') {
            return normalizeSpaces(
                `Avaliamos ciclos e comportamento de consumo, removemos a bateria com tiras adesivas e instalamos o conjunto compatível. ` +
                `Depois, testamos carga, aquecimento e estabilidade de desempenho${modelLabel}.`
            )
        }

        if (brandSlug === 'samsung') {
            return normalizeSpaces(
                `Verificamos consumo em standby, removemos a bateria com segurança e testamos carregamento rápido e estabilidade térmica. ` +
                `Também checamos a porta USB-C quando há oscilação de carga${modelLabel}.`
            )
        }

        if (brandSlug === 'motorola') {
            return normalizeSpaces(
                `Checamos comportamento com TurboPower, removemos a bateria e validamos carga estável e consumo em repouso. ` +
                `Se houver aquecimento próximo ao conector, investigamos a linha de carga${modelLabel}.`
            )
        }
    }

    if (serviceSlug === 'correcoes-de-software' && type === 'macbook') {
        return normalizeSpaces(
            `No MacBook, iniciamos com diagnóstico de boot/armazenamento, checamos integridade do sistema e fazemos correções com backup quando necessário. ` +
            `Após o ajuste, validamos rede, login e estabilidade dos apps.`
        )
    }

    return normalizeSpaces(
        `Diagnosticamos o sintoma, testamos os componentes relacionados e aplicamos o procedimento adequado para ${service.name.toLowerCase()} em ${deviceType.displayName} ${brand.displayName}${modelLabel}. ` +
        `Ao final, validamos o funcionamento em uso real.`
    )
}

function getTechnicalSection(service: Service, brand: Brand, deviceType: DeviceType, model?: Model) {
    const profile = getBrandProfile(brand)
    const deviceLabel = getDeviceLabel(brand, deviceType, model)
    const serviceSlug = service.slug

    if (serviceSlug === 'troca-de-camera') {
        if (brand.slug === 'samsung') {
            return normalizeSpaces(
                `Em ${brand.displayName} ${deviceType.displayName}, a câmera pode envolver sensores múltiplos e OIS. ` +
                `Avaliamos tremor, foco e alternância de lentes, além de flex e suporte do módulo. ` +
                `Quando o defeito é no conjunto, a troca do módulo estabiliza imagem e vídeo em ${deviceLabel}.`
            )
        }

        if (brand.slug === 'motorola') {
            return normalizeSpaces(
                `Nos ${brand.displayName}, o conjunto costuma vir em módulo (sensor+lente+atuador) com flex dedicado. ` +
                `Checamos encaixe, retorno do OIS e resposta do autofocus para definir troca do módulo ou correção de contato. ` +
                `Isso é comum em linhas ${profile.series.join(', ')}.`
            )
        }

        if (brand.slug === 'apple') {
            return normalizeSpaces(
                `Em ${brand.displayName}, a integração com o iOS exige validação de recursos (retrato, vídeo e sensores auxiliares). ` +
                `No conjunto frontal, o cuidado é não interferir no TrueDepth quando aplicável. ` +
                `Finalizamos com testes completos no ${deviceLabel} para garantir consistência de foco e estabilização.`
            )
        }

        if (brand.slug === 'xiaomi') {
            return normalizeSpaces(
                `Em ${brand.displayName}, a MIUI pode mascarar falhas intermitentes de sensor. ` +
                `Por isso cruzamos testes de app com inspeção de flex e módulo, além de vedação para reduzir poeira/névoa. ` +
                `O objetivo é manter estabilidade do vídeo e troca de lentes no ${deviceLabel}.`
            )
        }
    }

    if (serviceSlug === 'troca-de-tela') {
        if (brand.slug === 'samsung') {
            return normalizeSpaces(
                `Telas ${brand.displayName} com AMOLED exigem controle de brilho e toque após a troca. ` +
                `A desmontagem respeita flex e frame para reduzir risco de linhas e ghost touch. ` +
                `Depois, validamos uniformidade do painel e resposta de toque em todo o ${deviceLabel}.`
            )
        }

        if (brand.slug === 'apple') {
            return normalizeSpaces(
                `Em ${brand.displayName}, sensores e calibrações do sistema influenciam a experiência após a troca de tela. ` +
                `Verificamos brilho, proximidade e estabilidade do toque, além de alinhamento do conjunto no ${deviceLabel}. ` +
                `O objetivo é manter uso diário sem falhas intermitentes.`
            )
        }
    }

    if (serviceSlug === 'troca-de-vidro-da-tela') {
        if (brand.slug === 'samsung') {
            return normalizeSpaces(
                `A troca de vidro em ${brand.displayName} busca preservar o AMOLED quando o painel está íntegro. ` +
                `Atenção especial ao alinhamento e à colagem evita bordas levantando e toque irregular no ${deviceLabel}.`
            )
        }
        if (brand.slug === 'apple') {
            return normalizeSpaces(
                `Quando a troca é só do vidro em ${brand.displayName}, avaliamos se o display está perfeito antes de iniciar. ` +
                `O processo prioriza alinhamento, acabamento e estabilidade do toque no ${deviceLabel}.`
            )
        }
    }

    if (serviceSlug === 'troca-de-vidro-tampa-traseira') {
        if (brand.slug === 'samsung') {
            return normalizeSpaces(
                `A troca de vidro/tampa traseira em ${brand.displayName} exige cuidado com back glass, lentes e vedação do conjunto. ` +
                `Validamos encaixe, alinhamento do módulo de câmera e fechamento sem frestas no ${deviceLabel}.`
            )
        }
        if (brand.slug === 'apple') {
            return normalizeSpaces(
                `Em ${brand.displayName}, a traseira pode envolver vidro, aro de câmera, MagSafe/carga por indução e vedação. ` +
                `O processo prioriza acabamento, alinhamento e testes de câmera e carregamento no ${deviceLabel}.`
            )
        }
    }

    if (serviceSlug === 'troca-de-bateria') {
        if (brand.slug === 'motorola') {
            return normalizeSpaces(
                `Em ${brand.displayName}, é comum a queda de autonomia aparecer junto de aquecimento ou carga instável. ` +
                `Além da bateria, checamos linha de carga e comportamento do TurboPower para evitar retorno do sintoma no ${deviceLabel}.`
            )
        }
        if (brand.slug === 'xiaomi') {
            return normalizeSpaces(
                `Em ${brand.displayName}, consumo em MIUI e uso de 5G podem acelerar degradação. ` +
                `A troca considera segurança do conjunto e testes de carga/temperatura para manter o ${deviceLabel} estável no dia a dia.`
            )
        }
    }

    return normalizeSpaces(
        `Esta rota detalha ${service.name.toLowerCase()} para ${deviceType.displayName} ${brand.displayName} com foco em ${profile.technicalFocus}. ` +
        `O conteúdo varia por construção do aparelho e série (${profile.series.join(', ')}).`
    )
}

function getIntro(service: Service, brand: Brand, deviceType: DeviceType, model?: Model) {
    const profile = getBrandProfile(brand)
    const deviceLabel = getDeviceLabel(brand, deviceType, model)
    const compact = compactService(service)

    if (service.slug === 'troca-de-camera') {
        if (brand.slug === 'motorola') {
            return normalizeSpaces(
                `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. ` +
                `Na ${brand.displayName}, é comum o defeito envolver módulo completo (sensor+lente) e flex — especialmente nas linhas ${profile.series.join(' / ')}. ` +
                `Por isso o diagnóstico separa falha de OIS, foco e conector antes de substituir o conjunto.`
            )
        }

        if (brand.slug === 'samsung') {
            return normalizeSpaces(
                `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. ` +
                `Em Galaxy, sintomas como “Falha na câmera”, tremor por OIS e alternância de lentes quebrada apontam para módulo/flex ou sensor instável. ` +
                `O conteúdo desta rota cobre esses cenários com foco em famílias ${profile.series.join(' / ')}.`
            )
        }

        if (brand.slug === 'apple') {
            return normalizeSpaces(
                `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. ` +
                `No ecossistema iOS, a câmera envolve recursos integrados (retrato, vídeo, sensores auxiliares) e, na frontal, pode coexistir com o TrueDepth. ` +
                `Aqui o enfoque é validar funcionalidades reais após o serviço, sem atalhos.`
            )
        }

        if (brand.slug === 'xiaomi') {
            return normalizeSpaces(
                `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. ` +
                `Em Xiaomi/Redmi/Poco, falhas intermitentes podem aparecer como travamento do app, foco instável ou lente que não abre. ` +
                `Nesta rota o texto diferencia sintomas de MIUI vs. defeito físico no módulo/flex.`
            )
        }
    }

    if (service.slug === 'troca-de-vidro-tampa-traseira') {
        if (brand.slug === 'apple') {
            return normalizeSpaces(
                `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. ` +
                `Avaliamos vidro traseiro, aro de câmera, acabamento e compatibilidade com recursos como MagSafe/carga por indução quando presentes. ` +
                `A rota cobre troca de tampa traseira com foco em encaixe, vedação e aparência original.`
            )
        }

        if (brand.slug === 'samsung') {
            return normalizeSpaces(
                `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. ` +
                `Em Galaxy, trincas no back glass podem comprometer vedação, câmeras e acabamento. ` +
                `Aqui o foco é restaurar a traseira com alinhamento correto e fechamento sem frestas.`
            )
        }
    }

    return normalizeSpaces(
        `${compact} em ${city} para ${deviceLabel} ${brand.displayName}. `
    )
}

function buildTitle(service: Service, brand: Brand, deviceType: DeviceType, model?: Model) {
    const s = compactService(service)
    const device = getDeviceLabel(brand, deviceType, model)

    const base = `${s} ${device} ${brand.displayName} BH`
    const withBrand = ensureTitle(base)

    if (withBrand.length <= 48) return ensureTitle(`${withBrand} | Conectize`)
    return withBrand
}

function buildDescription(service: Service, brand: Brand, deviceType: DeviceType, model?: Model) {
    const s = compactService(service)
    const device = getDeviceLabel(brand, deviceType, model)
    const profile = getBrandProfile(brand)

    if (service.slug === 'troca-de-camera' && brand.slug === 'samsung') {
        return ensureDescription(
            `${s} em ${city} para ${device}. Testamos OIS, foco e alternância de lentes em Galaxy S/A, checando módulo e flex. Corrige tremor, falha no app e imagem preta.`
        )
    }

    if (service.slug === 'troca-de-camera' && brand.slug === 'motorola') {
        return ensureDescription(
            `${s} em ${city} para ${device}. Avaliamos módulo, flex e comportamento do OIS em Moto G/Edge. Ideal para foco travando, câmera tremendo, névoa e erro intermitente.`
        )
    }

    if (service.slug === 'troca-de-camera' && brand.slug === 'apple') {
        return ensureDescription(
            `${s} em ${city} para ${device}. Validamos recursos do iOS (foco, vídeo, retrato) e checamos flex/conectores. Na frontal, cuidamos do conjunto TrueDepth quando aplicável.`
        )
    }

    if (service.slug === 'troca-de-vidro-tampa-traseira' && brand.slug === 'apple') {
        return ensureDescription(
            `${s} em ${city} para ${device}. Trocamos vidro traseiro/tampa, alinhamos câmera e validamos acabamento, encaixe e carga por indução quando aplicável.`
        )
    }

    if (service.slug === 'troca-de-vidro-tampa-traseira' && brand.slug === 'samsung') {
        return ensureDescription(
            `${s} em ${city} para ${device}. Corrige back glass trincado, tampa soltando e frestas, com checagem de câmera, vedação e acabamento em Galaxy.`
        )
    }

    if (service.slug === 'troca-de-tela' && brand.slug === 'samsung') {
        return ensureDescription(
            `Troca de tela em ${city} para ${device}. Processo pensado para AMOLED: brilho, toque e alinhamento do conjunto. Indicado para manchas, linhas e ghost touch em Galaxy.`
        )
    }

    if (service.slug === 'troca-de-bateria' && brand.slug === 'apple') {
        return ensureDescription(
            `Troca de bateria em ${city} para ${device}. Corrige desligamentos, aquecimento e autonomia baixa com testes de carga e estabilidade. Ideal para iPhone com queda brusca de porcentagem.`
        )
    }

    return ensureDescription(
        `${s} em ${city} para ${device} ${brand.displayName}. Conteúdo voltado a ${profile.angle}, com sinais comuns, processo detalhado e FAQ específico desta rota.`
    )
}

export function generateProgrammaticContent(input: Input): ProgrammaticContent {
    const { service, brand, deviceType, model } = input
    const deviceLabel = getDeviceLabel(brand, deviceType, model)

    const h1 = model
        ? `${service.name} ${brand.displayName} ${deviceLabel} em ${city}`
        : `${service.name} ${brand.displayName} ${deviceLabel} em ${city}`

    return {
        title: buildTitle(service, brand, deviceType, model),
        description: buildDescription(service, brand, deviceType, model),
        h1,
        sections: {
            intro: getIntro(service, brand, deviceType, model),
            technical: getTechnicalSection(service, brand, deviceType, model),
            problems: getServiceProblems(service, brand, deviceType),
            process: getServiceProcess(service, brand, deviceType, model),
            faq: getFaq(service, brand, deviceType, model)
        }
    }
}

