/**
 * Dados para o cliente copiar no cadastro de um aplicativo privado no Bling.
 * Aplicativo privado não passa por homologação.
 */
export const BLING_APP_CREATE_URL = 'https://www.bling.com.br/cadastro.aplicativos.php'

export const BLING_OAUTH_CALLBACK_PATH = '/api/portal/hub/oauth/bling/callback'

export const BLING_APP_REGISTRATION = {
  nome: 'Conectize',
  categoria: 'ERP',
  descricaoCurta: 'Integração do Conectize com produtos, estoque e pedidos de venda.',
  escopos: [
    'Produtos',
    'Estoques',
    'Depósitos',
    'Contatos',
    'Pedidos de Venda',
    'Notas Fiscais de Consumidor',
    'Empresas',
  ],
} as const

export function blingAppScopeList (): string {
  return BLING_APP_REGISTRATION.escopos.join('\n')
}
