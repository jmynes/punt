'use client'

import {
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
} from '@mdxeditor/editor'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import '@mdxeditor/editor/style.css'
import { oneDark } from '@codemirror/theme-one-dark'
import { linkifyMentions, linkifyTicketReferences } from '@/lib/ticket-references'

interface MarkdownViewerProps {
  markdown: string
  className?: string
  /** Called when a ticket reference is clicked. If provided, uses this instead of navigation. */
  onTicketClick?: (ticketKey: string) => void
}

/**
 * A read-only markdown viewer that renders markdown content consistently
 * with the DescriptionEditor styling. Uses MDXEditor in read-only mode
 * without the toolbar for a lightweight view-only display.
 */
export const MarkdownViewer = React.memo(function MarkdownViewer({
  markdown,
  className = '',
  onTicketClick,
}: MarkdownViewerProps) {
  const router = useRouter()
  // Prevent hydration mismatch by only rendering on client
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Handle clicks on ticket reference links
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // Check if this is a ticket reference link (e.g., /projects/PUNT/PUNT-123)
      const ticketLinkMatch = href.match(/^\/projects\/([A-Z][A-Z0-9]+)\/([A-Z][A-Z0-9]+-\d+)$/)
      if (!ticketLinkMatch) return

      const ticketKey = ticketLinkMatch[2]

      // Ctrl+click or middle click - let browser handle (open in new tab)
      if (e.ctrlKey || e.metaKey || e.button === 1) {
        return
      }

      // Prevent default MDXEditor link behavior
      e.preventDefault()
      e.stopPropagation()

      // If custom handler provided, use it
      if (onTicketClick) {
        onTicketClick(ticketKey)
      } else {
        // Navigate to the ticket
        router.push(href)
      }
    },
    [router, onTicketClick],
  )

  // Memoize plugins for read-only viewing (no toolbar, no editing features)
  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      imagePlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
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
        codeMirrorExtensions: [oneDark],
      }),
    ],
    [],
  )

  // Preprocess markdown: strip trailing blank lines that MDXEditor converts to empty <p><br></p>,
  // then convert ticket references and @mentions into styled text
  const processedMarkdown = useMemo(() => {
    // Remove trailing newlines/whitespace - MDXEditor adds <p><br></p> for these
    // This preserves intentional blank lines within content, only strips trailing ones
    const trimmed = markdown.trimEnd()
    // Chain linkifiers: tickets become links, mentions become bold
    return linkifyMentions(linkifyTicketReferences(trimmed))
  }, [markdown])

  // Show loading placeholder during SSR to prevent hydration mismatch
  if (!isMounted) {
    return <div className={`text-sm text-zinc-300 ${className}`}>{markdown}</div>
  }

  return (
    <div
      className={`markdown-viewer ${className}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        // Handle keyboard navigation for accessibility
        if (e.key === 'Enter') {
          const target = e.target as HTMLElement
          if (target.tagName === 'A') {
            handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)
          }
        }
      }}
    >
      <MDXEditor
        markdown={processedMarkdown}
        readOnly
        plugins={plugins}
        contentEditableClassName="prose prose-invert prose-sm max-w-none text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_em]:italic [&_code]:text-amber-400 [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-zinc-950 [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:p-3 [&_pre]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-amber-400 [&_pre_code]:px-0 [&_a]:text-amber-500 [&_a:hover]:text-amber-400 [&_a]:underline [&_h1]:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-zinc-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-zinc-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-1 [&_h4]:text-zinc-100 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-1.5 [&_h4]:mb-1 [&_h5]:text-zinc-100 [&_h5]:font-semibold [&_h5]:mt-1 [&_h5]:mb-1 [&_h6]:text-zinc-100 [&_h6]:font-semibold [&_h6]:mt-1 [&_h6]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-500 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-300 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-0.5 [&_li]:text-zinc-300 [&_p]:text-zinc-300 [&_p]:mb-1 [&_hr]:border-zinc-600 [&_hr]:border-t-2 [&_hr]:my-2"
        className="dark-theme [&_.mdxeditor-toolbar]:hidden"
      />
    </div>
  )
})
