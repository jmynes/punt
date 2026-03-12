'use client'

import { Bot, KeyRound, MessageSquare, User } from 'lucide-react'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

const ACCOUNT_TABS: TabItem[] = [
  {
    value: 'avatar',
    label: 'Account',
    href: '/account/avatar',
    icon: <User className="h-4 w-4" />,
  },
  {
    value: 'agents',
    label: 'Agents',
    href: '/account/agents',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    value: 'chat',
    label: 'Chat',
    href: '/account/chat',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    value: 'security',
    label: 'Security',
    href: '/account/security',
    icon: <KeyRound className="h-4 w-4" />,
  },
]

const TAB_ROUTES = ['/account/avatar', '/account/agents', '/account/chat', '/account/security']

interface AccountTabsProps {
  activeTab: string
}

export function AccountTabs({ activeTab }: AccountTabsProps) {
  useTabCycleShortcut({ tabs: TAB_ROUTES })

  return <ResponsiveTabs tabs={ACCOUNT_TABS} activeValue={activeTab} className="mb-6" />
}
