'use client'

import { Mail, Settings, Upload } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { EmailSettingsForm } from '@/components/admin/email-settings-form'
import { SettingsForm } from '@/components/admin/settings-form'
import { cn } from '@/lib/utils'

type SettingsTab = 'email' | 'uploads'

const VALID_TABS: SettingsTab[] = ['email', 'uploads']

function isValidTab(tab: string | null): tab is SettingsTab {
  return tab !== null && VALID_TABS.includes(tab as SettingsTab)
}

export default function AdminSettingsPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab = isValidTab(tabParam) ? tabParam : 'email'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 py-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold text-zinc-100">System Settings</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          <Link
            href="/admin/settings?tab=email"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'email'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Mail className="h-4 w-4" />
            Email
          </Link>
          <Link
            href="/admin/settings?tab=uploads"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'uploads'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Upload className="h-4 w-4" />
            File Uploads
          </Link>
        </div>

        {/* Tab Content */}
        {activeTab === 'email' && <EmailSettingsForm />}
        {activeTab === 'uploads' && <SettingsForm />}

        {/* Footer spacer */}
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
