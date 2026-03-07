'use client'

import {
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  InsertThematicBreak,
  ListsToggle,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  markdownShortcutPlugin,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@mdxeditor/editor/style.css'
import { oneDark } from '@codemirror/theme-one-dark'
import { CustomDiffSourceToggleWrapper } from '@/components/tickets/custom-diff-source-toggle-wrapper'

interface GuidanceEditorProps {
  markdown: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * A simplified markdown editor for agent guidance fields.
 * Uses MDXEditor with basic formatting toolbar and source/rich-text toggle.
 * Lighter than DescriptionEditor (no autocomplete, no diff view, no image upload).
 */
export const GuidanceEditor = React.memo(function GuidanceEditor({
  markdown,
  onChange,
  disabled = false,
  placeholder = 'Write markdown instructions for AI agents...',
}: GuidanceEditorProps) {
  const [isMounted, setIsMounted] = useState(false)
  // Track the last markdown value we passed to MDXEditor to detect external resets
  const lastMarkdownRef = useRef(markdown)
  // Counter to force MDXEditor remount when markdown is externally changed
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Detect external changes to markdown (e.g., reset, load from server)
  // and force MDXEditor to remount since it doesn't sync with prop changes
  useEffect(() => {
    if (lastMarkdownRef.current !== markdown) {
      lastMarkdownRef.current = markdown
      setEditorKey((k) => k + 1)
    }
  }, [markdown])

  // Wrap onChange to track what MDXEditor has internally
  const handleChange = useCallback(
    (value: string) => {
      lastMarkdownRef.current = value
      onChange(value)
    },
    [onChange],
  )

  const toolbarContents = useCallback(
    () => (
      <CustomDiffSourceToggleWrapper options={['rich-text', 'source']}>
        <BoldItalicUnderlineToggles />
        <Separator />
        <ListsToggle />
        <Separator />
        <InsertThematicBreak />
      </CustomDiffSourceToggleWrapper>
    ),
    [],
  )

  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      diffSourcePlugin({
        viewMode: 'rich-text',
        diffMarkdown: '',
        codeMirrorExtensions: [oneDark],
      }),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          '': 'Plain Text',
          text: 'Plain Text',
          js: 'JavaScript',
          ts: 'TypeScript',
          json: 'JSON',
          bash: 'Bash',
          yaml: 'YAML',
          markdown: 'Markdown',
        },
        codeMirrorExtensions: [oneDark],
      }),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarContents,
      }),
    ],
    [toolbarContents],
  )

  if (!isMounted) {
    return (
      <div
        className="border border-zinc-700 rounded-md bg-zinc-900 min-h-[200px] p-4 text-sm text-zinc-500"
        style={{ overflow: 'visible', position: 'relative' }}
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div className="w-full min-w-0" style={{ position: 'relative', zIndex: 1 }}>
      <div
        className="border border-zinc-700 rounded-md bg-zinc-900 w-full min-w-0 max-w-full"
        style={{ overflow: 'visible', position: 'relative' }}
      >
        <MDXEditor
          key={editorKey}
          markdown={markdown}
          onChange={handleChange}
          readOnly={disabled}
          plugins={plugins}
          placeholder={placeholder}
          contentEditableClassName="prose prose-invert max-w-none min-h-[200px] p-4 text-sm text-zinc-300 focus:outline-none [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_em]:italic [&_code]:text-amber-400 [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-zinc-950 [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:p-3 [&_pre]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-amber-400 [&_pre_code]:px-0 [&_a]:text-amber-500 [&_a:hover]:text-amber-400 [&_a]:underline [&_h1]:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-zinc-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-zinc-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h4]:text-zinc-100 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h5]:text-zinc-100 [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-2 [&_h6]:text-zinc-100 [&_h6]:font-semibold [&_h6]:mt-2 [&_h6]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-500 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-300 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-1 [&_li]:text-zinc-300 [&_p]:text-zinc-300 [&_p]:mb-2 [&_hr]:border-zinc-600 [&_hr]:border-t-2 [&_hr]:my-4"
          className="dark-theme"
        />
      </div>
    </div>
  )
})
