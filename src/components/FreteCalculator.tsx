'use client'

import { useState } from 'react'
import { useFormik } from 'formik'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { calcularFrete, COLETA_PRICE_TIERS, type FreteResult } from '@/lib/utils/frete'
import { MapPin, Truck, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function FreteCalculator() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FreteResult | null>(null)

  const getTierLabel = (tier: { maxKm: number | null }, index: number) => {
    if (tier.maxKm === null) {
      const prev = COLETA_PRICE_TIERS[index - 1]
      const min = prev?.maxKm || 0
      return `+${min}km`
    }
    return `Até ${tier.maxKm}km`
  }

  const formatCep = (value: string) => {
    const cepLimpo = value.replace(/\D/g, '')
    if (cepLimpo.length <= 8) {
      if (cepLimpo.length <= 5) {
        return cepLimpo
      }
      return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`
    }
    return cepLimpo.slice(0, 8)
  }

  const formik = useFormik({
    initialValues: { cep: '' },
    onSubmit: async (values) => {
      const cepLimpo = values.cep.replace(/\D/g, '')

      if (cepLimpo.length !== 8) {
        formik.setFieldError('cep', 'Por favor, insira um CEP válido (8 dígitos)')
        setResult({
          distancia: 0,
          valor: 0,
          cepInfo: null,
          erro: 'Por favor, insira um CEP válido (8 dígitos)'
        })
        return
      }

      setLoading(true)
      setResult(null)

      try {
        const freteResult = await calcularFrete(values.cep)
        setResult(freteResult)
      } catch (err) {
        setResult({
          distancia: 0,
          valor: 0,
          cepInfo: null,
          erro: 'Erro ao calcular o frete. Tente novamente.'
        })
      } finally {
        setLoading(false)
      }
    }
  })

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value)
    formik.setFieldValue('cep', formatted)
    formik.setFieldError('cep', undefined)
    setResult(null)
  }

  const handleAgendarColeta = () => {
    // Usa o CEP formatado do input ou do resultado
    const cepFormatado = formik.values.cep || (result?.cepInfo?.cep || '')
    const texto = `Olá! Gostaria de agendar a coleta do meu celular em domicílio. CEP: ${cepFormatado}`
    const url = `https://wa.me/5531986140889?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="w-full border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MapPin className="w-6 h-6 text-primary" />
          Calcule o Frete
        </CardTitle>
        <CardDescription className="text-base mt-2">
          Informe seu CEP para calcular o valor da coleta e entrega em domicílio em Belo Horizonte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={formik.handleSubmit} className="space-y-2">
          <Label htmlFor="cep">CEP</Label>
          <div className="flex gap-2">
            <Input
              id="cep"
              name="cep"
              type="text"
              placeholder="00000-000"
              value={formik.values.cep}
              onChange={handleCepChange}
              maxLength={9}
              disabled={loading}
              className="flex-1"
              aria-invalid={Boolean(formik.errors.cep)}
            />
            <Button
              type="submit"
              disabled={loading || !formik.values.cep}
              variant="default"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculando...
                </>
              ) : (
                'Calcular'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            * Coleta disponível apenas em Belo Horizonte
          </p>
        </form>

        {result && (
          <div className="space-y-3">
            {result.erro ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{result.erro}</AlertDescription>
              </Alert>
            ) : (
              <>
                {result.cepInfo && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-1">
                        {result.cepInfo.logradouro && `${result.cepInfo.logradouro}, `}
                        {result.cepInfo.bairro}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.cepInfo.localidade} - {result.cepInfo.uf}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Distância:</span>
                    <span className="font-semibold">{result.distancia} km</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Frete (coleta + entrega):
                    </span>
                    <span className="text-lg font-bold text-primary">
                      R$ {result.valor.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleAgendarColeta}
                  className="w-full"
                >
                  Agendar Coleta
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

