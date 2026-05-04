import type { VariantProps } from 'class-variance-authority'

import { buttonVariants } from '@/components/ui/button-variants'

/** Dois textos prontos para colar no WhatsApp (atacado × cliente final). */
export type WhatsAppTextPair = {
  atacado: string
  cliente: string
}

export type WhatsAppTextTab = 'atacado' | 'cliente'

type ButtonLook = Pick<
  VariantProps<typeof buttonVariants>,
  'variant' | 'size'
>

export type WhatsAppTextModalButtonProps = {
  /** Chamado ao abrir o modal — deve retornar os textos atuais (filtros, estoque, etc.). */
  buildTexts: () => WhatsAppTextPair
  className?: string
  /** `aria-label` do botão ícone (acessibilidade). */
  'aria-label'?: string
} & Partial<ButtonLook>
