import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { OrcamentoFormClient } from '../OrcamentoFormClient'
import { createQuoteAction } from './create-quote-action'

const ERROR_MESSAGES: Record<string, string> = {
  cpf_invalido: 'Informe um CPF válido.',
  cnpj_invalido: 'Informe um CNPJ válido.',
  customer_obrigatorio: 'Selecione um cliente.',
  sem_organizacao: 'Não foi possível identificar a organização.',
  cliente_invalido: 'Cliente inválido.',
  nao_foi_possivel_criar: 'Não foi possível criar o orçamento.',
}

export default async function NovoOrcamentoPage ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  await createSupabaseServerClient()

  return (
    <OrcamentoFormClient
      action={createQuoteAction}
      initialError={error ? ERROR_MESSAGES[error] || error : undefined}
      heading="Novo orçamento"
      submitLabel="Criar orçamento"
    />
  )
}
