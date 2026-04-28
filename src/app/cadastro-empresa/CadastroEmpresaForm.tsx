'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'

type Props = {
  initialError?: string
}

type FormValues = {
  companyName: string
  cnpj: string
  fullName: string
  email: string
  password: string
  passwordConfirm: string
  logoUrl: string
}

function mapErrorMessage (errorCode: string | null) {
  if (errorCode === 'cnpj_em_uso') return 'Este CNPJ já está cadastrado.'
  if (errorCode === 'email_em_uso') return 'Este e-mail já está em uso.'
  if (errorCode === 'dados_invalidos') return 'Preencha todos os campos obrigatórios corretamente.'
  if (errorCode === 'config') return 'Serviço indisponível. Tente novamente em instantes.'
  if (errorCode === 'org_falhou') return 'Não foi possível criar a empresa. Tente novamente.'
  return 'Não foi possível concluir o cadastro agora.'
}

export function CadastroEmpresaForm ({ initialError }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(
    initialError ? mapErrorMessage(initialError) : null
  )

  const validationSchema = useMemo(() => {
    return Yup.object({
      companyName: Yup.string()
        .trim()
        .required('Informe a razão social.'),
      cnpj: Yup.string()
        .required('Informe o CNPJ.')
        .test('cnpj-length', 'Informe um CNPJ com 14 dígitos.', (value) => {
          return onlyDigits(value || '').length === 14
        }),
      fullName: Yup.string()
        .trim()
        .required('Informe seu nome.'),
      email: Yup.string()
        .trim()
        .email('Informe um e-mail válido.')
        .required('Informe o e-mail.'),
      password: Yup.string()
        .min(8, 'A senha deve ter pelo menos 8 caracteres.')
        .required('Informe a senha.'),
      passwordConfirm: Yup.string()
        .required('Confirme a senha.')
        .oneOf([Yup.ref('password')], 'As senhas não conferem.'),
      logoUrl: Yup.string()
        .trim()
        .url('Informe uma URL válida (http/https).')
        .notRequired(),
    })
  }, [])

  const initialValues = useMemo<FormValues>(() => {
    return {
      companyName: '',
      cnpj: '',
      fullName: '',
      email: '',
      password: '',
      passwordConfirm: '',
      logoUrl: '',
    }
  }, [])

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={async (values, formik) => {
        setServerError(null)

        try {
          const response = await fetch('/api/public/register-organization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: values.companyName.trim(),
              cnpj: onlyDigits(values.cnpj),
              fullName: values.fullName.trim(),
              email: values.email.trim().toLowerCase(),
              password: values.password,
              passwordConfirm: values.passwordConfirm,
              logoUrl: values.logoUrl.trim(),
            }),
          })

          const payload = await response.json().catch(() => null)

          if (!response.ok || !payload?.ok) {
            setServerError(mapErrorMessage(String(payload?.error || 'unknown')))
            return
          }

          router.push('/portal/login?cadastro=empresa')
        } catch {
          setServerError('Não foi possível concluir o cadastro agora. Tente novamente.')
        } finally {
          formik.setSubmitting(false)
        }
      }}
    >
      {(formik) => (
        <form onSubmit={formik.handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='companyName'>Razão social</Label>
            <Input
              id='companyName'
              name='companyName'
              placeholder='Sua assistência Ltda'
              value={formik.values.companyName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.companyName && formik.errors.companyName)}
            />
            {formik.touched.companyName && formik.errors.companyName ? (
              <p className='text-sm text-destructive'>{formik.errors.companyName}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='cnpj'>CNPJ (com máscara)</Label>
            <Input
              id='cnpj'
              name='cnpj'
              type='text'
              inputMode='numeric'
              maxLength={18}
              placeholder='00.000.000/0000-00'
              value={formik.values.cnpj}
              onChange={(event) => {
                formik.setFieldValue('cnpj', formatCnpj(event.target.value))
              }}
              onBlur={(event) => {
                formik.setFieldValue('cnpj', formatCnpj(event.target.value))
                formik.handleBlur(event)
              }}
              aria-invalid={Boolean(formik.touched.cnpj && formik.errors.cnpj)}
            />
            {formik.touched.cnpj && formik.errors.cnpj ? (
              <p className='text-sm text-destructive'>{formik.errors.cnpj}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='fullName'>Seu nome</Label>
            <Input
              id='fullName'
              name='fullName'
              placeholder='Nome do administrador'
              value={formik.values.fullName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.fullName && formik.errors.fullName)}
            />
            {formik.touched.fullName && formik.errors.fullName ? (
              <p className='text-sm text-destructive'>{formik.errors.fullName}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='email'>E-mail (login)</Label>
            <Input
              id='email'
              name='email'
              type='email'
              autoComplete='email'
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
            />
            {formik.touched.email && formik.errors.email ? (
              <p className='text-sm text-destructive'>{formik.errors.email}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='password'>Senha</Label>
            <Input
              id='password'
              name='password'
              type='password'
              autoComplete='new-password'
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.password && formik.errors.password)}
            />
            {formik.touched.password && formik.errors.password ? (
              <p className='text-sm text-destructive'>{formik.errors.password}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='passwordConfirm'>Confirmar senha</Label>
            <Input
              id='passwordConfirm'
              name='passwordConfirm'
              type='password'
              autoComplete='new-password'
              value={formik.values.passwordConfirm}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.passwordConfirm && formik.errors.passwordConfirm)}
            />
            {formik.touched.passwordConfirm && formik.errors.passwordConfirm ? (
              <p className='text-sm text-destructive'>{formik.errors.passwordConfirm}</p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='logoUrl'>URL do logo (opcional)</Label>
            <Input
              id='logoUrl'
              name='logoUrl'
              type='url'
              placeholder='https://...'
              value={formik.values.logoUrl}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.logoUrl && formik.errors.logoUrl)}
            />
            {formik.touched.logoUrl && formik.errors.logoUrl ? (
              <p className='text-sm text-destructive'>{formik.errors.logoUrl}</p>
            ) : null}
          </div>

          {serverError ? (
            <p className='text-sm text-destructive'>{serverError}</p>
          ) : null}

          <Button type='submit' className='w-full' disabled={formik.isSubmitting}>
            {formik.isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>
      )}
    </Formik>
  )
}
