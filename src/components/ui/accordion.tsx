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
}

export function Accordion({ title, children, defaultOpen = false, className }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const accordionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && accordionRef.current) {
      // Small delay to ensure content is rendered before scrolling
      const timeoutId = setTimeout(() => {
        accordionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [isOpen])

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
          className="w-full justify-between p-0 h-auto hover:bg-transparent ml-0 pl-0"
        >
          <span className="text-sm font-medium text-zinc-300 ml-0 pl-0">{title}</span>
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

