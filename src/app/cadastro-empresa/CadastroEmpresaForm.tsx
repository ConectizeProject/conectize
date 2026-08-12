'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
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

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_ACCEPT = 'image/jpeg,image/png,image/webp,image/svg+xml'

function isValidDocumentLength (value: string) {
  const length = onlyDigits(value).length
  return length === 11 || length === 14
}

function mapErrorMessage (errorCode: string | null) {
  if (errorCode === 'cnpj_em_uso') return 'Este CPF/CNPJ já está cadastrado.'
  if (errorCode === 'email_em_uso') return 'Este e-mail já está em uso.'
  if (errorCode === 'dados_invalidos') return 'Preencha todos os campos obrigatórios corretamente.'
  if (errorCode === 'logo_invalido') return 'Logo inválido. Use JPG, PNG, WebP ou SVG até 2 MB.'
  if (errorCode === 'config') return 'Serviço indisponível. Tente novamente em instantes.'
  if (errorCode === 'org_falhou') return 'Não foi possível criar a empresa. Tente novamente.'
  return 'Não foi possível concluir o cadastro agora.'
}

export function CadastroEmpresaForm ({ initialError }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(
    initialError ? mapErrorMessage(initialError) : null
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoFileError, setLogoFileError] = useState<string | null>(null)

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [logoFile])

  const validationSchema = useMemo(() => {
    return Yup.object({
      companyName: Yup.string()
        .trim()
        .required('Informe o nome da empresa ou razão social.'),
      cnpj: Yup.string()
        .required('Informe o CPF ou CNPJ.')
        .test('document-length', 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).', (value) => {
          return isValidDocumentLength(value || '')
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
        .test('logo-url', 'Informe uma URL válida (http/https).', (value) => {
          const trimmed = String(value || '').trim()
          if (!trimmed) return true
          try {
            const parsed = new URL(trimmed)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          } catch {
            return false
          }
        }),
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

  function onLogoFileChange (fileList: FileList | null) {
    setLogoFileError(null)
    const file = fileList?.[0] || null
    if (!file) {
      setLogoFile(null)
      return
    }

    if (file.size > LOGO_MAX_BYTES) {
      setLogoFile(null)
      setLogoFileError('A imagem deve ter no máximo 2 MB.')
      return
    }

    const allowed = LOGO_ACCEPT.split(',')
    if (file.type && !allowed.includes(file.type)) {
      setLogoFile(null)
      setLogoFileError('Use JPG, PNG, WebP ou SVG.')
      return
    }

    setLogoFile(file)
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={async (values, formik) => {
        setServerError(null)
        setLogoFileError(null)

        try {
          const formData = new FormData()
          formData.set('companyName', values.companyName.trim())
          formData.set('cnpj', onlyDigits(values.cnpj))
          formData.set('fullName', values.fullName.trim())
          formData.set('email', values.email.trim().toLowerCase())
          formData.set('password', values.password)
          formData.set('passwordConfirm', values.passwordConfirm)
          formData.set('logoUrl', logoFile ? '' : values.logoUrl.trim())
          if (logoFile) {
            formData.set('logoFile', logoFile)
          }

          const response = await fetch('/api/public/register-organization', {
            method: 'POST',
            body: formData,
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
            <Label htmlFor='companyName'>Nome da empresa / razão social</Label>
            <Input
              id='companyName'
              name='companyName'
              placeholder='Sua assistência ou loja'
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
            <Label htmlFor='cnpj'>CPF ou CNPJ</Label>
            <Input
              id='cnpj'
              name='cnpj'
              type='text'
              inputMode='numeric'
              autoComplete='off'
              maxLength={18}
              placeholder='000.000.000-00 ou 00.000.000/0000-00'
              value={formik.values.cnpj}
              onChange={(event) => {
                formik.setFieldValue('cnpj', formatCpfCnpj(event.target.value))
              }}
              onBlur={(event) => {
                formik.setFieldValue('cnpj', formatCpfCnpj(event.target.value))
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

          <div className='space-y-3 rounded-md border p-3'>
            <div className='space-y-1'>
              <Label htmlFor='logoFile'>Logo (opcional)</Label>
              <p className='text-xs text-muted-foreground'>
                Envie uma imagem (até 2 MB) ou informe uma URL. Se enviar arquivo, ele tem prioridade.
              </p>
            </div>

            <Input
              id='logoFile'
              name='logoFile'
              type='file'
              accept={LOGO_ACCEPT}
              onChange={(event) => {
                onLogoFileChange(event.target.files)
              }}
            />

            {logoFileError ? (
              <p className='text-sm text-destructive'>{logoFileError}</p>
            ) : null}

            {logoPreviewUrl ? (
              <div className='flex items-center gap-3'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreviewUrl}
                  alt='Prévia do logo'
                  className='h-14 w-14 rounded-md border object-contain bg-background'
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setLogoFile(null)
                    setLogoFileError(null)
                  }}
                >
                  Remover imagem
                </Button>
              </div>
            ) : null}

            <div className='space-y-2'>
              <Label htmlFor='logoUrl'>Ou URL do logo</Label>
              <Input
                id='logoUrl'
                name='logoUrl'
                type='url'
                placeholder='https://...'
                disabled={Boolean(logoFile)}
                value={formik.values.logoUrl}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                aria-invalid={Boolean(formik.touched.logoUrl && formik.errors.logoUrl)}
              />
              {formik.touched.logoUrl && formik.errors.logoUrl ? (
                <p className='text-sm text-destructive'>{formik.errors.logoUrl}</p>
              ) : null}
            </div>
          </div>

          {serverError ? (
            <p className='text-sm text-destructive'>{serverError}</p>
          ) : null}

          <Button type='submit' className='w-full' disabled={formik.isSubmitting || Boolean(logoFileError)}>
            {formik.isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>
      )}
    </Formik>
  )
}
