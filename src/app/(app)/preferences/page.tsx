'use client'

import { Bell, Bot, KeyRound, Palette, Settings, Sliders, Terminal, User } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/common'
import { ClaudeChatTab } from '@/components/profile/claude-chat-tab'
import { MCPTab } from '@/components/profile/mcp-tab'
import { ProfileTab } from '@/components/profile/profile-tab'
import { SecurityTab } from '@/components/profile/security-tab'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'
import { DEMO_USER, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useSettingsStore } from '@/stores/settings-store'

type PreferencesTab =
  | 'profile'
  | 'security'
  | 'mcp'
  | 'claude-chat'
  | 'general'
  | 'notifications'
  | 'appearance'

const VALID_TABS: PreferencesTab[] = [
  'profile',
  'security',
  'mcp',
  'claude-chat',
  'general',
  'notifications',
  'appearance',
]

function isValidTab(tab: string | null): tab is PreferencesTab {
  return tab !== null && VALID_TABS.includes(tab as PreferencesTab)
}

// Stable user data type for profile tabs
interface UserData {
  id: string
  name: string
  email: string | null
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
}

export default function PreferencesPage() {
  return (
    <Suspense>
      <PreferencesContent />
    </Suspense>
  )
}

function PreferencesContent() {
  const isDemo = isDemoMode()

  // Session management for profile tabs
  const { data: session, update: updateSession } = isDemo
    ? { data: null, update: async () => null }
    : // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
      useSession()

  const [stableUser, setStableUser] = useState<UserData | null>(
    isDemo
      ? {
          id: DEMO_USER.id,
          name: DEMO_USER.name,
          email: DEMO_USER.email,
          avatar: DEMO_USER.avatar,
          avatarColor: null,
          isSystemAdmin: DEMO_USER.isSystemAdmin,
        }
      : null,
  )

  const isUpdatingRef = useRef(false)

  useEffect(() => {
    if (isDemo) return
    if (session?.user?.id && !isUpdatingRef.current) {
      setStableUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.avatar,
        avatarColor: session.user.avatarColor,
        isSystemAdmin: session.user.isSystemAdmin,
      })
    }
  }, [
    isDemo,
    session?.user?.id,
    session?.user?.name,
    session?.user?.email,
    session?.user?.avatar,
    session?.user?.avatarColor,
    session?.user?.isSystemAdmin,
  ])

  // Debounced session update
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedUpdateSession = useCallback(async () => {
    if (isDemo) return
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current)
    }
    return new Promise<void>((resolve) => {
      pendingUpdateRef.current = setTimeout(async () => {
        isUpdatingRef.current = true
        try {
          await updateSession()
        } finally {
          setTimeout(() => {
            isUpdatingRef.current = false
          }, 100)
          resolve()
        }
      }, 50)
    })
  }, [isDemo, updateSession])

  const handleUserUpdate = useCallback((updates: Partial<UserData>) => {
    setStableUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  const {
    openSinglePastedTicket,
    setOpenSinglePastedTicket,
    ticketDateMaxYearMode,
    setTicketDateMaxYearMode,
    ticketDateMaxYear,
    setTicketDateMaxYear,
    autoSaveOnDrawerClose,
    setAutoSaveOnDrawerClose,
    autoSaveOnRoleEditorClose,
    setAutoSaveOnRoleEditorClose,
    keepSelectionAfterAction,
    setKeepSelectionAfterAction,
    collapseAttachmentsByDefault,
    setCollapseAttachmentsByDefault,
    toastAutoDismiss,
    setToastAutoDismiss,
    toastDismissDelay,
    setToastDismissDelay,
    errorToastAutoDismiss,
    setErrorToastAutoDismiss,
    persistTableSort,
    setPersistTableSort,
    searchPersistence,
    setSearchPersistence,
    sidebarExpandedSections,
    setSidebarSectionExpanded,
    hideColorRemovalWarning,
    setHideColorRemovalWarning,
    enableParticleAnimations,
    setEnableParticleAnimations,
    showChatPanel,
    setShowChatPanel,
    use24HourTime,
    setUse24HourTime,
    warnOnSimulationLeave,
    setWarnOnSimulationLeave,
  } = useSettingsStore()

  const projects = useProjectsStore((s) => s.projects)

  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: PreferencesTab = isValidTab(tabParam) ? tabParam : 'profile'

  // Tab cycling keyboard shortcut (Ctrl+Shift+Arrow)
  useTabCycleShortcut({
    tabs: VALID_TABS,
    queryBasePath: '/preferences',
  })

  const defaultMaxYear = new Date().getFullYear() + 5
  const _currentMaxYear = ticketDateMaxYearMode === 'default' ? defaultMaxYear : ticketDateMaxYear
  const customInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when switching to custom mode
  useEffect(() => {
    if (ticketDateMaxYearMode === 'custom' && customInputRef.current) {
      customInputRef.current.focus()
    }
  }, [ticketDateMaxYearMode])

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={Settings}
        category="Settings"
        title="Preferences"
        description="Customize your experience and workflow"
        variant="hero"
        accentColor="green"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800 overflow-x-auto">
          <Link
            href="/preferences?tab=profile"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'profile'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <Link
            href="/preferences?tab=security"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'security'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <KeyRound className="h-4 w-4" />
            Security
          </Link>
          <Link
            href="/preferences?tab=mcp"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'mcp'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Terminal className="h-4 w-4" />
            MCP
          </Link>
          <Link
            href="/preferences?tab=claude-chat"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'claude-chat'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Bot className="h-4 w-4" />
            Claude Chat
          </Link>
          <Link
            href="/preferences?tab=general"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'general'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Sliders className="h-4 w-4" />
            General
          </Link>
          <Link
            href="/preferences?tab=notifications"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'notifications'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </Link>
          <Link
            href="/preferences?tab=appearance"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'appearance'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Palette className="h-4 w-4" />
            Appearance
          </Link>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && stableUser && (
          <ProfileTab
            user={stableUser}
            isDemo={isDemo}
            onUserUpdate={handleUserUpdate}
            onSessionUpdate={debouncedUpdateSession}
          />
        )}

        {/* Security Tab */}
        {activeTab === 'security' && stableUser && (
          <SecurityTab
            user={stableUser}
            isDemo={isDemo}
            onUserUpdate={handleUserUpdate}
            onSessionUpdate={debouncedUpdateSession}
          />
        )}

        {/* MCP Tab */}
        {activeTab === 'mcp' && <MCPTab isDemo={isDemo} />}

        {/* Claude Chat Tab */}
        {activeTab === 'claude-chat' && <ClaudeChatTab isDemo={isDemo} />}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Ticket Behavior */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Ticket Behavior</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure how tickets behave when copying, pasting, and editing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="open-single-pasted" className="text-zinc-300">
                      Open single pasted ticket
                    </Label>
                    <p className="text-sm text-zinc-500">
                      When pasting a single ticket, automatically open it in the detail drawer
                    </p>
                  </div>
                  <Switch
                    id="open-single-pasted"
                    checked={openSinglePastedTicket}
                    onCheckedChange={(checked) => setOpenSinglePastedTicket(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="auto-save-drawer" className="text-zinc-300">
                      Auto-save on drawer close
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Automatically save changes when closing the ticket detail drawer without
                      showing a confirmation dialog
                    </p>
                  </div>
                  <Switch
                    id="auto-save-drawer"
                    checked={autoSaveOnDrawerClose}
                    onCheckedChange={(checked) => setAutoSaveOnDrawerClose(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="auto-save-role-editor" className="text-zinc-300">
                      Auto-save on role editor close
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Automatically save changes when closing the role editor dialog without showing
                      a confirmation dialog
                    </p>
                  </div>
                  <Switch
                    id="auto-save-role-editor"
                    checked={autoSaveOnRoleEditorClose}
                    onCheckedChange={(checked) => setAutoSaveOnRoleEditorClose(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="keep-selection-after-action" className="text-zinc-300">
                      Keep selection after actions
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Keep tickets selected after performing context menu actions or multi-drag
                      operations, so you can quickly perform multiple actions on the same set of
                      tickets
                    </p>
                  </div>
                  <Switch
                    id="keep-selection-after-action"
                    checked={keepSelectionAfterAction}
                    onCheckedChange={(checked) => setKeepSelectionAfterAction(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="collapse-attachments" className="text-zinc-300">
                      Collapse attachments by default
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Start with the attachments section collapsed when opening the ticket detail
                      drawer
                    </p>
                  </div>
                  <Switch
                    id="collapse-attachments"
                    checked={collapseAttachmentsByDefault}
                    onCheckedChange={(checked) => setCollapseAttachmentsByDefault(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Role Simulation */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Role Simulation</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure behavior when navigating away from a project during role simulation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="warn-on-simulation-leave" className="text-zinc-300">
                      Warn before leaving role simulation
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Show a confirmation dialog before navigating away from a project while
                      simulating a role. When disabled, the simulation ends automatically.
                    </p>
                  </div>
                  <Switch
                    id="warn-on-simulation-leave"
                    checked={warnOnSimulationLeave}
                    onCheckedChange={(checked) => setWarnOnSimulationLeave(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Table Behavior */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Table Behavior</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure how backlog and sprint tables behave
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="persist-table-sort" className="text-zinc-300">
                      Persist sort on refresh
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Remember table sort configuration across page refreshes. When disabled, tables
                      always reset to their default sort order on page load.
                    </p>
                  </div>
                  <Switch
                    id="persist-table-sort"
                    checked={persistTableSort}
                    onCheckedChange={(checked) => setPersistTableSort(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-300">Search persistence</Label>
                    <p className="text-sm text-zinc-500">
                      Control when PQL queries and search text are kept or cleared as you navigate
                    </p>
                  </div>
                  <RadioGroup
                    value={searchPersistence}
                    onValueChange={(value) =>
                      setSearchPersistence(value as 'never' | 'within-project' | 'always')
                    }
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem
                        value="never"
                        id="search-persist-never"
                        className="mt-0.5 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="search-persist-never"
                          className="text-sm text-zinc-300 cursor-pointer font-normal"
                        >
                          Never
                        </Label>
                        <p className="text-xs text-zinc-500">
                          Clear search when navigating between backlog, board, and sprints
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem
                        value="within-project"
                        id="search-persist-within-project"
                        className="mt-0.5 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="search-persist-within-project"
                          className="text-sm text-zinc-300 cursor-pointer font-normal"
                        >
                          Within project
                        </Label>
                        <p className="text-xs text-zinc-500">
                          Keep search within the same project, clear when switching projects
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem
                        value="always"
                        id="search-persist-always"
                        className="mt-0.5 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="search-persist-always"
                          className="text-sm text-zinc-300 cursor-pointer font-normal"
                        >
                          Always
                        </Label>
                        <p className="text-xs text-zinc-500">
                          Keep search even when switching between projects
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Display */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Display</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure how dates and times are displayed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="use-24-hour-time" className="text-zinc-300">
                      Use 24-hour time
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Display times in 24-hour format (e.g., 14:00) instead of 12-hour format (e.g.,
                      2:00 PM)
                    </p>
                  </div>
                  <Switch
                    id="use-24-hour-time"
                    checked={use24HourTime}
                    onCheckedChange={(checked) => setUse24HourTime(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Toast Notifications</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure how toast notifications behave
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="toast-auto-dismiss" className="text-zinc-300">
                      Auto-dismiss toasts
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Automatically dismiss toast notifications after the configured delay. When
                      disabled, toasts remain visible until manually closed.
                    </p>
                  </div>
                  <Switch
                    id="toast-auto-dismiss"
                    checked={toastAutoDismiss}
                    onCheckedChange={(checked) => setToastAutoDismiss(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="toast-dismiss-delay" className="text-zinc-300">
                      Dismiss delay
                    </Label>
                    <p className="text-sm text-zinc-500">
                      How long toasts remain visible before automatically dismissing (in seconds)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="toast-dismiss-delay"
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={toastDismissDelay / 1000}
                      onChange={(e) => {
                        const seconds = Number.parseFloat(e.target.value)
                        if (!Number.isNaN(seconds) && seconds >= 1 && seconds <= 30) {
                          setToastDismissDelay(seconds * 1000)
                        }
                      }}
                      disabled={!toastAutoDismiss}
                      className={cn(
                        'w-20 border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-amber-500',
                        !toastAutoDismiss && 'opacity-50',
                      )}
                    />
                    <span className="text-sm text-zinc-500">seconds</span>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="error-toast-auto-dismiss" className="text-zinc-300">
                      Auto-dismiss error toasts
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Automatically dismiss error notifications. When disabled, error toasts remain
                      visible until manually closed, giving you more time to read them.
                    </p>
                  </div>
                  <Switch
                    id="error-toast-auto-dismiss"
                    checked={errorToastAutoDismiss}
                    onCheckedChange={(checked) => setErrorToastAutoDismiss(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Toast Tester */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Toast Tester</CardTitle>
                <CardDescription className="text-zinc-500">
                  Trigger sample toasts to preview your notification settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showToast.success('Operation completed successfully')}
                  >
                    Success
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      showToast.error('Something went wrong', {
                        description: 'Please try again later',
                      })
                    }
                  >
                    Error
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showToast.info('Here is some useful information')}
                  >
                    Info
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showToast.warning('Proceed with caution')}
                  >
                    Warning
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      showToast.loading(new Promise((resolve) => setTimeout(resolve, 2000)), {
                        loadingMessage: 'Saving changes...',
                        successMessage: 'Changes saved',
                        errorMessage: 'Failed to save',
                      })
                    }
                  >
                    Loading (2s)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* Date Picker Settings */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Date Picker</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure date picker behavior for ticket forms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-zinc-300">Maximum year</Label>
                  <RadioGroup
                    value={ticketDateMaxYearMode}
                    onValueChange={(value) => {
                      setTicketDateMaxYearMode(value as 'default' | 'custom')
                      if (value === 'custom' && ticketDateMaxYear === defaultMaxYear) {
                        setTicketDateMaxYear(defaultMaxYear)
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="default"
                        id="date-max-year-default"
                        className="border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <Label
                        htmlFor="date-max-year-default"
                        className="text-sm text-zinc-300 cursor-pointer font-normal"
                      >
                        Default (current year + 5, i.e. {defaultMaxYear})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="custom"
                        id="date-max-year-custom"
                        className="border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <Label
                        htmlFor="date-max-year-custom"
                        className="text-sm text-zinc-300 cursor-pointer font-normal"
                      >
                        Custom
                      </Label>
                      <div
                        onClick={() => {
                          if (ticketDateMaxYearMode !== 'custom') {
                            setTicketDateMaxYearMode('custom')
                            if (ticketDateMaxYear === defaultMaxYear) {
                              setTicketDateMaxYear(defaultMaxYear)
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            if (ticketDateMaxYearMode !== 'custom') {
                              setTicketDateMaxYearMode('custom')
                              if (ticketDateMaxYear === defaultMaxYear) {
                                setTicketDateMaxYear(defaultMaxYear)
                              }
                            }
                          }
                        }}
                        role="button"
                        tabIndex={ticketDateMaxYearMode !== 'custom' ? 0 : -1}
                        className={cn(ticketDateMaxYearMode !== 'custom' && 'cursor-pointer')}
                      >
                        <Input
                          ref={customInputRef}
                          id="date-max-year"
                          type="number"
                          min={new Date().getFullYear()}
                          max={new Date().getFullYear() + 100}
                          value={ticketDateMaxYear}
                          onChange={(e) =>
                            setTicketDateMaxYear(Number.parseInt(e.target.value, 10))
                          }
                          disabled={ticketDateMaxYearMode !== 'custom'}
                          className={cn(
                            'w-32 border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-amber-500',
                            ticketDateMaxYearMode !== 'custom' && 'opacity-50',
                          )}
                        />
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Color Picker */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Color Picker</CardTitle>
                <CardDescription className="text-zinc-500">
                  Configure color picker behavior and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="hide-color-removal-warning" className="text-zinc-300">
                      Skip color removal confirmation
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Don&apos;t show the confirmation dialog when removing a saved color from your
                      swatches
                    </p>
                  </div>
                  <Switch
                    id="hide-color-removal-warning"
                    checked={hideColorRemovalWarning}
                    onCheckedChange={(checked) => setHideColorRemovalWarning(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Animations */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Animations</CardTitle>
                <CardDescription className="text-zinc-500">
                  Control visual effects and celebration animations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="enable-particle-animations" className="text-zinc-300">
                      Particle celebrations
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Show confetti when completing sprints and fire effects when exceeding sprint
                      budget. Automatically disabled when your system prefers reduced motion.
                    </p>
                  </div>
                  <Switch
                    id="enable-particle-animations"
                    checked={enableParticleAnimations}
                    onCheckedChange={(checked) => setEnableParticleAnimations(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Chat Panel */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Chat Panel</CardTitle>
                <CardDescription className="text-zinc-500">
                  Control the Claude Chat panel visibility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="enable-chat-panel" className="text-zinc-300">
                      Enable chat panel
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Show the Claude Chat panel and floating action button. When disabled, the chat
                      panel and FAB will be hidden from the interface.
                    </p>
                  </div>
                  <Switch
                    id="enable-chat-panel"
                    checked={showChatPanel}
                    onCheckedChange={(checked) => setShowChatPanel(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-zinc-100">Sidebar</CardTitle>
                <CardDescription className="text-zinc-500">
                  Control which settings sections are expanded by default in the sidebar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="sidebar-admin" className="text-zinc-300">
                      Admin settings expanded
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Keep the admin settings section expanded in the sidebar
                    </p>
                  </div>
                  <Switch
                    id="sidebar-admin"
                    checked={sidebarExpandedSections.admin ?? false}
                    onCheckedChange={(checked) =>
                      setSidebarSectionExpanded('admin', checked === true)
                    }
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="sidebar-profile" className="text-zinc-300">
                      Profile tabs expanded
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Keep the profile tabs section expanded in the sidebar
                    </p>
                  </div>
                  <Switch
                    id="sidebar-profile"
                    checked={sidebarExpandedSections.profile ?? false}
                    onCheckedChange={(checked) =>
                      setSidebarSectionExpanded('profile', checked === true)
                    }
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                {projects.length > 0 && (
                  <>
                    <Separator className="bg-zinc-800" />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-zinc-300">Project settings expanded</Label>
                          <p className="text-sm text-zinc-500">
                            Keep project settings sections expanded in the sidebar
                          </p>
                        </div>
                        <Switch
                          id="sidebar-all-projects"
                          checked={projects.every((p) => sidebarExpandedSections[p.id] ?? false)}
                          onCheckedChange={(checked) => {
                            for (const project of projects) {
                              setSidebarSectionExpanded(project.id, checked === true)
                            }
                          }}
                          className="data-[state=checked]:bg-amber-600"
                        />
                      </div>
                      <div className="space-y-3 mt-3">
                        {projects.map((project) => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between space-x-4"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: project.color || '#6b7280' }}
                              />
                              <Label
                                htmlFor={`sidebar-project-${project.id}`}
                                className="text-sm text-zinc-400 font-normal cursor-pointer"
                              >
                                {project.name}
                              </Label>
                            </div>
                            <Switch
                              id={`sidebar-project-${project.id}`}
                              checked={sidebarExpandedSections[project.id] ?? false}
                              onCheckedChange={(checked) =>
                                setSidebarSectionExpanded(project.id, checked === true)
                              }
                              className="data-[state=checked]:bg-amber-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
