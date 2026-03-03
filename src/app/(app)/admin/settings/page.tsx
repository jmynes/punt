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
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

type SettingsTab =
  | 'board'
  | 'branding'
  | 'database'
  | 'roles'
  | 'email'
  | 'uploads'
  | 'sprints'
  | 'updates'

const VALID_TABS: SettingsTab[] = [
  'board',
  'branding',
  'database',
  'roles',
  'email',
  'uploads',
  'sprints',
  'updates',
]

const TABS: TabItem[] = [
  {
    value: 'board',
    label: 'Board',
    href: '/admin/settings?tab=board',
    icon: <Columns3 className="h-4 w-4" />,
  },
  {
    value: 'branding',
    label: 'Branding',
    href: '/admin/settings?tab=branding',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    value: 'database',
    label: 'Database',
    href: '/admin/settings?tab=database',
    icon: <Database className="h-4 w-4" />,
  },
  {
    value: 'roles',
    label: 'Default Roles',
    href: '/admin/settings?tab=roles',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: 'email',
    label: 'Email',
    href: '/admin/settings?tab=email',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    value: 'uploads',
    label: 'File Uploads',
    href: '/admin/settings?tab=uploads',
    icon: <Upload className="h-4 w-4" />,
  },
  {
    value: 'sprints',
    label: 'Sprints',
    href: '/admin/settings?tab=sprints',
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    value: 'updates',
    label: 'Updates',
    href: '/admin/settings?tab=updates',
    icon: <RefreshCw className="h-4 w-4" />,
  },
]

function isValidTab(tab: string | null): tab is SettingsTab {
  return tab !== null && VALID_TABS.includes(tab as SettingsTab)
}

export default function AdminSettingsPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab = isValidTab(tabParam) ? tabParam : 'board'

  // Tab cycling keyboard shortcut (Ctrl+Shift+Arrow)
  useTabCycleShortcut({
    tabs: VALID_TABS,
    queryBasePath: '/admin/settings',
  })

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
        <ResponsiveTabs tabs={TABS} activeValue={activeTab} className="mb-6" />

        {/* Tab Content */}
        {activeTab === 'board' && <BoardSettingsForm />}
        {activeTab === 'branding' && <BrandingSettingsForm />}
        {activeTab === 'database' && <DatabaseSettings />}
        {activeTab === 'roles' && <RolePermissionsForm />}
        {activeTab === 'email' && <EmailSettingsForm />}
        {activeTab === 'uploads' && <SettingsForm />}
        {activeTab === 'sprints' && <SprintSettingsForm />}
        {activeTab === 'updates' && <RepositorySettingsForm />}

        {/* Footer spacer */}
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
