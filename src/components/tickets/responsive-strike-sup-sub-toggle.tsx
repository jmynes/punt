'use client'

import {
  applyFormat$,
  currentFormat$,
  HighlightToggle,
  IS_HIGHLIGHT,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  StrikeThroughSupSubToggles,
  useCellValue,
  usePublisher,
} from '@mdxeditor/editor'
import { ChevronDown, Highlighter, Strikethrough, Subscript, Superscript } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'

export function ResponsiveStrikeSupSubToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const applyFormat = usePublisher(applyFormat$)
  const currentFormat = useCellValue(currentFormat$)

  if (isSmallScreen) {
    const isStrikethroughActive = (currentFormat & IS_STRIKETHROUGH) !== 0
    const isSubscriptActive = (currentFormat & IS_SUBSCRIPT) !== 0
    const isSuperscriptActive = (currentFormat & IS_SUPERSCRIPT) !== 0
    const isHighlightActive = (currentFormat & IS_HIGHLIGHT) !== 0

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 relative flex items-center justify-center"
          >
            <Strikethrough className="h-4 w-4 shrink-0 text-current" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5 shrink-0 pointer-events-none text-current opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
          <DropdownMenuItem
            onClick={() => applyFormat('strikethrough')}
            className={
              isStrikethroughActive
                ? 'bg-zinc-800 text-amber-400'
                : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Strikethrough className="h-4 w-4 mr-2" />
            Strikethrough
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyFormat('subscript')}
            className={
              isSubscriptActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Subscript className="h-4 w-4 mr-2" />
            Subscript
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyFormat('superscript')}
            className={
              isSuperscriptActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Superscript className="h-4 w-4 mr-2" />
            Superscript
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyFormat('highlight')}
            className={
              isHighlightActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Highlighter className="h-4 w-4 mr-2" />
            Highlight
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as toggle buttons on larger screens
  return (
    <>
      <StrikeThroughSupSubToggles />
      <HighlightToggle />
    </>
  )
}
