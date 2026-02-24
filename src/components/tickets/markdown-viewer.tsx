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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@mdxeditor/editor/style.css'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ChecklistItem } from '@/lib/markdown-checklist'
import {
  hasChecklistItems,
  reconstructMarkdown,
  splitMarkdownSegments,
} from '@/lib/markdown-checklist'
import { linkifyMentions, linkifyTicketReferences } from '@/lib/ticket-references'
import { DraggableChecklist } from './draggable-checklist'

interface MarkdownViewerProps {
  markdown: string
  className?: string
  /** Called when a ticket reference is clicked. If provided, uses this instead of navigation. */
  onTicketClick?: (ticketKey: string) => void
  /** Called when checklist items are reordered or toggled. Enables interactive checklists. */
  onMarkdownChange?: (newMarkdown: string) => void
  /** When true, checkboxes are rendered as non-interactive (no pointer, no click effects). */
  readonlyCheckboxes?: boolean
}

/**
 * A read-only markdown viewer that renders markdown content consistently
 * with the DescriptionEditor styling. Uses MDXEditor in read-only mode
 * without the toolbar for a lightweight view-only display.
 *
 * When `onMarkdownChange` is provided, checklist items become interactive:
 * - Drag handles appear on hover for reordering
 * - Checkboxes can be toggled
 * - Changes are propagated via `onMarkdownChange`
 */
export const MarkdownViewer = React.memo(function MarkdownViewer({
  markdown,
  className = '',
  onTicketClick,
  onMarkdownChange,
  readonlyCheckboxes = false,
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

  // Generate a stable key based on markdown content to force MDXEditor remount when content changes.
  // MDXEditor maintains internal state that doesn't sync with prop changes, so we need to remount
  // when the markdown actually changes (e.g., after saving a description update).
  const editorKey = useMemo(() => {
    const content = processedMarkdown || ''
    return `${content.length}-${content.substring(0, 100)}`
  }, [processedMarkdown])

  // Parse segments synchronously so DraggableChecklist renders on the first frame
  // (avoids a flash of static MDXEditor checkboxes that aren't interactive).
  const parsedSegments = useMemo(() => {
    if (!onMarkdownChange || !hasChecklistItems(markdown)) return null
    return splitMarkdownSegments(markdown)
  }, [markdown, onMarkdownChange])

  // Optimistic overlay for rapid interactions. When the user toggles/reorders
  // faster than the API round-trip, this tracks the in-flight state so
  // consecutive changes build on each other instead of overwriting.
  const [optimisticSegments, setOptimisticSegments] = useState<ReturnType<
    typeof splitMarkdownSegments
  > | null>(null)

  // Active segments: optimistic if in-flight, otherwise parsed from prop
  const activeSegments = optimisticSegments ?? parsedSegments
  const activeSegmentsRef = useRef(activeSegments)
  activeSegmentsRef.current = activeSegments

  // Clear optimistic state when the server-confirmed markdown changes.
  // parsedSegments is intentionally in the dep array — we want to reset
  // optimistic state whenever the prop-derived segments change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional dep on parsedSegments
  useEffect(() => {
    setOptimisticSegments(null)
  }, [parsedSegments])

  // Handle checklist item reorder within a specific segment
  const handleChecklistReorder = useCallback(
    (segmentIndex: number, reorderedItems: ChecklistItem[]) => {
      const current = activeSegmentsRef.current
      if (!current || !onMarkdownChange) return
      const updatedSegments = current.map((seg) => {
        if (seg.index === segmentIndex) {
          return { ...seg, items: reorderedItems }
        }
        return seg
      })
      setOptimisticSegments(updatedSegments)
      onMarkdownChange(reconstructMarkdown(updatedSegments))
    },
    [onMarkdownChange],
  )

  // Handle checkbox toggle within a specific segment
  const handleCheckboxToggle = useCallback(
    (segmentIndex: number, itemId: string, checked: boolean) => {
      const current = activeSegmentsRef.current
      if (!current || !onMarkdownChange) return
      const updatedSegments = current.map((seg) => {
        if (seg.index === segmentIndex && seg.items) {
          return {
            ...seg,
            items: seg.items.map((item) => (item.id === itemId ? { ...item, checked } : item)),
          }
        }
        return seg
      })
      setOptimisticSegments(updatedSegments)
      onMarkdownChange(reconstructMarkdown(updatedSegments))
    },
    [onMarkdownChange],
  )

  // Show loading placeholder during SSR to prevent hydration mismatch
  if (!isMounted) {
    return <div className={`text-sm text-zinc-300 ${className}`}>{markdown}</div>
  }

  // When interactive checklists are enabled and the markdown contains checklist items,
  // render segments individually so checklist blocks get DnD support
  if (activeSegments) {
    return (
      <div
        className={`markdown-viewer ${className}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const target = e.target as HTMLElement
            if (target.tagName === 'A') {
              handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)
            }
          }
        }}
      >
        {activeSegments.map((segment) => {
          if (segment.type === 'checklist' && segment.items) {
            return (
              <DraggableChecklist
                key={`checklist-${segment.index}`}
                items={segment.items}
                onReorder={(reordered) => handleChecklistReorder(segment.index, reordered)}
                onToggle={(itemId, checked) => handleCheckboxToggle(segment.index, itemId, checked)}
              />
            )
          }

          // Regular markdown segment - render via MDXEditor
          const segmentContent = linkifyMentions(linkifyTicketReferences(segment.content.trimEnd()))
          // Skip empty segments (e.g., just whitespace between checklist blocks)
          if (!segmentContent.trim()) return null

          const segKey = `md-${segment.index}-${segmentContent.length}-${segmentContent.substring(0, 50)}`
          return (
            <MDXEditor
              key={segKey}
              markdown={segmentContent}
              readOnly
              plugins={plugins}
              contentEditableClassName="prose prose-invert prose-sm max-w-none text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_em]:italic [&_code]:text-amber-400 [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-zinc-950 [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:p-3 [&_pre]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-amber-400 [&_pre_code]:px-0 [&_a]:text-amber-500 [&_a:hover]:text-amber-400 [&_a]:underline [&_h1]:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-zinc-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-zinc-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-1 [&_h4]:text-zinc-100 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-1.5 [&_h4]:mb-1 [&_h5]:text-zinc-100 [&_h5]:font-semibold [&_h5]:mt-1 [&_h5]:mb-1 [&_h6]:text-zinc-100 [&_h6]:font-semibold [&_h6]:mt-1 [&_h6]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-500 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-300 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-0.5 [&_li]:text-zinc-300 [&_p]:text-zinc-300 [&_p]:mb-1 [&_hr]:border-zinc-600 [&_hr]:border-t-2 [&_hr]:my-2"
              className="dark-theme [&_.mdxeditor-toolbar]:hidden"
            />
          )
        })}
      </div>
    )
  }

  // Default: render the full markdown via MDXEditor (no interactive checklists)
  const baseContentStyles =
    'prose prose-invert prose-sm max-w-none text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_em]:italic [&_code]:text-amber-400 [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-zinc-950 [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:p-3 [&_pre]:rounded-md [&_pre_code]:bg-transparent [&_pre_code]:text-amber-400 [&_pre_code]:px-0 [&_a]:text-amber-500 [&_a:hover]:text-amber-400 [&_a]:underline [&_h1]:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-zinc-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-zinc-100 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-1 [&_h4]:text-zinc-100 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-1.5 [&_h4]:mb-1 [&_h5]:text-zinc-100 [&_h5]:font-semibold [&_h5]:mt-1 [&_h5]:mb-1 [&_h6]:text-zinc-100 [&_h6]:font-semibold [&_h6]:mt-1 [&_h6]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-500 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-300 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-0.5 [&_li]:text-zinc-300 [&_p]:text-zinc-300 [&_p]:mb-1 [&_hr]:border-zinc-600 [&_hr]:border-t-2 [&_hr]:my-2'

  return (
    <div
      className={`markdown-viewer ${className} ${readonlyCheckboxes ? 'readonly-checkboxes' : ''}`}
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
        key={editorKey}
        markdown={processedMarkdown}
        readOnly
        plugins={plugins}
        contentEditableClassName={baseContentStyles}
        className="dark-theme [&_.mdxeditor-toolbar]:hidden"
      />
      {readonlyCheckboxes && (
        <style>{`
          .readonly-checkboxes input[type="checkbox"],
          .readonly-checkboxes li {
            pointer-events: none !important;
            cursor: default !important;
          }
          .readonly-checkboxes a {
            pointer-events: auto !important;
            cursor: pointer !important;
          }
        `}</style>
      )}
    </div>
  )
})
