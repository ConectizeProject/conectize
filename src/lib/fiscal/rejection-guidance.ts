export type FiscalRejectionGuidance = {
  summary: string
  hint: string
  href?: string
  hrefLabel?: string
}

export function fiscalRejectionGuidance (
  statusCode: string | null | undefined,
  environment?: string | null,
): FiscalRejectionGuidance | null {
  const code = String(statusCode || '').trim()
  const isHomologacao = environment !== 'producao'

  if (code === '230') {
    return {
      summary: 'A IE preenchida no Conectize foi enviada no XML. A rejeição 230 significa que a SEFAZ da UF não tem essa IE no cadastro dela — não no nosso formulário.',
      hint: isHomologacao
        ? 'Homologação e produção são cadastros diferentes. Confira se o CNPJ/IE estão credenciados para NFC-e no ambiente de teste da SEFAZ da UF (portal da fazenda, não nesta tela).'
        : 'Confira se o CNPJ/IE estão no CAD-ICMS e credenciados para NFC-e na SEFAZ da UF. Só reenviar a nota não cadastra a IE lá.',
      href: '/portal/admin/dados-empresa/fiscal',
      hrefLabel: 'Ver CNPJ, IE e ambiente enviados',
    }
  }

  if (code === '385') {
    return {
      summary: 'A SEFAZ exige o número da FCI no XML para itens com origem 3, 5 ou 8.',
      hint: 'Preencha o FCI (UUID) no cadastro do produto ou nesta nota e reenvie. O campo só aparece nessas origens.',
    }
  }

  if (code === '806' || code === '814' || code === '815') {
    return {
      summary: 'A SEFAZ recusou o CEST em relação ao NCM do item.',
      hint: code === '806'
        ? 'Esta operação de ST exige CEST. Preencha um CEST válido para o NCM do produto.'
        : 'Use um CEST da tabela do NCM ou deixe em branco se o NCM não estiver na tabela de Substituição Tributária.',
    }
  }

  if (code === '391') {
    return {
      summary: 'A SEFAZ exige o grupo card (tpIntegra) para crédito, débito e PIX (NT 2024.003).',
      hint: 'O Conectize envia pagamento eletrônico como não integrado (tpIntegra 2). Corrija a forma de pagamento nesta tela se estiver errada e reenvie.',
    }
  }

  if (code === '229') {
    return {
      summary: 'A IE do emitente está marcada como isenta, mas a SEFAZ exige inscrição cadastrada.',
      hint: 'Desmarque “Isento” em Dados da empresa e informe a IE do CAD-ICMS.',
      href: '/portal/admin/dados-empresa/fiscal',
      hrefLabel: 'Abrir dados fiscais',
    }
  }

  if (code === '215') {
    return {
      summary: 'A SEFAZ recusou o XML porque algum campo foge do leiaute (tamanho, formato ou caractere).',
      hint: 'O caso mais comum é o nome do destinatário com mais de 60 caracteres. Encurte o nome (e a descrição do item, máx. 120) e reenvie — o mesmo número será reutilizado.',
    }
  }

  if (code === '501') {
    return {
      summary: 'A SEFAZ recusou o cancelamento porque o prazo legal já passou.',
      hint: 'NFC-e: 30 minutos após a autorização. NF-e: 24 horas. Em MG a NFC-e não tem cancelamento extemporâneo; depois do prazo a via é denúncia espontânea na AF ou nota de devolução.',
    }
  }

  return null
}
