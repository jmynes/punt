'use client'

import {
  applyFormat$,
  BoldItalicUnderlineToggles,
  currentFormat$,
  IS_BOLD,
  IS_ITALIC,
  IS_UNDERLINE,
  useCellValue,
  usePublisher,
} from '@mdxeditor/editor'
import { Bold, ChevronDown, Italic, Underline } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'

export function ResponsiveBoldItalicUnderlineToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const applyFormat = usePublisher(applyFormat$)
  const currentFormat = useCellValue(currentFormat$)

  if (isSmallScreen) {
    const isBoldActive = (currentFormat & IS_BOLD) !== 0
    const isItalicActive = (currentFormat & IS_ITALIC) !== 0
    const isUnderlineActive = (currentFormat & IS_UNDERLINE) !== 0

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 relative flex items-center justify-center"
          >
            <Bold className="h-4 w-4 shrink-0 text-current" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5 shrink-0 pointer-events-none text-current opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
          <DropdownMenuItem
            onClick={() => applyFormat('bold')}
            className={
              isBoldActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Bold className="h-4 w-4 mr-2" />
            Bold
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyFormat('italic')}
            className={
              isItalicActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Italic className="h-4 w-4 mr-2" />
            Italic
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyFormat('underline')}
            className={
              isUnderlineActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Underline className="h-4 w-4 mr-2" />
            Underline
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as toggle buttons on larger screens
  return <BoldItalicUnderlineToggles />
}
