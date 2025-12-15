'use client'

import React, { useEffect, useRef } from 'react'
import { useCellValues } from '@mdxeditor/editor'
import { useCodeBlockEditorContext } from '@mdxeditor/editor'
import { readOnly$, iconComponentFor$ } from '@mdxeditor/editor'
import { codeMirrorExtensions$, codeMirrorAutoLoadLanguageSupport$, codeBlockLanguages$ } from '@mdxeditor/editor'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { lineNumbers, keymap, EditorView } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { basicLight } from 'cm6-theme-basic-light'
import { basicSetup } from 'codemirror'
import { $setSelection } from 'lexical'
import { useTranslation } from '@mdxeditor/editor'
import { Code, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const EMPTY_VALUE = '__EMPTY_VALUE__'

interface CustomCodeMirrorEditorProps {
  language: string
  nodeKey: string
  code: string
  meta: string
  focusEmitter: any
}

export function CustomCodeMirrorEditor({ language, nodeKey, code, meta, focusEmitter }: CustomCodeMirrorEditorProps) {
  const t = useTranslation()
  const { parentEditor, lexicalNode, setCode } = useCodeBlockEditorContext()
  const [readOnly, codeMirrorExtensions, autoLoadLanguageSupport, iconComponentFor, codeBlockLanguages] = useCellValues(
    readOnly$,
    codeMirrorExtensions$,
    codeMirrorAutoLoadLanguageSupport$,
    iconComponentFor$,
    codeBlockLanguages$,
  )

  const editorViewRef = useRef<EditorView | null>(null)
  const elRef = useRef<HTMLDivElement>(null)
  const setCodeRef = useRef(setCode)
  const lastSyncedCodeRef = useRef(code)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  setCodeRef.current = setCode

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    let cleanup: (() => void) | undefined

    void (async () => {
      const extensions = [
        ...codeMirrorExtensions,
        basicSetup,
        basicLight,
        lineNumbers(),
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of(({ state }) => {
          const newCode = state.doc.toString()
          // Store the latest code but don't sync to Lexical yet
          lastSyncedCodeRef.current = newCode
        }),
        EditorView.domEventHandlers({
          focus: () => {
            parentEditor.update(() => {
              $setSelection(null)
            })
          },
          blur: () => {
            // Sync to Lexical when editor loses focus
            if (editorViewRef.current) {
              const currentCode = editorViewRef.current.state.doc.toString()
              if (currentCode !== lastSyncedCodeRef.current) {
                lastSyncedCodeRef.current = currentCode
              }
              setCodeRef.current(currentCode)
            }
          },
        }),
      ]

      if (readOnly) {
        extensions.push(EditorState.readOnly.of(true))
      }

      if (language !== '' && autoLoadLanguageSupport) {
        const languageData = languages.find((l) => {
          return l.name === language || l.alias.includes(language) || l.extensions.includes(language)
        })
        if (languageData) {
          try {
            const languageSupport = await languageData.load()
            extensions.push(languageSupport.extension)
          } catch (e) {
            console.warn('failed to load language support for', language)
          }
        }
      }

      el.innerHTML = ''
      editorViewRef.current = new EditorView({
        parent: el,
        state: EditorState.create({ doc: code, extensions }),
      })

      const stopPropagationHandler = (ev: KeyboardEvent) => {
        ev.stopPropagation()
      }
      el.addEventListener('keydown', stopPropagationHandler)

      cleanup = () => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current)
        }
        editorViewRef.current?.destroy()
        editorViewRef.current = null
        el.removeEventListener('keydown', stopPropagationHandler)
      }
    })()

    return cleanup
  }, [readOnly, language, codeMirrorExtensions, autoLoadLanguageSupport, parentEditor])

  // Update code content when it changes externally (but don't recreate editor)
  // Only update if the code is actually different to avoid unnecessary updates
  // This handles cases where code is updated from outside the editor (e.g., undo/redo)
  useEffect(() => {
    if (editorViewRef.current && !editorViewRef.current.hasFocus) {
      const currentCode = editorViewRef.current.state.doc.toString()
      // Only update if code is different and this isn't the code we just synced
      if (currentCode !== code && code !== lastSyncedCodeRef.current) {
        lastSyncedCodeRef.current = code
        editorViewRef.current.dispatch({
          changes: {
            from: 0,
            to: editorViewRef.current.state.doc.length,
            insert: code,
          },
        })
      }
    }
  }, [code])

  const handleLanguageChange = (newLanguage: string) => {
    parentEditor.update(() => {
      lexicalNode.setLanguage(newLanguage === EMPTY_VALUE ? '' : newLanguage)
      setTimeout(() => {
        parentEditor.update(() => {
          lexicalNode.getLatest().select()
        })
      })
    })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    parentEditor.update(() => {
      lexicalNode.remove()
    })
  }

  // Convert codeBlockLanguages object to array
  const languagesList = Object.entries(codeBlockLanguages).map(([value, label]) => ({
    value: value || EMPTY_VALUE,
    label,
  }))

  // Sort languages: empty/plain text first, then alphabetically
  languagesList.sort((a, b) => {
    if (a.value === EMPTY_VALUE) return -1
    if (b.value === EMPTY_VALUE) return 1
    return a.label.localeCompare(b.label)
  })

  const currentLanguage = language || EMPTY_VALUE
  const currentLang = languagesList.find((lang) => lang.value === currentLanguage) || languagesList[0]
  const displayLabel = currentLang?.label || 'Plain Text'

  return (
    <div className="border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              className="h-7 px-2 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs"
            >
              <Code className="h-3 w-3 mr-1.5" />
              <span className="max-w-[100px] truncate">{displayLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-48 max-h-[300px] overflow-y-auto bg-zinc-900 border-zinc-700 text-zinc-100"
          >
            {languagesList.map((lang) => {
              const isSelected = currentLanguage === lang.value
              return (
                <DropdownMenuItem
                  key={lang.value}
                  onClick={() => handleLanguageChange(lang.value)}
                  disabled={readOnly}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100',
                    isSelected && 'bg-amber-600 text-white focus:bg-amber-600 focus:text-white',
                  )}
                >
                  <Code className="h-4 w-4" />
                  <span>{lang.label}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={readOnly}
          onClick={handleDelete}
          className="h-7 w-7 p-0 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-red-400"
          title={t('codeblock.delete', 'Delete code block')}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* CodeMirror editor */}
      <div ref={elRef} className="min-h-[100px]" />
    </div>
  )
}

