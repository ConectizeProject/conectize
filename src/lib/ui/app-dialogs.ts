'use client'

export type AppConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export type AppPromptOptions = AppConfirmOptions & {
  label?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
}

export type AppAlertOptions = {
  title: string
  description?: string
  confirmLabel?: string
}

export type AppDialogRequest =
  | {
    type: 'confirm'
    options: AppConfirmOptions
    resolve: (value: boolean) => void
  }
  | {
    type: 'prompt'
    options: AppPromptOptions
    resolve: (value: string | null) => void
  }
  | {
    type: 'alert'
    options: AppAlertOptions
    resolve: () => void
  }

type AppDialogHandler = (request: AppDialogRequest) => void

let handler: AppDialogHandler | null = null

export function registerAppDialogHandler (next: AppDialogHandler | null) {
  handler = next
  return () => {
    if (handler === next) handler = null
  }
}

function ensureHandler (): AppDialogHandler {
  if (!handler) {
    throw new Error(
      'AppDialogProvider não está montado. Use appConfirm/appPrompt/appAlert apenas no client com o provider ativo.',
    )
  }
  return handler
}

/** Confirmação modal (substitui window.confirm). Retorna true se confirmado. */
export function appConfirm (options: AppConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    ensureHandler()({ type: 'confirm', options, resolve })
  })
}

/** Prompt modal com texto (substitui window.prompt). Retorna string ou null se cancelar. */
export function appPrompt (options: AppPromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    ensureHandler()({ type: 'prompt', options, resolve })
  })
}

/** Alerta modal informativo (substitui window.alert). */
export function appAlert (options: AppAlertOptions): Promise<void> {
  return new Promise((resolve) => {
    ensureHandler()({ type: 'alert', options, resolve })
  })
}
