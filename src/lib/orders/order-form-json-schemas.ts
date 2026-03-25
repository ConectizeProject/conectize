import { z } from 'zod'

/**
 * Contrato do JSON enviado em `servicesJson` (FormData).
 * Aceita campos extras; validação solta preserva o comportamento legado de parse.
 */
export const orderFormServicesJsonPayloadSchema = z
  .object({
    items: z.unknown(),
    totals: z.unknown(),
  })
  .partial()
  .passthrough()

export type OrderFormServicesJsonPayload = z.infer<typeof orderFormServicesJsonPayloadSchema>

/** Raiz esperada para `paymentMethodsJson`: array de objetos. */
export const orderFormPaymentMethodsJsonRootSchema = z.array(z.record(z.string(), z.unknown()))
