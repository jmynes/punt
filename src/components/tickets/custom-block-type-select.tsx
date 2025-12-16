'use client'

import { Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Quote, Type } from 'lucide-react'
import { useCellValue, usePublisher } from '@mdxeditor/editor'
import { convertSelectionToNode$, currentBlockType$, activePlugins$, allowedHeadingLevels$ } from '@mdxeditor/editor'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $createParagraphNode } from 'lexical'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CustomBlockTypeSelect() {
  const convertSelectionToNode = usePublisher(convertSelectionToNode$)
  const currentBlockType = useCellValue(currentBlockType$)
  const activePlugins = useCellValue(activePlugins$)
  const allowedHeadingLevels = useCellValue(allowedHeadingLevels$)
  
  const hasQuote = activePlugins.includes('quote')
  const hasHeadings = activePlugins.includes('headings')

  // Don't render if no block types are available
  if (!hasQuote && !hasHeadings) {
    return null
  }

  // Build block types list based on available plugins
  const blockTypes: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'paragraph', label: 'Paragraph', icon: Type },
  ]

  if (hasQuote) {
    blockTypes.push({ value: 'quote', label: 'Quote', icon: Quote })
  }

  if (hasHeadings) {
    const headingIcons = [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6]
    allowedHeadingLevels.forEach((level) => {
      blockTypes.push({
        value: `h${level}`,
        label: `Heading ${level}`,
        icon: headingIcons[level - 1] || Heading1,
      })
    })
  }

  const currentType = blockTypes.find((type) => type.value === currentBlockType) || blockTypes[0]
  const CurrentIcon = currentType.icon

  const handleBlockTypeChange = (blockType: string) => {
    switch (blockType) {
      case 'quote':
        convertSelectionToNode(() => $createQuoteNode())
        break
      case 'paragraph':
        convertSelectionToNode(() => $createParagraphNode())
        break
      default:
        if (blockType.startsWith('h')) {
          const headingTag = blockType as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
          convertSelectionToNode(() => $createHeadingNode(headingTag))
        }
        break
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100"
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="sr-only">Block type</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48 bg-zinc-900 border-zinc-700 text-zinc-100"
      >
        {blockTypes.map((type) => {
          const Icon = type.icon
          const isSelected = currentBlockType === type.value
          return (
            <DropdownMenuItem
              key={type.value}
              onClick={() => handleBlockTypeChange(type.value)}
              className={cn(
                'flex items-center gap-2 cursor-pointer text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100',
                isSelected && 'bg-amber-600 text-white focus:bg-amber-600 focus:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{type.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

