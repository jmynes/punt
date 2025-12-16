'use client'

import {
  iconComponentFor$,
  SingleChoiceToggleGroup,
  useCellValues,
  usePublisher,
  useTranslation,
  type ViewMode,
  viewMode$,
} from '@mdxeditor/editor'
import { ChevronDown } from 'lucide-react'
import type React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'

// MDXEditor CSS module class names
const styles = {
  diffSourceToggleWrapper: '_diffSourceToggleWrapper_1e2ox_986',
  toolbarTitleMode: '_toolbarTitleMode_1e2ox_1027',
  diffSourceToggle: '_diffSourceToggle_1e2ox_986',
  ggDiffSourceToggle: '_ggDiffSourceToggle_1e2ox_994',
}

interface ResponsiveViewModeToggleProps {
  children: React.ReactNode
  options?: ViewMode[]
  SourceToolbar?: React.ReactNode
}

export function ResponsiveViewModeToggle({
  children,
  options = ['rich-text', 'source', 'diff'],
  SourceToolbar,
}: ResponsiveViewModeToggleProps) {
  const [viewMode, iconComponentFor] = useCellValues(viewMode$, iconComponentFor$)
  const changeViewMode = usePublisher(viewMode$)
  const t = useTranslation()
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')

  const viewModeLabels: Record<ViewMode, string> = {
    'rich-text': 'Rich',
    source: 'Source',
    diff: 'Diff',
  }

  if (isSmallScreen) {
    // Show as dropdown on small screens
    return (
      <>
        {viewMode === 'rich-text' ? (
          children
        ) : viewMode === 'diff' ? (
          <span className={styles.toolbarTitleMode}>{t('toolbar.diffMode', 'Diff mode')}</span>
        ) : (
          (SourceToolbar ?? (
            <span className={styles.toolbarTitleMode}>{t('toolbar.source', 'Source mode')}</span>
          ))
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              <span>{viewModeLabels[viewMode]}</span>
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
            {options.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => changeViewMode(option)}
                className={
                  viewMode === option
                    ? 'bg-zinc-800 text-amber-400'
                    : 'text-zinc-300 focus:bg-zinc-800'
                }
              >
                {iconComponentFor(
                  option === 'rich-text'
                    ? 'rich_text'
                    : option === 'diff'
                      ? 'difference'
                      : 'markdown',
                )}
                <span className="ml-2">{viewModeLabels[option]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )
  }

  // Show as toggle group on larger screens
  const toggleGroupItems = options
    .map((option) => {
      switch (option) {
        case 'rich-text':
          return {
            title: viewModeLabels['rich-text'],
            contents: iconComponentFor('rich_text'),
            value: 'rich-text',
          }
        case 'diff':
          return {
            title: viewModeLabels.diff,
            contents: iconComponentFor('difference'),
            value: 'diff',
          }
        case 'source':
          return {
            title: viewModeLabels.source,
            contents: iconComponentFor('markdown'),
            value: 'source',
          }
        default:
          return null
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <>
      {viewMode === 'rich-text' ? (
        children
      ) : viewMode === 'diff' ? (
        <span className={styles.toolbarTitleMode}>{t('toolbar.diffMode', 'Diff mode')}</span>
      ) : (
        (SourceToolbar ?? (
          <span className={styles.toolbarTitleMode}>{t('toolbar.source', 'Source mode')}</span>
        ))
      )}
      <div className={styles.diffSourceToggleWrapper}>
        <SingleChoiceToggleGroup
          className={styles.diffSourceToggle}
          ggClassName={styles.ggDiffSourceToggle}
          value={viewMode}
          items={toggleGroupItems}
          onChange={(value) => {
            changeViewMode((value === '' ? 'rich-text' : value) as ViewMode)
          }}
        />
      </div>
    </>
  )
}
