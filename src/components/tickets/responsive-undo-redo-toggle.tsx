'use client'

import { activeEditor$, UndoRedo, useCellValue } from '@mdxeditor/editor'
import { REDO_COMMAND, UNDO_COMMAND } from 'lexical'
import { ChevronDown, Redo, Undo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'

export function ResponsiveUndoRedoToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const activeEditor = useCellValue(activeEditor$)

  const handleUndo = () => {
    if (activeEditor) {
      activeEditor.dispatchCommand(UNDO_COMMAND, undefined)
    }
  }

  const handleRedo = () => {
    if (activeEditor) {
      activeEditor.dispatchCommand(REDO_COMMAND, undefined)
    }
  }

  if (isSmallScreen) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 relative flex items-center justify-center"
          >
            <Undo className="h-4 w-4 shrink-0 text-current" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5 shrink-0 pointer-events-none text-current opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
          <DropdownMenuItem onClick={handleUndo} className="text-zinc-300 focus:bg-zinc-800">
            <Undo className="h-4 w-4 mr-2" />
            Undo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRedo} className="text-zinc-300 focus:bg-zinc-800">
            <Redo className="h-4 w-4 mr-2" />
            Redo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as individual buttons on larger screens
  return <UndoRedo />
}
