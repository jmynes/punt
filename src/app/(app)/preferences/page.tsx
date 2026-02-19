'use client'

import { Bell, Palette, Settings, Sliders } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useSettingsStore } from '@/stores/settings-store'

type PreferencesTab = 'general' | 'notifications' | 'appearance'

const VALID_TABS: PreferencesTab[] = ['general', 'notifications', 'appearance']

function isValidTab(tab: string | null): tab is PreferencesTab {
  return tab !== null && VALID_TABS.includes(tab as PreferencesTab)
}

export default function PreferencesPage() {
  return (
    <Suspense>
      <PreferencesContent />
    </Suspense>
  )
}

function PreferencesContent() {
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
    showUndoButtons,
    setShowUndoButtons,
    toastAutoDismiss,
    setToastAutoDismiss,
    toastDismissDelay,
    setToastDismissDelay,
    errorToastAutoDismiss,
    setErrorToastAutoDismiss,
    persistTableSort,
    setPersistTableSort,
    sidebarExpandedSections,
    setSidebarSectionExpanded,
    hideColorRemovalWarning,
    setHideColorRemovalWarning,
  } = useSettingsStore()

  const projects = useProjectsStore((s) => s.projects)

  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: PreferencesTab = isValidTab(tabParam) ? tabParam : 'general'

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
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          <Link
            href="/preferences?tab=general"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
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
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
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
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'appearance'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Palette className="h-4 w-4" />
            Appearance
          </Link>
        </div>

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
                    <Label htmlFor="show-undo-buttons" className="text-zinc-300">
                      Show undo/redo buttons on toasts
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Display undo and redo action buttons on toast notifications after ticket
                      operations
                    </p>
                  </div>
                  <Switch
                    id="show-undo-buttons"
                    checked={showUndoButtons}
                    onCheckedChange={(checked) => setShowUndoButtons(checked === true)}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>

                <Separator className="bg-zinc-800" />

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
                      showToast.withUndo('Item deleted', {
                        description: 'TEST-1',
                        onUndo: () => {
                          showToast.success('Undo successful')
                        },
                      })
                    }
                  >
                    With Undo
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
