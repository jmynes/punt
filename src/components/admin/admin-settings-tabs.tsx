'use client'

import {
  Bot,
  CalendarClock,
  Columns3,
  Database,
  GitBranch,
  Mail,
  Palette,
  RefreshCw,
  Shield,
  Upload,
  Webhook,
} from 'lucide-react'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

const ADMIN_SETTINGS_TABS: TabItem[] = [
  {
    value: 'agents',
    label: 'Agents',
    href: '/admin/settings/agents',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    value: 'board',
    label: 'Board',
    href: '/admin/settings/board',
    icon: <Columns3 className="h-4 w-4" />,
  },
  {
    value: 'branding',
    label: 'Branding',
    href: '/admin/settings/branding',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    value: 'database',
    label: 'Database',
    href: '/admin/settings/database',
    icon: <Database className="h-4 w-4" />,
  },
  {
    value: 'email',
    label: 'Email',
    href: '/admin/settings/email',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    value: 'uploads',
    label: 'File Uploads',
    href: '/admin/settings/uploads',
    icon: <Upload className="h-4 w-4" />,
  },
  {
    value: 'hooks',
    label: 'Hooks',
    href: '/admin/settings/hooks',
    icon: <Webhook className="h-4 w-4" />,
  },
  {
    value: 'repository',
    label: 'Repository',
    href: '/admin/settings/repository',
    icon: <GitBranch className="h-4 w-4" />,
  },
  {
    value: 'roles',
    label: 'Roles',
    href: '/admin/settings/roles',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: 'sprints',
    label: 'Sprints',
    href: '/admin/settings/sprints',
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    value: 'updates',
    label: 'Updates',
    href: '/admin/settings/updates',
    icon: <RefreshCw className="h-4 w-4" />,
  },
]

const TAB_ROUTES = [
  '/admin/settings/agents',
  '/admin/settings/board',
  '/admin/settings/branding',
  '/admin/settings/database',
  '/admin/settings/email',
  '/admin/settings/uploads',
  '/admin/settings/hooks',
  '/admin/settings/repository',
  '/admin/settings/roles',
  '/admin/settings/sprints',
  '/admin/settings/updates',
]

interface AdminSettingsTabsProps {
  activeTab: string
}

export function AdminSettingsTabs({ activeTab }: AdminSettingsTabsProps) {
  useTabCycleShortcut({ tabs: TAB_ROUTES })

  return <ResponsiveTabs tabs={ADMIN_SETTINGS_TABS} activeValue={activeTab} className="mb-6" />
}
