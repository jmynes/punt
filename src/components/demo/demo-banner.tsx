'use client'

import { demoStorage, isDemoMode } from '@/lib/demo'

/**
 * Demo mode banner shown at the top of the page
 * Indicates that data is stored locally and will reset on browser clear
 */
export function DemoBanner() {
  if (!isDemoMode()) {
    return null
  }

  const handleReset = () => {
    if (confirm('Reset all demo data? This will restore the original sample data.')) {
      demoStorage.reset()
      window.location.reload()
    }
  }

  return (
    <div className="bg-amber-500 text-amber-950 text-center py-1.5 px-4 text-sm flex items-center justify-center gap-4">
      <span>
        <strong>Demo Mode</strong> - Data is stored in your browser and will reset when you clear
        browser data
      </span>
      <button
        type="button"
        onClick={handleReset}
        className="underline hover:no-underline text-amber-900 font-medium"
      >
        Reset Demo
      </button>
    </div>
  )
}
