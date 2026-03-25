import { z } from 'zod'

const portalOrdensListRowSchema = z.object({
  id: z.string(),
  display_number: z.number().nullable(),
  status: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  estimated_ready_at: z.string().nullable(),
  share_token: z.string().nullable().optional(),
  customer_id: z.string().nullable(),
  device_model_id: z.string().nullable(),
  services: z.unknown().optional(),
  services_total_cents: z.number().nullable().optional(),
  services_cost_total_cents: z.number().nullable().optional(),
  payment_methods: z.unknown().optional(),
  customers: z
    .object({
      id: z.string(),
      cpf: z.string().nullable().optional(),
      cnpj: z.string().nullable().optional(),
      is_company: z.boolean().optional(),
      full_name: z.string().nullable().optional(),
      company_name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      mobile_phone: z.string().nullable().optional(),
    })
    .passthrough()
    .nullable(),
  device_models: z
    .object({
      id: z.string(),
      brand: z.string().nullable(),
      device_type: z.string().nullable(),
      model: z.string().nullable(),
    })
    .nullable(),
})

/** Resposta GET ?statusGroup=final */
export const portalOrdensFinalListResponseSchema = z.object({
  ok: z.literal(true),
  orders: z.array(portalOrdensListRowSchema.passthrough()),
})
