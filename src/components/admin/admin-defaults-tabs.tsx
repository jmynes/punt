'use client'

import { Bot, CalendarClock, Columns3, GitBranch, Shield, Webhook } from 'lucide-react'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

const DEFAULTS_TABS: TabItem[] = [
  {
    value: 'agents',
    label: 'Agents',
    href: '/admin/defaults/agents',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    value: 'board',
    label: 'Board',
    href: '/admin/defaults/board',
    icon: <Columns3 className="h-4 w-4" />,
  },
  {
    value: 'hooks',
    label: 'Hooks',
    href: '/admin/defaults/hooks',
    icon: <Webhook className="h-4 w-4" />,
  },
  {
    value: 'repository',
    label: 'Repository',
    href: '/admin/defaults/repository',
    icon: <GitBranch className="h-4 w-4" />,
  },
  {
    value: 'roles',
    label: 'Roles',
    href: '/admin/defaults/roles',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: 'sprints',
    label: 'Sprints',
    href: '/admin/defaults/sprints',
    icon: <CalendarClock className="h-4 w-4" />,
  },
]

const TAB_ROUTES = DEFAULTS_TABS.map((t) => t.href)

interface AdminDefaultsTabsProps {
  activeTab: string
}

export function AdminDefaultsTabs({ activeTab }: AdminDefaultsTabsProps) {
  useTabCycleShortcut({ tabs: TAB_ROUTES })

  return <ResponsiveTabs tabs={DEFAULTS_TABS} activeValue={activeTab} className="mb-6" />
}
