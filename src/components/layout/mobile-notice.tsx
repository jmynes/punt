'use client'

import { Monitor } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function MobileNotice() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 p-8 lg:hidden">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-6 rounded-full bg-zinc-900 p-4">
          <Monitor className="h-8 w-8 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-zinc-100">Desktop recommended</h2>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">
          PUNT is optimized for desktop browsers. Mobile support is in progress &mdash; for the best
          experience, please use a desktop or laptop with a wider screen.
        </p>
        <Button variant="outline" onClick={() => setDismissed(true)}>
          Continue anyway
        </Button>
      </div>
    </div>
  )
}
