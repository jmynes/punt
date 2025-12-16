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
import type React from 'react'

// MDXEditor CSS module class names (styles are loaded globally via @mdxeditor/editor/style.css)
const styles = {
  diffSourceToggleWrapper: '_diffSourceToggleWrapper_1e2ox_986',
  toolbarTitleMode: '_toolbarTitleMode_1e2ox_1027',
  diffSourceToggle: '_diffSourceToggle_1e2ox_986',
  ggDiffSourceToggle: '_ggDiffSourceToggle_1e2ox_994',
}

interface CustomDiffSourceToggleWrapperProps {
  children: React.ReactNode
  options?: ('rich-text' | 'diff' | 'source')[]
  SourceToolbar?: React.ReactNode
}

export function CustomDiffSourceToggleWrapper({
  children,
  options = ['rich-text', 'source', 'diff'],
  SourceToolbar,
}: CustomDiffSourceToggleWrapperProps) {
  const [viewMode, iconComponentFor] = useCellValues(viewMode$, iconComponentFor$)
  const changeViewMode = usePublisher(viewMode$)
  const t = useTranslation()

  // Build toggleGroupItems in the order specified by options array
  const toggleGroupItems = options
    .map((option) => {
      switch (option) {
        case 'rich-text':
          return {
            title: t('toolbar.richText', 'Rich text'),
            contents: iconComponentFor('rich_text'),
            value: 'rich-text',
          }
        case 'diff':
          return {
            title: t('toolbar.diffMode', 'Diff mode'),
            contents: iconComponentFor('difference'),
            value: 'diff',
          }
        case 'source':
          return {
            title: t('toolbar.source', 'Source mode'),
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
