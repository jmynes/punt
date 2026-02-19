'use client'

import {
  CalendarClock,
  Columns3,
  Database,
  Mail,
  Palette,
  RefreshCw,
  Settings,
  Shield,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BoardSettingsForm } from '@/components/admin/board-settings-form'
import { BrandingSettingsForm } from '@/components/admin/branding-settings-form'
import { DatabaseSettings } from '@/components/admin/database-settings'
import { EmailSettingsForm } from '@/components/admin/email-settings-form'
import { RepositorySettingsForm } from '@/components/admin/repository-settings-form'
import { RolePermissionsForm } from '@/components/admin/role-permissions-form'
import { SettingsForm } from '@/components/admin/settings-form'
import { SprintSettingsForm } from '@/components/admin/sprint-settings-form'
import { PageHeader } from '@/components/common'
import { cn } from '@/lib/utils'

type SettingsTab =
  | 'email'
  | 'branding'
  | 'uploads'
  | 'board'
  | 'sprints'
  | 'roles'
  | 'updates'
  | 'database'

const VALID_TABS: SettingsTab[] = [
  'email',
  'branding',
  'uploads',
  'board',
  'sprints',
  'roles',
  'updates',
  'database',
]

function isValidTab(tab: string | null): tab is SettingsTab {
  return tab !== null && VALID_TABS.includes(tab as SettingsTab)
}

export default function AdminSettingsPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab = isValidTab(tabParam) ? tabParam : 'email'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={Settings}
        category="Admin"
        title="System Settings"
        description="Configure uploads, branding, roles, and database options"
        variant="hero"
        accentColor="amber"
      />

      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 overflow-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          <Link
            href="/admin/settings?tab=email"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'email'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Mail className="h-4 w-4" />
            Email
          </Link>
          <Link
            href="/admin/settings?tab=branding"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'branding'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Palette className="h-4 w-4" />
            Branding
          </Link>
          <Link
            href="/admin/settings?tab=uploads"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'uploads'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Upload className="h-4 w-4" />
            File Uploads
          </Link>
          <Link
            href="/admin/settings?tab=board"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'board'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Columns3 className="h-4 w-4" />
            Board
          </Link>
          <Link
            href="/admin/settings?tab=sprints"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'sprints'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <CalendarClock className="h-4 w-4" />
            Sprints
          </Link>
          <Link
            href="/admin/settings?tab=roles"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'roles'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Shield className="h-4 w-4" />
            Default Roles
          </Link>
          <Link
            href="/admin/settings?tab=updates"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'updates'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <RefreshCw className="h-4 w-4" />
            Updates
          </Link>
          <Link
            href="/admin/settings?tab=database"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
              activeTab === 'database'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Database className="h-4 w-4" />
            Database
          </Link>
        </div>

        {/* Tab Content */}
        {activeTab === 'email' && <EmailSettingsForm />}
        {activeTab === 'branding' && <BrandingSettingsForm />}
        {activeTab === 'uploads' && <SettingsForm />}
        {activeTab === 'board' && <BoardSettingsForm />}
        {activeTab === 'sprints' && <SprintSettingsForm />}
        {activeTab === 'roles' && <RolePermissionsForm />}
        {activeTab === 'updates' && <RepositorySettingsForm />}
        {activeTab === 'database' && <DatabaseSettings />}

        {/* Footer spacer */}
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
