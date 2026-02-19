'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { portalFetch } from '@/lib/portal/portal-fetch'

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

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  const p1 = digits.slice(0, 3)
  const p2 = digits.slice(3, 6)
  const p3 = digits.slice(6, 9)
  const p4 = digits.slice(9, 11)
  const head = [p1, p2, p3].filter(Boolean).join('.')
  if (p4) return `${head}-${p4}`
  return head
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14)
  const p1 = digits.slice(0, 2)
  const p2 = digits.slice(2, 5)
  const p3 = digits.slice(5, 8)
  const p4 = digits.slice(8, 12)
  const p5 = digits.slice(12, 14)

  const head = [p1, p2, p3].filter(Boolean).join('.')
  if (!head) return ''

  if (p4) {
    if (p5) return `${head}/${p4}-${p5}`
    return `${head}/${p4}`
  }
  return head
}

function formatCpfCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14)
  if (digits.length <= 11) return formatCpf(digits)
  return formatCnpj(digits)
}

function formatPhoneBr(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (!ddd) return rest

  if (rest.length <= 8) {
    const p1 = rest.slice(0, 4)
    const p2 = rest.slice(4, 8)
    return `(${ddd}) ${[p1, p2].filter(Boolean).join('-')}`.trim()
  }

  const p1 = rest.slice(0, 1)
  const p2 = rest.slice(1, 5)
  const p3 = rest.slice(5, 9)
  return `(${ddd}) ${p1} ${[p2, p3].filter(Boolean).join('-')}`.trim()
}

function normalizeZipCode(value: string) {
  return onlyDigits(value).slice(0, 8)
}

function formatZipCode(value: string) {
  const digits = normalizeZipCode(value)
  const p1 = digits.slice(0, 5)
  const p2 = digits.slice(5, 8)
  if (!p1) return ''
  return p2 ? `${p1}-${p2}` : p1
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
    let cancelled = false
    const zip = normalizeZipCode(zipCode)

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
      } catch (err) {
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
  }, [zipCode])

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

  async function handleSave() {
    if (!canSave) return
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const payload = {
        id: isEdit ? String(props.customer?.id || '') : undefined,
        isCompany,
        document: documentDigits,
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        tradeName: tradeName.trim(),
        email: email.trim(),
        mobilePhone: mobilePhone.trim(),
        contactPhone: contactPhone.trim(),
        contactNotes: contactNotes.trim(),
        zipCode: normalizeZipCode(zipCode),
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

      const res = await portalFetch('/api/portal/customers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.id) {
        if (data?.error === 'already_exists') {
          setErrorMessage('Este cliente já está cadastrado.')
          return
        }
        if (data?.error === 'document_locked') {
          setErrorMessage('CPF/CNPJ não pode ser alterado após cadastrado.')
          return
        }
        setErrorMessage('Não foi possível criar o cliente.')
        return
      }

      const addressFull = buildAddressFull({
        zipCode: normalizeZipCode(zipCode),
        state,
        city,
        neighborhood,
        street,
        streetNumber,
        streetComplement
      })

      props.onCreated({
        id: String(data.id),
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
        zip_code: normalizeZipCode(zipCode) || null,
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
    } catch (err) {
      setErrorMessage('Não foi possível criar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
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
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Conectize LTDA" />
              </div>
            ) : null}

            {isCompany ? (
              <div className="space-y-2">
                <Label htmlFor="tradeName">Nome fantasia (opcional)</Label>
                <Input id="tradeName" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Ex: Conectize" />
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
                <Input id="mobilePhone" value={mobilePhone} onChange={(e) => setMobilePhone(formatPhoneBr(e.target.value))} placeholder="(31) 9 0000-0000" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contato alternativo</Label>
              <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(formatPhoneBr(e.target.value))} placeholder="(31) 0000-0000" inputMode="numeric" />
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
                  value={formatZipCode(zipCode)}
                  onChange={(e) => setZipCode(formatZipCode(e.target.value))}
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
  )
}
