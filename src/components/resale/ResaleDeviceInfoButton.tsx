'use client'

import { Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  info: string
  className?: string
  buttonClassName?: string
}

export function ResaleDeviceInfoButton ({
  info,
  className,
  buttonClassName,
}: Props) {
  const text = info.trim()
  if (!text) return null

  return (
    <div
      className={cn(className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='secondary'
            size='icon'
            className={cn(
              'h-8 w-8 rounded-full border border-border/70 bg-background/95 shadow-sm backdrop-blur-sm',
              buttonClassName,
            )}
            aria-label='Ver informações do aparelho'
          >
            <Wrench className='h-4 w-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          side='bottom'
          className='max-w-xs text-sm leading-relaxed whitespace-pre-wrap break-words'
        >
          <p className='mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            Informações
          </p>
          {text}
        </PopoverContent>
      </Popover>
    </div>
  )
}
