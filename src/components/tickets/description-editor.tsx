'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  markdownShortcutPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  diffSourcePlugin,
  BoldItalicUnderlineToggles,
  CodeToggle,
  ListsToggle,
  UndoRedo,
  CreateLink,
  InsertCodeBlock,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { oneDark } from '@codemirror/theme-one-dark'
import { CustomBlockTypeSelect } from './custom-block-type-select'
import { CustomCodeMirrorEditor } from './custom-codemirror-editor'
import { CustomDiffSourceToggleWrapper } from './custom-diff-source-toggle-wrapper'

interface DescriptionEditorProps {
  markdown: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export const DescriptionEditor = React.memo(function DescriptionEditor({
  markdown,
  onChange,
  disabled = false,
  placeholder = 'Add a more detailed description...',
}: DescriptionEditorProps) {
  // Prevent hydration mismatch by only rendering on client
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])
  // Memoize toolbar contents to prevent re-creation
  const toolbarContents = useCallback(
    () => (
      <CustomDiffSourceToggleWrapper options={['rich-text', 'source', 'diff']}>
        <UndoRedo />
        <BoldItalicUnderlineToggles />
        <CodeToggle />
        <ListsToggle />
        <CustomBlockTypeSelect />
        <InsertCodeBlock />
        <CreateLink />
      </CustomDiffSourceToggleWrapper>
    ),
    [],
  )

  // Memoize plugins to prevent re-creation on every render
  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      diffSourcePlugin({
        viewMode: 'rich-text',
        diffMarkdown: '',
        codeMirrorExtensions: [oneDark],
      }),
      codeBlockPlugin({
        defaultCodeBlockLanguage: 'text',
        codeBlockEditorDescriptors: [
          {
            match: (language, meta) => !meta,
            priority: 1,
            Editor: CustomCodeMirrorEditor,
          },
        ],
      }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          '': 'Plain Text',
          text: 'Plain Text',
          js: 'JavaScript',
          javascript: 'JavaScript',
          ts: 'TypeScript',
          typescript: 'TypeScript',
          jsx: 'JSX',
          tsx: 'TSX',
          json: 'JSON',
          css: 'CSS',
          html: 'HTML',
          python: 'Python',
          java: 'Java',
          c: 'C',
          cpp: 'C++',
          csharp: 'C#',
          php: 'PHP',
          ruby: 'Ruby',
          go: 'Go',
          rust: 'Rust',
          sql: 'SQL',
          bash: 'Bash',
          shell: 'Shell',
          sh: 'Shell',
          yaml: 'YAML',
          yml: 'YAML',
          markdown: 'Markdown',
          md: 'Markdown',
        },
      }),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarContents,
      }),
    ],
    [toolbarContents],
  )

  // Show placeholder during SSR to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="space-y-2" style={{ position: 'relative', zIndex: 1 }}>
        <div
          className="border border-zinc-700 rounded-md bg-zinc-900 min-h-[150px] p-4 text-sm text-zinc-500"
          style={{ overflow: 'visible', position: 'relative' }}
        >
          {placeholder}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2" style={{ position: 'relative', zIndex: 1 }}>
      {/* Container with border and dark theme styling - overflow visible for dropdowns */}
      <div
        className="border border-zinc-700 rounded-md bg-zinc-900"
        style={{ overflow: 'visible', position: 'relative' }}
      >
        <MDXEditor
          markdown={markdown}
          onChange={onChange}
          readOnly={disabled}
          plugins={plugins}
          placeholder={placeholder}
          contentEditableClassName="prose prose-invert max-w-none min-h-[150px] p-4 text-sm text-zinc-300 focus:outline-none [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_em]:italic [&_code]:text-amber-400 [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-zinc-950 [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:p-3 [&_pre]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-amber-400 [&_pre_code]:px-0 [&_a]:text-amber-500 [&_a:hover]:text-amber-400 [&_a]:underline [&_h1]:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-zinc-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-zinc-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h4]:text-zinc-100 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h5]:text-zinc-100 [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-2 [&_h6]:text-zinc-100 [&_h6]:font-semibold [&_h6]:mt-2 [&_h6]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-500 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-300 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-1 [&_li]:text-zinc-300 [&_p]:text-zinc-300 [&_p]:mb-2"
          className="dark-theme"
        />
      </div>
    </div>
  )
})

