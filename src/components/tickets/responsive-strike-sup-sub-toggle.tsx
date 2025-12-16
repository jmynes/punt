'use client'

import React from 'react'
import { StrikeThroughSupSubToggles } from '@mdxeditor/editor'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, Strikethrough } from 'lucide-react'

export function ResponsiveStrikeSupSubToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')

  if (isSmallScreen) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            <Strikethrough className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Format</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700 p-1" align="start">
          <div className="flex flex-col gap-0">
            <StrikeThroughSupSubToggles />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as toggle buttons on larger screens
  return <StrikeThroughSupSubToggles />
}

