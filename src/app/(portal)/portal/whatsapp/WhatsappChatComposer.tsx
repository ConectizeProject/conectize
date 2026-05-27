'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
} from 'react'
import { Loader2, Send, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_ROWS_PX = 120

export type WhatsappChatComposerHandle = {
  focus: () => void
}

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void | Promise<void>
  sending?: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export const WhatsappChatComposer = forwardRef<WhatsappChatComposerHandle, Props>(
  function WhatsappChatComposer (
    {
      value,
      onChange,
      onSend,
      sending = false,
      disabled = false,
      placeholder = 'Digite uma mensagem',
      autoFocus = false,
    },
    ref,
  ) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
  }), [])

  useEffect(() => {
    if (!autoFocus) return
    textareaRef.current?.focus()
  }, [autoFocus])

  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`
  }, [])

  useEffect(() => {
    resize()
  }, [value, resize])

  function handleKeyDown (e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    e.preventDefault()
    if (disabled || sending || !value.trim()) return
    void onSend()
  }

  const canSend = !disabled && !sending && value.trim().length > 0

  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-[#d1d7db] bg-[#f0f2f5] px-3 py-2 dark:border-[#2a3942] dark:bg-[#202c33]">
      <button
        type="button"
        className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/5"
        aria-label="Emojis (em breve)"
        disabled
        title="Em breve"
      >
        <Smile className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 items-end rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-[#2a3942]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'max-h-[120px] min-h-[24px] w-full resize-none border-0 bg-transparent py-1 text-[15px] leading-snug',
            'text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-0',
            'dark:text-[#e9edef] dark:placeholder:text-[#8696a0]',
          )}
          aria-label="Mensagem"
        />
      </div>
      <button
        type="button"
        onClick={() => void onSend()}
        disabled={!canSend}
        className={cn(
          'mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
          canSend
            ? 'bg-[#00a884] text-white hover:bg-[#008f72] dark:bg-[#00a884] dark:hover:bg-[#008f72]'
            : 'bg-[#8696a0]/40 text-white/80 cursor-not-allowed dark:bg-[#8696a0]/30',
        )}
        aria-label="Enviar mensagem"
      >
        {sending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Send className="h-5 w-5" aria-hidden />
        )}
      </button>
      <p className="sr-only">Enter envia. Shift+Enter quebra linha.</p>
    </div>
  )
},
)

WhatsappChatComposer.displayName = 'WhatsappChatComposer'
