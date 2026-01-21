'use client'

import { Settings } from 'lucide-react'
import { SettingsForm } from '@/components/admin/settings-form'

export default function AdminSettingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 py-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold text-zinc-100">System Settings</h1>
        </div>

        <SettingsForm />

        {/* Footer spacer */}
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
