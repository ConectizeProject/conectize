'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatCepBr } from '@/lib/utils/format-cep'
import { onlyDigits } from '@/lib/utils/strings'

export type CustomerHit = {
  id: string
  cpf: string | null
  full_name: string | null
  cnpj?: string | null
  is_company?: boolean | null
  company_name?: string | null
  trade_name?: string | null
  email?: string | null
  phone?: string | null
  mobile_phone?: string | null
  contact_phone?: string | null
  contact_notes?: string | null
  address_full?: string | null
  zip_code?: string | null
  state?: string | null
  city?: string | null
  neighborhood?: string | null
  street?: string | null
  street_number?: string | null
  street_complement?: string | null
  birth_date?: string | null
  referral_source?: string | null
  referral_source_other?: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDocumentDigits: string
  mode?: 'create' | 'edit'
  customer?: CustomerHit | null
  onCreated: (customer: CustomerHit) => void
}

function buildAddressFull(addr: {
  zipCode?: string
  state?: string
  city?: string
  neighborhood?: string
  street?: string
  streetNumber?: string
  streetComplement?: string
}) {
  const zip = String(addr.zipCode || '').trim()
  const state = String(addr.state || '').trim()
  const city = String(addr.city || '').trim()
  const neighborhood = String(addr.neighborhood || '').trim()
  const street = String(addr.street || '').trim()
  const number = String(addr.streetNumber || '').trim()
  const complement = String(addr.streetComplement || '').trim()

  const parts: string[] = []
  if (street) parts.push(number ? `${street}, ${number}` : street)
  if (complement) parts.push(complement)
  if (neighborhood) parts.push(neighborhood)
  if (city || state) parts.push([city, state].filter(Boolean).join(' / '))
  if (zip) parts.push(`CEP ${zip}`)
  return parts.join('\n').trim()
}

export function CreateCustomerDialog(props: Props) {
  const seedDigits = useMemo(() => onlyDigits(props.initialDocumentDigits).slice(0, 14), [props.initialDocumentDigits])
  const mode = props.mode || 'create'
  const isEdit = mode === 'edit'

  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [existingCustomerIdToUpdate, setExistingCustomerIdToUpdate] = useState<string | null>(null)
  const [duplicatePending, setDuplicatePending] = useState<null | 'fetch' | 'patch'>(null)

  const [document, setDocument] = useState('')
  const [isCompany, setIsCompany] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [fullName, setFullName] = useState('')

  const [email, setEmail] = useState('')
  const [mobilePhone, setMobilePhone] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactNotes, setContactNotes] = useState('')

  const [birthDate, setBirthDate] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [referralSourceOther, setReferralSourceOther] = useState('')

  const [zipCode, setZipCode] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [street, setStreet] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [streetComplement, setStreetComplement] = useState('')

  const [isLookingUpZipCode, setIsLookingUpZipCode] = useState(false)
  const [zipCodeLookupError, setZipCodeLookupError] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) return

    const baseDigits = isEdit
      ? onlyDigits(String(props.customer?.cnpj || props.customer?.cpf || seedDigits)).slice(0, 14)
      : seedDigits

    const masked = formatCpfCnpj(baseDigits)
    setDocument(masked)
    setIsCompany(baseDigits.length > 11)

    setCompanyName(isEdit ? String(props.customer?.company_name || '') : '')
    setTradeName(isEdit ? String(props.customer?.trade_name || '') : '')
    setFullName(isEdit ? String(props.customer?.full_name || '') : '')

    setEmail(isEdit ? String(props.customer?.email || '') : '')
    setMobilePhone(isEdit ? String(props.customer?.mobile_phone || '') : '')
    setContactPhone(isEdit ? String(props.customer?.contact_phone || '') : '')
    setContactNotes(isEdit ? String(props.customer?.contact_notes || '') : '')

    setBirthDate(isEdit ? String(props.customer?.birth_date || '') : '')
    setReferralSource(isEdit ? String(props.customer?.referral_source || '') : '')
    setReferralSourceOther(isEdit ? String(props.customer?.referral_source_other || '') : '')

    setZipCode(isEdit ? String(props.customer?.zip_code || '') : '')
    setState(isEdit ? String(props.customer?.state || '') : '')
    setCity(isEdit ? String(props.customer?.city || '') : '')
    setNeighborhood(isEdit ? String(props.customer?.neighborhood || '') : '')
    setStreet(isEdit ? String(props.customer?.street || '') : '')
    setStreetNumber(isEdit ? String(props.customer?.street_number || '') : '')
    setStreetComplement(isEdit ? String(props.customer?.street_complement || '') : '')

    setZipCodeLookupError(null)
    setErrorMessage(null)
  }, [isEdit, props.customer, props.open, seedDigits])

  useEffect(() => {
    // No cadastro novo, preenche logradouro/bairro/cidade pelo CEP.
    // Na edição, não consultar ViaCEP: a resposta sobrescreve bairro/rua do cliente
    // (e muitas vezes vem vazia), fazendo parecer que alterações não persistem.
    if (isEdit) {
      setZipCodeLookupError(null)
      setIsLookingUpZipCode(false)
      return
    }

    let cancelled = false
    const zip = onlyDigits(zipCode).slice(0, 8)

    async function run() {
      setZipCodeLookupError(null)
      setIsLookingUpZipCode(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data || data.erro) {
          if (!cancelled) setZipCodeLookupError('CEP não encontrado.')
          return
        }
        if (cancelled) return
        setStreet(String(data.logradouro || ''))
        setNeighborhood(String(data.bairro || ''))
        setCity(String(data.localidade || ''))
        setState(String(data.uf || ''))
      } catch {
        if (!cancelled) setZipCodeLookupError('Não foi possível buscar o CEP agora.')
      } finally {
        if (!cancelled) setIsLookingUpZipCode(false)
      }
    }

    if (zip.length !== 8) {
      setZipCodeLookupError(null)
      setIsLookingUpZipCode(false)
      return
    }

    run()
    return () => { cancelled = true }
  }, [isEdit, zipCode])

  const documentDigits = useMemo(() => onlyDigits(document).slice(0, 14), [document])

  useEffect(() => {
    if (!props.open) return
    if (documentDigits.length > 11) setIsCompany(true)
    if (documentDigits.length > 0 && documentDigits.length <= 11) setIsCompany(false)
  }, [documentDigits, props.open])

  const canSave = useMemo(() => {
    if (isCompany) return documentDigits.length === 14 && Boolean(companyName.trim())
    return documentDigits.length === 11 && Boolean(fullName.trim())
  }, [companyName, documentDigits.length, fullName, isCompany])

  function buildRequestBody(patchCustomerId?: string) {
    const id =
      patchCustomerId ?? (isEdit ? String(props.customer?.id || '') : undefined)
    return {
      ...(id ? { id } : {}),
      isCompany,
      document: documentDigits,
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      tradeName: tradeName.trim(),
      email: email.trim(),
      mobilePhone: mobilePhone.trim(),
      contactPhone: contactPhone.trim(),
      contactNotes: contactNotes.trim(),
      zipCode: onlyDigits(zipCode).slice(0, 8),
      state: state.trim(),
      city: city.trim(),
      neighborhood: neighborhood.trim(),
      street: street.trim(),
      streetNumber: streetNumber.trim(),
      streetComplement: streetComplement.trim(),
      birthDate: birthDate.trim(),
      referralSource: referralSource.trim(),
      referralSourceOther: referralSourceOther.trim(),
    }
  }

  function emitCreatedAndClose(customerId: string) {
    const addressFull = buildAddressFull({
      zipCode: onlyDigits(zipCode).slice(0, 8),
      state,
      city,
      neighborhood,
      street,
      streetNumber,
      streetComplement
    })

    props.onCreated({
      id: customerId,
      cpf: isCompany ? null : documentDigits,
      cnpj: isCompany ? documentDigits : null,
      is_company: isCompany,
      full_name: fullName.trim() || null,
      company_name: companyName.trim() || null,
      trade_name: tradeName.trim() || null,
      email: email.trim() || null,
      mobile_phone: mobilePhone.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_notes: contactNotes.trim() || null,
      address_full: addressFull || null,
      zip_code: onlyDigits(zipCode).slice(0, 8) || null,
      state: state.trim() || null,
      city: city.trim() || null,
      neighborhood: neighborhood.trim() || null,
      street: street.trim() || null,
      street_number: streetNumber.trim() || null,
      street_complement: streetComplement.trim() || null,
      birth_date: birthDate.trim() || null,
      referral_source: referralSource.trim() || null,
      referral_source_other: referralSourceOther.trim() || null,
    })

    props.onOpenChange(false)
  }

  async function handleSave() {
    if (!canSave) return
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const res = await portalFetch('/api/portal/customers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.id) {
        if (data?.error === 'already_exists') {
          const existingId =
            data.existingCustomerId != null
              ? String(data.existingCustomerId)
              : ''
          if (existingId) {
            setExistingCustomerIdToUpdate(existingId)
            setDuplicateDialogOpen(true)
            return
          }
          setErrorMessage(
            'Este CPF/CNPJ já está cadastrado, mas não foi possível localizar o cliente nesta loja. Atualize a página e busque novamente.',
          )
          return
        }
        if (data?.error === 'document_locked') {
          setErrorMessage('CPF/CNPJ não pode ser alterado após cadastrado.')
          return
        }
        if (data?.error === 'rls_forbidden') {
          setErrorMessage('Sem permissão para cadastrar este cliente nesta loja.')
          return
        }
        if (data?.error === 'missing_required') {
          setErrorMessage(
            String(data.message || data.details || 'Campo obrigatório ausente.'),
          )
          return
        }
        const detail = [data?.message, data?.details, data?.hint, data?.code]
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .join(' — ')
        setErrorMessage(
          detail
            ? `Não foi possível criar o cliente. ${detail}`
            : 'Não foi possível criar o cliente.',
        )
        return
      }

      emitCreatedAndClose(String(data.id))
    } catch {
      setErrorMessage('Não foi possível criar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmUpdateExistingCustomer() {
    const customerId = existingCustomerIdToUpdate
    if (!customerId) return
    setDuplicatePending('patch')
    setErrorMessage(null)
    setDuplicateDialogOpen(false)

    try {
      const res = await portalFetch('/api/portal/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(customerId)),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.id) {
        if (data?.error === 'document_locked') {
          setErrorMessage('CPF/CNPJ não pode ser alterado após cadastrado.')
          return
        }
        setErrorMessage('Não foi possível atualizar o cliente.')
        return
      }

      emitCreatedAndClose(String(data.id))
    } catch {
      setErrorMessage('Não foi possível atualizar o cliente.')
    } finally {
      setDuplicatePending(null)
    }
  }

  async function handleUseExistingCustomerFromBase() {
    const customerId = existingCustomerIdToUpdate
    if (!customerId) return
    setDuplicatePending('fetch')
    setErrorMessage(null)
    setDuplicateDialogOpen(false)

    try {
      const res = await portalFetch(
        `/api/portal/customers/${encodeURIComponent(customerId)}`,
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.customer) {
        setErrorMessage('Não foi possível carregar o cadastro existente.')
        return
      }

      const c = data.customer as Record<string, unknown>
      props.onCreated({
        id: String(c.id),
        cpf: c.cpf != null ? String(c.cpf) : null,
        cnpj: c.cnpj != null ? String(c.cnpj) : null,
        is_company: Boolean(c.is_company),
        full_name: c.full_name != null ? String(c.full_name) : null,
        company_name: c.company_name != null ? String(c.company_name) : null,
        trade_name: c.trade_name != null ? String(c.trade_name) : null,
        email: c.email != null ? String(c.email) : null,
        phone: c.phone != null ? String(c.phone) : null,
        mobile_phone: c.mobile_phone != null ? String(c.mobile_phone) : null,
        contact_phone: c.contact_phone != null ? String(c.contact_phone) : null,
        contact_notes: c.contact_notes != null ? String(c.contact_notes) : null,
        address_full: c.address_full != null ? String(c.address_full) : null,
        zip_code: c.zip_code != null ? String(c.zip_code) : null,
        state: c.state != null ? String(c.state) : null,
        city: c.city != null ? String(c.city) : null,
        neighborhood: c.neighborhood != null ? String(c.neighborhood) : null,
        street: c.street != null ? String(c.street) : null,
        street_number: c.street_number != null ? String(c.street_number) : null,
        street_complement: c.street_complement != null ? String(c.street_complement) : null,
        birth_date: c.birth_date != null ? String(c.birth_date) : null,
        referral_source: c.referral_source != null ? String(c.referral_source) : null,
        referral_source_other: c.referral_source_other != null ? String(c.referral_source_other) : null,
      })
      props.onOpenChange(false)
    } catch {
      setErrorMessage('Não foi possível carregar o cadastro existente.')
    } finally {
      setDuplicatePending(null)
    }
  }

  return (
    <>
    <AlertDialog
      open={duplicateDialogOpen}
      onOpenChange={(open) => {
        setDuplicateDialogOpen(open)
        if (!open) setExistingCustomerIdToUpdate(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isCompany ? 'CNPJ já cadastrado' : 'CPF já cadastrado'}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Documento já existe na base. Você pode usar o cadastro salvo ou atualizar com os
            dados deste formulário.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Já existe um cliente com este documento na base. Escolha uma opção:
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <span className="font-medium text-foreground">Usar dados da base</span>
              {' — '}
              segue com o cadastro já salvo no sistema (o que você digitou agora não será
              aplicado).
            </li>
            <li>
              <span className="font-medium text-foreground">Atualizar cadastro</span>
              {' — '}
              substitui os dados do cliente pelas informações deste formulário.
            </li>
          </ul>
        </div>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <AlertDialogCancel type="button" className="w-full sm:w-auto">
            Voltar ao formulário
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void handleUseExistingCustomerFromBase()}
            disabled={duplicatePending !== null}
          >
            {duplicatePending === 'fetch' ? 'Carregando…' : 'Usar dados da base'}
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void handleConfirmUpdateExistingCustomer()}
            disabled={duplicatePending !== null}
          >
            {duplicatePending === 'patch' ? 'Salvando…' : 'Atualizar com o formulário'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Cadastrar cliente'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Altere os dados do cliente. O CPF/CNPJ não pode ser alterado.'
              : 'Preencha os dados do cliente. O tipo (CPF/CNPJ) é detectado automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerDocument">CPF/CNPJ<span className="text-destructive"> *</span></Label>
              <Input
                id="customerDocument"
                value={document}
                onChange={(e) => {
                  if (isEdit) return
                  setDocument(formatCpfCnpj(e.target.value))
                }}
                readOnly={isEdit}
                disabled={isEdit}
                placeholder={isCompany ? '00.000.000/0000-00' : '000.000.000-00'}
                inputMode="numeric"
                className={isEdit ? 'bg-muted' : ''}
              />
              {isEdit ? (
                <p className="text-xs text-muted-foreground">CPF/CNPJ não pode ser alterado após o cadastro.</p>
              ) : null}
            </div>

            {isCompany ? (
              <div className="space-y-2">
                <Label htmlFor="companyName">Razão social<span className="text-destructive"> *</span></Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Razão social LTDA" />
              </div>
            ) : null}

            {isCompany ? (
              <div className="space-y-2">
                <Label htmlFor="tradeName">Nome fantasia (opcional)</Label>
                <Input id="tradeName" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Ex: Nome fantasia" />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="fullName">
                {isCompany ? 'Nome do contato (opcional)' : 'Nome completo'}
                {!isCompany ? <span className="text-destructive"> *</span> : null}
              </Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={isCompany ? 'Ex: Maria Souza' : 'Nome completo'} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerEmail">E-mail</Label>
              <Input id="customerEmail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mobilePhone">Celular</Label>
                <Input id="mobilePhone" value={mobilePhone} onChange={(e) => setMobilePhone(formatPhoneBr(e.target.value) ?? '')} placeholder="(31) 9 0000-0000" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contato alternativo</Label>
              <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(formatPhoneBr(e.target.value) ?? '')} placeholder="(31) 0000-0000" inputMode="numeric" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactNotes">Informações de contato</Label>
              <Textarea id="contactNotes" value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} placeholder="Preferência de horário, responsável, referências, etc." />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  value={formatCepBr(zipCode)}
                  onChange={(e) => setZipCode(formatCepBr(e.target.value))}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
                {zipCodeLookupError ? (
                  <p className="text-xs text-destructive">{zipCodeLookupError}</p>
                ) : null}
                {!zipCodeLookupError && isLookingUpZipCode ? (
                  <p className="text-xs text-muted-foreground">Buscando endereço…</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="state">Estado (UF)</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Logradouro" />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="streetNumber">Número</Label>
                <Input id="streetNumber" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} placeholder="Número" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="streetComplement">Complemento</Label>
                <Input id="streetComplement" value={streetComplement} onChange={(e) => setStreetComplement(e.target.value)} placeholder="Apto, bloco, sala..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referralSource">Como conheceu a empresa?</Label>
              <select
                id="referralSource"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
              >
                <option value="">Selecione…</option>
                <option value="google">Google</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="rua">Vi a loja na rua</option>
                <option value="instagram">Instagram</option>
                <option value="indicacao">Indicação</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {referralSource === 'outros' ? (
              <div className="space-y-2">
                <Label htmlFor="referralSourceOther">Qual?</Label>
                <Input id="referralSourceOther" value={referralSourceOther} onChange={(e) => setReferralSourceOther(e.target.value)} placeholder="Digite aqui" />
              </div>
            ) : null}

          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Salvando…' : 'Salvar cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
