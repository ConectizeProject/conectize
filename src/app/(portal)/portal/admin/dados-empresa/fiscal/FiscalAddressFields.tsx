'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCepBr } from '@/lib/utils/format-cep'
import { onlyDigits } from '@/lib/utils/strings'

export function FiscalAddressFields (props: {
  zipCode?: string | null
  street?: string | null
  number?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  ibgeCityCode?: string | null
  complement?: string | null
}) {
  const [zipCode, setZipCode] = useState(formatCepBr(props.zipCode))
  const [street, setStreet] = useState(String(props.street || ''))
  const [number, setNumber] = useState(String(props.number || ''))
  const [district, setDistrict] = useState(String(props.district || ''))
  const [city, setCity] = useState(String(props.city || ''))
  const [state, setState] = useState(String(props.state || ''))
  const [ibgeCityCode, setIbgeCityCode] = useState(String(props.ibgeCityCode || ''))
  const [complement, setComplement] = useState(String(props.complement || ''))
  const [isLookingUpZipCode, setIsLookingUpZipCode] = useState(false)
  const [zipCodeLookupError, setZipCodeLookupError] = useState<string | null>(null)
  const hasEditedZipCodeRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const zip = onlyDigits(zipCode).slice(0, 8)

    if (!hasEditedZipCodeRef.current) return

    async function run () {
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
        setDistrict(String(data.bairro || ''))
        setCity(String(data.localidade || ''))
        setState(String(data.uf || '').toUpperCase().slice(0, 2))
        setIbgeCityCode(onlyDigits(String(data.ibge || '')).slice(0, 7))
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
    return () => {
      cancelled = true
    }
  }, [zipCode])

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-4'>
        <div className='space-y-2'>
          <Label htmlFor='zipCode'>CEP</Label>
          <Input
            id='zipCode'
            name='zipCode'
            inputMode='numeric'
            autoComplete='postal-code'
            value={zipCode}
            onChange={(event) => {
              hasEditedZipCodeRef.current = true
              setZipCode(formatCepBr(event.target.value))
            }}
            placeholder='00000-000'
          />
          {zipCodeLookupError ? (
            <p className='text-xs text-destructive'>{zipCodeLookupError}</p>
          ) : null}
          {!zipCodeLookupError && isLookingUpZipCode ? (
            <p className='text-xs text-muted-foreground'>Buscando endereço…</p>
          ) : null}
        </div>
        <div className='space-y-2 md:col-span-3'>
          <Label htmlFor='street'>Logradouro</Label>
          <Input id='street' name='street' value={street} onChange={(event) => setStreet(event.target.value)} autoComplete='address-line1' />
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        <div className='space-y-2'>
          <Label htmlFor='number'>Número</Label>
          <Input id='number' name='number' value={number} onChange={(event) => setNumber(event.target.value)} autoComplete='address-line2' />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='district'>Bairro</Label>
          <Input id='district' name='district' value={district} onChange={(event) => setDistrict(event.target.value)} autoComplete='address-level3' />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='city'>Município</Label>
          <Input id='city' name='city' value={city} onChange={(event) => setCity(event.target.value)} autoComplete='address-level2' />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='state'>UF</Label>
          <Input id='state' name='state' value={state} onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} autoComplete='address-level1' />
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='ibgeCityCode'>Código IBGE do município</Label>
          <Input
            id='ibgeCityCode'
            name='ibgeCityCode'
            inputMode='numeric'
            autoComplete='off'
            value={ibgeCityCode}
            onChange={(event) => setIbgeCityCode(onlyDigits(event.target.value).slice(0, 7))}
            maxLength={7}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='complement'>Complemento</Label>
          <Input id='complement' name='complement' value={complement} onChange={(event) => setComplement(event.target.value)} autoComplete='address-line3' />
        </div>
      </div>
    </div>
  )
}
