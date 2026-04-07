'use client'

import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
  contentClassName?: string
  onReady?: (element: HTMLDivElement | null) => void
}

export function DragScrollRow({
  children,
  className,
  contentClassName,
  onReady,
}: Props) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({
    isPointerDown: false,
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  })
  const [isDragging, setIsDragging] = useState(false)

  function setRowRef(element: HTMLDivElement | null) {
    rowRef.current = element
    onReady?.(element)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const row = rowRef.current
    if (!row) return
    dragRef.current.isPointerDown = true
    dragRef.current.isDragging = false
    dragRef.current.startX = e.clientX
    dragRef.current.startScrollLeft = row.scrollLeft
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const row = rowRef.current
    if (!row || !dragRef.current.isPointerDown) return
    const deltaX = e.clientX - dragRef.current.startX
    if (!dragRef.current.isDragging && Math.abs(deltaX) > 4) {
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      dragRef.current.isDragging = true
      setIsDragging(true)
    }
    if (!dragRef.current.isDragging) return
    e.preventDefault()
    row.scrollLeft = dragRef.current.startScrollLeft - deltaX
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current.isPointerDown = false
    window.setTimeout(() => {
      dragRef.current.isDragging = false
      setIsDragging(false)
    }, 0)
  }

  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragRef.current.isDragging) return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={setRowRef}
      className={cn(
        'overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        isDragging ? 'cursor-grabbing select-none' : 'cursor-grab',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={handleClickCapture}
    >
      <div className={cn('flex gap-3', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
