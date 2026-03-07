'use client'

import { Database, Mail, Palette, RefreshCw, Upload } from 'lucide-react'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

const SYSTEM_TABS: TabItem[] = [
  {
    value: 'branding',
    label: 'Branding',
    href: '/admin/system/branding',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    value: 'database',
    label: 'Database',
    href: '/admin/system/database',
    icon: <Database className="h-4 w-4" />,
  },
  {
    value: 'email',
    label: 'Email',
    href: '/admin/system/email',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    value: 'uploads',
    label: 'File Uploads',
    href: '/admin/system/uploads',
    icon: <Upload className="h-4 w-4" />,
  },
  {
    value: 'updates',
    label: 'Updates',
    href: '/admin/system/updates',
    icon: <RefreshCw className="h-4 w-4" />,
  },
]

const TAB_ROUTES = SYSTEM_TABS.map((t) => t.href)

interface AdminSystemTabsProps {
  activeTab: string
}

export function AdminSystemTabs({ activeTab }: AdminSystemTabsProps) {
  useTabCycleShortcut({ tabs: TAB_ROUTES })

  return <ResponsiveTabs tabs={SYSTEM_TABS} activeValue={activeTab} className="mb-6" />
}
