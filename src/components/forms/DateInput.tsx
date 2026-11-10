'use client'

import { useEffect, useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  brDateToYmd,
  formatDateInputBr,
  localDateToYmd,
  ymdToBrDate,
  ymdToLocalDate,
} from '@/lib/utils/format-date-input'

type DateInputProps = {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (ymd: string) => void
  onBlur?: () => void
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
  min?: string
  max?: string
  'aria-label'?: string
}

export function DateInput ({
  id,
  name,
  value,
  defaultValue = '',
  onChange,
  onBlur,
  disabled,
  readOnly,
  required,
  placeholder = 'dd/mm/aaaa',
  className,
  inputClassName,
  min,
  max,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const isControlled = value !== undefined
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState(() => ymdToBrDate(isControlled ? value : defaultValue))
  const [ymdValue, setYmdValue] = useState(() => {
    const initial = isControlled ? String(value || '') : String(defaultValue || '')
    return brDateToYmd(ymdToBrDate(initial)) || (initial.match(/^\d{4}-\d{2}-\d{2}$/) ? initial : '')
  })

  useEffect(() => {
    if (!isControlled) return
    setDisplay(ymdToBrDate(value))
    setYmdValue(String(value || ''))
  }, [isControlled, value])

  function emit (ymd: string) {
    setYmdValue(ymd)
    if (!isControlled) setDisplay(ymdToBrDate(ymd) || formatDateInputBr(display))
    onChange?.(ymd)
  }

  function handleTextChange (raw: string) {
    const nextDisplay = formatDateInputBr(raw)
    setDisplay(nextDisplay)
    const digits = nextDisplay.replace(/\D/g, '')
    if (digits.length === 0) {
      setYmdValue('')
      onChange?.('')
      return
    }
    if (digits.length < 8) {
      setYmdValue('')
      return
    }
    const ymd = brDateToYmd(nextDisplay)
    setYmdValue(ymd)
    if (ymd) onChange?.(ymd)
  }

  const selected = ymdToLocalDate(isControlled ? value : ymdValue || brDateToYmd(display))

  return (
    <div className={cn('flex gap-2', className)}>
      {name ? <input type='hidden' name={name} value={ymdValue} /> : null}
      <Input
        id={id}
        value={display}
        onChange={(event) => {
          if (readOnly || disabled) return
          handleTextChange(event.target.value)
        }}
        onBlur={onBlur}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        inputMode='numeric'
        autoComplete='off'
        aria-label={ariaLabel}
        className={cn('min-w-0 flex-1', inputClassName)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            size='icon'
            disabled={disabled || readOnly}
            aria-label='Abrir calendário'
            className='shrink-0'
          >
            <CalendarIcon className='h-4 w-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='end'>
          <Calendar
            mode='single'
            selected={selected}
            defaultMonth={selected}
            disabled={(date) => {
              const ymd = localDateToYmd(date)
              if (min && ymd < min) return true
              if (max && ymd > max) return true
              return false
            }}
            onSelect={(date) => {
              if (!date) {
                setDisplay('')
                emit('')
                setOpen(false)
                return
              }
              const ymd = localDateToYmd(date)
              setDisplay(ymdToBrDate(ymd))
              emit(ymd)
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
