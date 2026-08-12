'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { toast } from '@/hooks/use-toast'

type Props = {
  deviceId: string | null
  deviceLabel?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResaleDeleteDeviceDialog ({
  deviceId,
  deviceLabel,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete () {
    if (!deviceId || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
        method: 'DELETE',
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível excluir',
          description: data?.error || data?.message,
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Aparelho excluído' })
      onOpenChange(false)
      router.refresh()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isDeleting) return
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir aparelho</AlertDialogTitle>
          <AlertDialogDescription>
            {deviceLabel
              ? `Tem certeza que deseja excluir “${deviceLabel}”? Esta ação não pode ser desfeita.`
              : 'Tem certeza que deseja excluir este aparelho? Esta ação não pode ser desfeita.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Button
            type='button'
            variant='destructive'
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? 'Excluindo…' : 'Excluir'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
