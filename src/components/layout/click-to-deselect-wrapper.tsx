'use client'

import type { ReactNode } from 'react'
import { useClickToDeselect } from '@/hooks/use-click-to-deselect'

/**
 * Client wrapper that attaches the click-to-deselect handler at the app layout level.
 * This ensures that clicks on the header, footer, sidebar, and any dead space
 * clear the ticket selection, not just clicks within individual page containers.
 */
export function ClickToDeselectWrapper({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const handleDeselect = useClickToDeselect()

  return (
    <div className={className} onClick={handleDeselect}>
      {children}
    </div>
  )
}
