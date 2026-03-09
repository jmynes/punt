'use client'

import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, lineNumbers } from '@codemirror/view'
import {
  codeBlockLanguages$,
  codeMirrorAutoLoadLanguageSupport$,
  codeMirrorExtensions$,
  useCellValues,
} from '@mdxeditor/editor'
import { basicSetup } from 'codemirror'
import { Code } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ReadOnlyCodeBlockProps {
  language: string
  nodeKey: string
  code: string
  meta: string
  focusEmitter: unknown
}

/**
 * Read-only code block component for MarkdownViewer.
 * Displays the language as a static badge instead of an interactive dropdown,
 * since language selection doesn't make sense in read-only mode.
 */
export function ReadOnlyCodeBlock({
  language,
  nodeKey: _nodeKey,
  code,
  meta: _meta,
  focusEmitter: _focusEmitter,
}: ReadOnlyCodeBlockProps) {
  const [codeMirrorExtensions, autoLoadLanguageSupport, codeBlockLanguages] = useCellValues(
    codeMirrorExtensions$,
    codeMirrorAutoLoadLanguageSupport$,
    codeBlockLanguages$,
  )

  const elRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    let cleanup: (() => void) | undefined

    void (async () => {
      const extensions = [
        ...codeMirrorExtensions,
        basicSetup,
        oneDark,
        lineNumbers(),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ]

      if (language !== '' && autoLoadLanguageSupport) {
        const languageData = languages.find((l) => {
          return (
            l.name === language || l.alias.includes(language) || l.extensions.includes(language)
          )
        })
        if (languageData) {
          try {
            const languageSupport = await languageData.load()
            extensions.push(languageSupport.extension)
          } catch (_e) {
            console.warn('failed to load language support for', language)
          }
        }
      }

      // Add theme overrides to match the editable code block styling
      extensions.push(
        EditorView.theme(
          {
            '.cm-activeLine': {
              backgroundColor: 'rgb(24 24 27)', // zinc-900
            },
            '.cm-activeLineGutter': {
              backgroundColor: 'rgb(217 119 6 / 0.2)', // amber-600 with opacity
            },
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
              backgroundColor: 'rgb(217 119 6 / 0.4)', // amber-600 with opacity
            },
          },
          { dark: true },
        ),
      )

      el.innerHTML = ''
      editorViewRef.current = new EditorView({
        parent: el,
        state: EditorState.create({ doc: code, extensions }),
      })

      cleanup = () => {
        editorViewRef.current?.destroy()
        editorViewRef.current = null
      }
    })()

    return cleanup
  }, [language, codeMirrorExtensions, autoLoadLanguageSupport, code])

  // Get display label for the language
  const displayLabel =
    (codeBlockLanguages as Record<string, string>)[language] || (codeBlockLanguages as Record<string, string>)[''] || language || 'Plain Text'

  return (
    <div className="border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden">
      {/* Static language badge header */}
      <div className="flex items-center gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs">
          <Code className="h-3 w-3" />
          <span>{displayLabel}</span>
        </div>
      </div>

      {/* CodeMirror editor (read-only) */}
      <div ref={elRef} />
    </div>
  )
}
