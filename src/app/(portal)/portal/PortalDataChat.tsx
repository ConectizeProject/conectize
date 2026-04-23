'use client'

import { useCallback, useRef, useState } from 'react'
import { MessageCircle, Send, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Message = { role: 'user' | 'assistant'; content: string }

type PortalDataChatProps = {
  role: string
}

export function PortalDataChat(props: PortalDataChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    setInputValue('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsLoading(true)
    scrollToBottom()

    try {
      const res = await fetch('/api/portal/chat-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json().catch(() => ({}))
      const reply = typeof data.reply === 'string' ? data.reply : (data.error === 'forbidden' ? 'Relatórios financeiros são restritos a administradores.' : 'Não foi possível obter resposta. Tente novamente.')
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setIsLoading(false)
      scrollToBottom()
    }
  }, [inputValue, isLoading, scrollToBottom])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const isAdmin = props.role === 'admin' || props.role === 'platform_admin'

  return (
    <>
      {/* Botão flutuante — canto inferior direito */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg',
          'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'transition-transform hover:scale-105 active:scale-100'
        )}
        aria-label={isOpen ? 'Fechar chat' : 'Abrir chat com dados'}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Painel do chat — fechado por padrão */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-[min(100vw-3rem,400px)] flex-col rounded-xl border bg-card shadow-xl"
          role="dialog"
          aria-label="Chat com dados do portal"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Chat com dados</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={scrollRef}
            className="flex min-h-[240px] max-h-[320px] flex-1 flex-col gap-3 overflow-y-auto p-3"
          >
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Faça perguntas sobre ordens, clientes ou operação.
                {!isAdmin && (
                  <span className="mt-1 block">Relatórios financeiros são apenas para administradores.</span>
                )}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'mr-auto bg-muted'
                )}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Pensando...</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t p-3">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre ordens, clientes..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              aria-label="Enviar"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
