'use client'

import {
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  InsertThematicBreak,
  imagePlugin,
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
import type { TicketWithRelations, UserSummary } from '@/types'
import { autocompletePlugin } from './autocomplete-plugin'
import { CustomBlockTypeSelect } from './custom-block-type-select'
import { CustomCodeMirrorEditor } from './custom-codemirror-editor'
import { CustomImageDialog } from './custom-image-dialog'
import { ResponsiveBoldItalicUnderlineToggle } from './responsive-bold-italic-underline-toggle'
import { ResponsiveCodeToggle } from './responsive-code-toggle'
import { ResponsiveLinkImageToggle } from './responsive-link-image-toggle'
import { ResponsiveListsToggle } from './responsive-lists-toggle'
import { ResponsiveStrikeSupSubToggle } from './responsive-strike-sup-sub-toggle'
import { ResponsiveUndoRedoToggle } from './responsive-undo-redo-toggle'
import { ResponsiveViewModeToggle } from './responsive-view-mode-toggle'

interface DescriptionEditorProps {
  markdown: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Tickets for #reference autocomplete */
  tickets?: TicketWithRelations[]
  /** Members for @mention autocomplete */
  members?: UserSummary[]
  /** Project key for ticket references (e.g., "PUNT") */
  projectKey?: string
}

export const DescriptionEditor = React.memo(function DescriptionEditor({
  markdown,
  onChange,
  disabled = false,
  placeholder = 'Add a more detailed description...',
  tickets = [],
  members = [],
  projectKey = '',
}: DescriptionEditorProps) {
  // Prevent hydration mismatch by only rendering on client
  const [isMounted, setIsMounted] = useState(false)
  // Store original markdown for diff view (left side)
  // This should be the "saved" version when the editor was first opened, not the current edited version
  const originalMarkdownRef = useRef(markdown)
  // Track a hash of the original to detect when we've switched to a completely different ticket
  const originalHashRef = useRef<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update original markdown only when we detect a ticket switch
  // We detect this by checking if the markdown is substantially different from what we captured as original
  // This happens when switching tickets, not during normal editing
  useEffect(() => {
    const currentHash =
      markdown.length > 0 ? `${markdown.length}-${markdown.substring(0, 50)}` : 'empty'
    const originalHash = originalHashRef.current

    // If we don't have an original hash yet, or the current markdown is substantially different
    // from what we captured as original, it means we've switched tickets
    if (originalHash === null) {
      // First time - capture as original
      originalMarkdownRef.current = markdown
      originalHashRef.current = currentHash
    } else if (currentHash !== originalHash) {
      // The markdown is different from what we captured as original
      // Check if it's a substantial difference (likely a ticket switch, not just editing)
      const original = originalMarkdownRef.current
      const isSubstantialChange =
        Math.abs(markdown.length - original.length) > 50 ||
        (markdown.length > 0 &&
          original.length > 0 &&
          markdown.substring(0, 100) !== original.substring(0, 100))

      if (isSubstantialChange) {
        // This is likely a ticket switch - update the original
        originalMarkdownRef.current = markdown
        originalHashRef.current = currentHash
      }
    }
  }, [markdown])
  // Memoize toolbar contents to prevent re-creation
  const toolbarContents = useCallback(
    () => (
      <ResponsiveViewModeToggle options={['rich-text', 'source', 'diff']}>
        <ResponsiveUndoRedoToggle />
        <Separator />
        <ResponsiveBoldItalicUnderlineToggle />
        <ResponsiveStrikeSupSubToggle />
        <ResponsiveCodeToggle />
        <Separator />
        <ResponsiveListsToggle />
        <CustomBlockTypeSelect />
        <Separator />
        <ResponsiveLinkImageToggle />
        <InsertThematicBreak />
      </ResponsiveViewModeToggle>
    ),
    [],
  )

  // Memoize plugins to prevent re-creation on every render
  // Recreate plugins when markdown changes (switching tickets) to update diffMarkdown
  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin({
        ImageDialog: CustomImageDialog,
      }),
      tablePlugin(),
      thematicBreakPlugin(),
      diffSourcePlugin({
        viewMode: 'rich-text',
        diffMarkdown: originalMarkdownRef.current,
        codeMirrorExtensions: [oneDark],
      }),
      codeBlockPlugin({
        defaultCodeBlockLanguage: 'text',
        codeBlockEditorDescriptors: [
          {
            match: (_language, meta) => !meta,
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
      // Autocomplete for #ticket references and @mentions
      autocompletePlugin({
        tickets,
        members,
        projectKey,
      }),
    ],
    [toolbarContents, tickets, members, projectKey], // Recreate plugins when autocomplete data changes
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
    <div className="space-y-2 w-full min-w-0" style={{ position: 'relative', zIndex: 1 }}>
      {/* Container with border and dark theme styling - overflow visible for dropdowns */}
      <div
        className="border border-zinc-700 rounded-md bg-zinc-900 w-full min-w-0 max-w-full"
        style={{ overflow: 'visible', position: 'relative' }}
      >
        <MDXEditor
          markdown={markdown}
          onChange={onChange}
          readOnly={disabled}
          plugins={plugins}
          placeholder={placeholder}
          contentEditableClassName="prose prose-invert max-w-none min-h-[150px] p-4 text-sm text-zinc-300 focus:outline-none [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_em]:italic [&_code]:text-amber-400 [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-zinc-950 [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:p-3 [&_pre]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-amber-400 [&_pre_code]:px-0 [&_a]:text-amber-500 [&_a:hover]:text-amber-400 [&_a]:underline [&_h1]:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-zinc-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-zinc-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h4]:text-zinc-100 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h5]:text-zinc-100 [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-2 [&_h6]:text-zinc-100 [&_h6]:font-semibold [&_h6]:mt-2 [&_h6]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-500 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-300 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-1 [&_li]:text-zinc-300 [&_p]:text-zinc-300 [&_p]:mb-2 [&_hr]:border-zinc-600 [&_hr]:border-t-2 [&_hr]:my-4"
          className="dark-theme"
        />
      </div>
    </div>
  )
})
