'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatCpf } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'

function isValidCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digits = cpf.split('').map(n => Number.parseInt(n, 10))
  if (digits.some(n => Number.isNaN(n))) return false

  const calcCheckDigit = (base: number[]) => {
    const factorStart = base.length + 1
    const sum = base.reduce((acc, n, idx) => acc + (n * (factorStart - idx)), 0)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = calcCheckDigit(digits.slice(0, 9))
  const d2 = calcCheckDigit(digits.slice(0, 9).concat(d1))

  return digits[9] === d1 && digits[10] === d2
}

function getApiErrorMessage(code: string) {
  if (code == 'cpf_invalido') return 'CPF inválido. Confira e tente novamente.'
  if (code == 'cpf_already_claimed') return 'Este CPF já está vinculado a outro acesso.'
  if (code == 'cpf_mismatch') return 'Este CPF não corresponde ao cadastro já vinculado a esta conta.'
  if (code == 'not_authenticated') return 'Sua sessão expirou. Faça login novamente.'
  if (code == 'rpc_missing') return 'Função do banco não encontrada. Verifique se você rodou o SQL no Supabase.'
  if (code == 'db_schema_outdated') return 'Seu banco está desatualizado. Rode o SQL de atualização no Supabase.'
  if (code == 'permission_denied') return 'Sem permissão para concluir esta ação. Verifique as policies no Supabase.'
  return 'Não foi possível vincular seu CPF agora. Tente novamente.'
}

export function CompleteProfileClient(props: { initialError?: string, initialCpf?: string | null, initialFullName?: string | null, isCpfLocked?: boolean }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(props.initialError || null)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const initialValues = useMemo(() => {
    return {
      cpf: props.initialCpf ? formatCpf(props.initialCpf) : '',
      fullName: props.initialFullName || ''
    }
  }, [props.initialCpf, props.initialFullName])

  const schema = useMemo(() => {
    return Yup.object({
      cpf: Yup.string()
        .required('Informe seu CPF.')
        .test('cpf-valid', 'CPF inválido. Confira e tente novamente.', (value) => {
          return isValidCpf(value || '')
        }),
      fullName: Yup.string()
        .max(160, 'Nome muito longo.')
    })
  }, [])

  return (
    <Formik
      initialValues={initialValues}
      enableReinitialize
      validationSchema={schema}
      onSubmit={async (values, formik) => {
        setServerError(null)
        setServerMessage(null)

        try {
          const response = await portalFetch('/api/portal/complete-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cpf: onlyDigits(values.cpf),
              fullName: values.fullName.trim()
            }),
          })

          const payload = await response.json().catch(() => null)
          if (!response.ok || !payload?.ok) {
            const base = getApiErrorMessage(String(payload?.error || 'unknown'))
            if (payload?.debug?.message) {
              setServerError(`${base} (debug: ${String(payload.debug.message)})`)
            } else {
              setServerError(base)
            }
            return
          }

          setServerMessage('Cadastro atualizado. Redirecionando…')
          router.replace('/portal')
        } catch {
          setServerError('Não foi possível salvar agora. Tente novamente.')
        } finally {
          formik.setSubmitting(false)
        }
      }}
    >
      {(formik) => (
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF<span className="text-destructive"> *</span></Label>
            <Input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formik.values.cpf}
              disabled={Boolean(props.isCpfLocked)}
              onChange={(e) => {
                if (props.isCpfLocked) return
                const masked = formatCpf(e.target.value)
                formik.setFieldValue('cpf', masked)
              }}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.cpf && formik.errors.cpf)}
            />
            {formik.touched.cpf && formik.errors.cpf ? (
              <p className="text-sm text-destructive">{formik.errors.cpf}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nome (opcional)</Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Seu nome"
              value={formik.values.fullName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.fullName && formik.errors.fullName)}
            />
            {formik.touched.fullName && formik.errors.fullName ? (
              <p className="text-sm text-destructive">{formik.errors.fullName}</p>
            ) : null}
          </div>

          {serverError ? (
            <p className="text-sm text-destructive">{serverError}</p>
          ) : null}
          {serverMessage ? (
            <p className="text-sm text-muted-foreground">{serverMessage}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? 'Salvando…' : (props.isCpfLocked ? 'Atualizar cadastro' : 'Salvar e continuar')}
          </Button>
        </form>
      )}
    </Formik>
  )
}


