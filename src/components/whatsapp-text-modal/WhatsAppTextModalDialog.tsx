'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Copy } from 'lucide-react'

import type { WhatsAppTextTab } from './types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: WhatsAppTextTab
  onTabChange: (tab: WhatsAppTextTab) => void
  textAtacado: string
  textCliente: string
  onTextAtacadoChange: (value: string) => void
  onTextClienteChange: (value: string) => void
  onCopy: () => void
}

export function WhatsAppTextModalDialog ({
  open,
  onOpenChange,
  tab,
  onTabChange,
  textAtacado,
  textCliente,
  onTextAtacadoChange,
  onTextClienteChange,
  onCopy,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Texto WhatsApp</DialogTitle>
          <DialogDescription>
            Escolha a aba (atacado ou cliente final), edite se quiser e copie
            para o WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as WhatsAppTextTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="atacado">Atacado</TabsTrigger>
            <TabsTrigger value="cliente">Cliente final</TabsTrigger>
          </TabsList>
          <TabsContent
            value="atacado"
            className="mt-3 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <Textarea
              value={textAtacado}
              onChange={(e) => onTextAtacadoChange(e.target.value)}
              placeholder="Texto para WhatsApp (atacado)..."
              className="min-h-[280px] flex-1 resize-y font-mono text-sm"
              dir="ltr"
            />
          </TabsContent>
          <TabsContent
            value="cliente"
            className="mt-3 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <Textarea
              value={textCliente}
              onChange={(e) => onTextClienteChange(e.target.value)}
              placeholder="Texto para WhatsApp (cliente final)..."
              className="min-h-[280px] flex-1 resize-y font-mono text-sm"
              dir="ltr"
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
