'use client'

import { Bot, KeyRound, Terminal, User } from 'lucide-react'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

const ACCOUNT_TABS: TabItem[] = [
  {
    value: 'avatar',
    label: 'Avatar',
    href: '/account/avatar',
    icon: <User className="h-4 w-4" />,
  },
  {
    value: 'chat',
    label: 'Chat',
    href: '/account/chat',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    value: 'mcp',
    label: 'MCP',
    href: '/account/mcp',
    icon: <Terminal className="h-4 w-4" />,
  },
  {
    value: 'security',
    label: 'Security',
    href: '/account/security',
    icon: <KeyRound className="h-4 w-4" />,
  },
]

const TAB_ROUTES = ['/account/avatar', '/account/chat', '/account/mcp', '/account/security']

interface AccountTabsProps {
  activeTab: string
}

export function AccountTabs({ activeTab }: AccountTabsProps) {
  useTabCycleShortcut({ tabs: TAB_ROUTES })

  return <ResponsiveTabs tabs={ACCOUNT_TABS} activeValue={activeTab} className="mb-6" />
}
