'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface AccordionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  scrollTo?: 'noscroll' | 'content' | 'bottom'
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  className,
  scrollTo = 'noscroll',
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const accordionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && scrollTo !== 'noscroll') {
      // Small delay to ensure content is rendered before scrolling
      const timeoutId = setTimeout(() => {
        if (scrollTo === 'bottom') {
          // Find the nearest scrollable parent and scroll to bottom
          let scrollableParent: HTMLElement | null = accordionRef.current
          while (scrollableParent) {
            const overflowY = window.getComputedStyle(scrollableParent).overflowY
            if (
              (overflowY === 'auto' || overflowY === 'scroll') &&
              scrollableParent.scrollHeight > scrollableParent.clientHeight
            ) {
              scrollableParent.scrollTo({
                top: scrollableParent.scrollHeight,
                behavior: 'smooth',
              })
              return
            }
            scrollableParent = scrollableParent.parentElement
          }
          // Fallback: scroll window to bottom
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth',
          })
        } else if (scrollTo === 'content') {
          // Scroll to content
          accordionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          })
        }
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [isOpen, scrollTo])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div ref={accordionRef} className={cn('border-b border-zinc-800', className)}>
      <div className="py-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleToggle}
          className="w-full justify-between p-0 px-0 h-auto hover:bg-transparent [&:has(>svg)]:px-0"
        >
          <span className="text-sm font-medium text-zinc-300">{title}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-zinc-400 transition-transform',
              isOpen && 'transform rotate-180',
            )}
          />
        </Button>
      </div>
      {isOpen && (
        <div ref={contentRef} className="pt-4 space-y-4 pb-0">
          {children}
        </div>
      )}
    </div>
  )
}

