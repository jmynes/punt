'use client'

import React from 'react'
import { ListsToggle, usePublisher, useCellValue, applyListType$, currentListType$ } from '@mdxeditor/editor'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, List, ListOrdered, CheckSquare, Table } from 'lucide-react'
import { InsertTable } from '@mdxeditor/editor'

export function ResponsiveListsToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const applyListType = usePublisher(applyListType$)
  const currentListType = useCellValue(currentListType$)

  if (isSmallScreen) {
    const isBulletList = currentListType === 'bullet'
    const isNumberedList = currentListType === 'number'
    const isChecklist = currentListType === 'check'

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 relative flex items-center justify-center"
          >
            <List className="h-4 w-4 shrink-0 text-current" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5 shrink-0 pointer-events-none text-current opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
          <DropdownMenuItem
            onClick={() => applyListType(isBulletList ? '' : 'bullet')}
            className={isBulletList ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'}
          >
            <List className="h-4 w-4 mr-2" />
            Bullet List
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyListType(isNumberedList ? '' : 'number')}
            className={isNumberedList ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'}
          >
            <ListOrdered className="h-4 w-4 mr-2" />
            Numbered List
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyListType(isChecklist ? '' : 'check')}
            className={isChecklist ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Checklist
          </DropdownMenuItem>
          <div className="flex flex-col gap-0 p-1">
            <InsertTable />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as toggle buttons on larger screens
  return <ListsToggle />
}

