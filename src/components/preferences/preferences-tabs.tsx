'use client'

import { Bell, Palette, Sliders } from 'lucide-react'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'

const PREFERENCES_TABS: TabItem[] = [
  {
    value: 'general',
    label: 'General',
    href: '/preferences/general',
    icon: <Sliders className="h-4 w-4" />,
  },
  {
    value: 'appearance',
    label: 'Appearance',
    href: '/preferences/appearance',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    value: 'notifications',
    label: 'Notifications',
    href: '/preferences/notifications',
    icon: <Bell className="h-4 w-4" />,
  },
]

const TAB_ROUTES = ['/preferences/general', '/preferences/appearance', '/preferences/notifications']

interface PreferencesTabsProps {
  activeTab: string
}

export function PreferencesTabs({ activeTab }: PreferencesTabsProps) {
  useTabCycleShortcut({ tabs: TAB_ROUTES })

  return <ResponsiveTabs tabs={PREFERENCES_TABS} activeValue={activeTab} className="mb-6" />
}
