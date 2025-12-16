'use client'

import React from 'react'
import { CodeToggle, InsertCodeBlock } from '@mdxeditor/editor'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, Code, Code2 } from 'lucide-react'

export function ResponsiveCodeToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')

  if (isSmallScreen) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 relative flex items-center justify-center"
          >
            <Code className="h-4 w-4 shrink-0 text-current" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5 shrink-0 pointer-events-none text-current opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700 p-1" align="start">
          <div className="flex flex-col gap-0">
            <CodeToggle />
            <InsertCodeBlock />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as individual buttons on larger screens
  return (
    <>
      <CodeToggle />
      <InsertCodeBlock />
    </>
  )
}

