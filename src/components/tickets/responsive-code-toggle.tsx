'use client'

import {
  applyFormat$,
  CodeToggle,
  currentFormat$,
  InsertCodeBlock,
  IS_CODE,
  insertCodeBlock$,
  useCellValue,
  usePublisher,
} from '@mdxeditor/editor'
import { ChevronDown, Code, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'

export function ResponsiveCodeToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const applyFormat = usePublisher(applyFormat$)
  const insertCodeBlock = usePublisher(insertCodeBlock$)
  const currentFormat = useCellValue(currentFormat$)
  const isCodeActive = (currentFormat & IS_CODE) !== 0

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
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
          <DropdownMenuItem
            onClick={() => applyFormat('code')}
            className={
              isCodeActive ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 focus:bg-zinc-800'
            }
          >
            <Code className="h-4 w-4 mr-2" />
            Inline Code
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => insertCodeBlock({})}
            className="text-zinc-300 focus:bg-zinc-800"
          >
            <Code2 className="h-4 w-4 mr-2" />
            Code Block
          </DropdownMenuItem>
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
