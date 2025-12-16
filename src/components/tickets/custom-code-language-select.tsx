'use client'

import { Code, FileCode } from 'lucide-react'
import { useCellValues } from '@mdxeditor/editor'
import { codeBlockLanguages$, $isCodeBlockNode, type CodeBlockNode } from '@mdxeditor/editor'
import { editorInFocus$, activeEditor$ } from '@mdxeditor/editor'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const EMPTY_VALUE = '__EMPTY_VALUE__'

export function CustomCodeLanguageSelect() {
  const [editorInFocus, theEditor, codeBlockLanguages] = useCellValues(
    editorInFocus$,
    activeEditor$,
    codeBlockLanguages$,
  )

  // Only show when editing a code block
  if (!editorInFocus?.rootNode || !$isCodeBlockNode(editorInFocus.rootNode)) {
    return null
  }

  const codeBlockNode = editorInFocus.rootNode as CodeBlockNode
  let currentLanguage = codeBlockNode.getLanguage() || ''
  if (currentLanguage === '') {
    currentLanguage = EMPTY_VALUE
  }

  const handleLanguageChange = (language: string) => {
    if (!theEditor) return

    theEditor.update(() => {
      codeBlockNode.setLanguage(language === EMPTY_VALUE ? '' : language)
      setTimeout(() => {
        theEditor.update(() => {
          codeBlockNode.getLatest().select()
        })
      })
    })
  }

  // Convert codeBlockLanguages object to array
  const languages = Object.entries(codeBlockLanguages).map(([value, label]) => ({
    value: value || EMPTY_VALUE,
    label,
  }))

  // Sort languages: empty/plain text first, then alphabetically
  languages.sort((a, b) => {
    if (a.value === EMPTY_VALUE) return -1
    if (b.value === EMPTY_VALUE) return 1
    return a.label.localeCompare(b.label)
  })

  const currentLang = languages.find((lang) => lang.value === currentLanguage) || languages[0]
  const displayLabel = currentLang?.label || 'Plain Text'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs"
        >
          <Code className="h-3 w-3 mr-1.5" />
          <span className="max-w-[80px] truncate">{displayLabel}</span>
          <span className="sr-only">Code block language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48 max-h-[300px] overflow-y-auto bg-zinc-900 border-zinc-700 text-zinc-100"
      >
        {languages.map((lang) => {
          const isSelected = currentLanguage === lang.value
          return (
            <DropdownMenuItem
              key={lang.value}
              onClick={() => handleLanguageChange(lang.value)}
              className={cn(
                'flex items-center gap-2 cursor-pointer text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100',
                isSelected && 'bg-amber-600 text-white focus:bg-amber-600 focus:text-white',
              )}
            >
              <FileCode className="h-4 w-4" />
              <span>{lang.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

