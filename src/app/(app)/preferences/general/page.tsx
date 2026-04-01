'use client'

import { Sliders } from 'lucide-react'
import { Suspense } from 'react'
import { PageHeader } from '@/components/common'
import { PreferencesTabs } from '@/components/preferences/preferences-tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/stores/settings-store'

export default function GeneralPage() {
  return (
    <Suspense>
      <GeneralContent />
    </Suspense>
  )
}

function GeneralContent() {
  const {
    openSinglePastedTicket,
    setOpenSinglePastedTicket,
    autoSaveOnDrawerClose,
    setAutoSaveOnDrawerClose,
    autoSaveOnRoleEditorClose,
    setAutoSaveOnRoleEditorClose,
    keepSelectionAfterAction,
    setKeepSelectionAfterAction,
    collapseAttachmentsByDefault,
    setCollapseAttachmentsByDefault,
    persistTableSort,
    setPersistTableSort,
    searchPersistence,
    setSearchPersistence,
    use24HourTime,
    setUse24HourTime,
    warnOnSimulationLeave,
    setWarnOnSimulationLeave,
    defaultProjectView,
    setDefaultProjectView,
    unifiedSort,
    setUnifiedSort,
  } = useSettingsStore()

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={Sliders}
        category="Settings"
        title="General"
        description="Configure general behavior and workflow preferences"
        variant="hero"
        accentColor="green"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <PreferencesTabs activeTab="general" />

        <div className="space-y-6">
          {/* Navigation */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-zinc-100">Navigation</CardTitle>
              <CardDescription className="text-zinc-500">
                Configure default navigation behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-zinc-300">Default project view</Label>
                  <p className="text-sm text-zinc-500">
                    Choose which view opens when clicking a project name in the sidebar
                  </p>
                </div>
                <RadioGroup
                  value={defaultProjectView}
                  onValueChange={(value) =>
                    setDefaultProjectView(value as 'board' | 'backlog' | 'sprints')
                  }
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem
                      value="backlog"
                      id="default-view-backlog"
                      className="mt-0.5 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="default-view-backlog"
                        className="text-sm text-zinc-300 cursor-pointer font-normal"
                      >
                        Backlog
                      </Label>
                      <p className="text-xs text-zinc-500">Table view with filtering and sorting</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem
                      value="board"
                      id="default-view-board"
                      className="mt-0.5 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="default-view-board"
                        className="text-sm text-zinc-300 cursor-pointer font-normal"
                      >
                        Board
                      </Label>
                      <p className="text-xs text-zinc-500">Kanban board view with drag-and-drop</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem
                      value="sprints"
                      id="default-view-sprints"
                      className="mt-0.5 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="default-view-sprints"
                        className="text-sm text-zinc-300 cursor-pointer font-normal"
                      >
                        Sprints
                      </Label>
                      <p className="text-xs text-zinc-500">Sprint planning and management view</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

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
                    Automatically save changes when closing the ticket detail drawer without showing
                    a confirmation dialog
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
                    Automatically save changes when closing the role editor dialog without showing a
                    confirmation dialog
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

              <div className="flex items-start justify-between space-x-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="unified-sort" className="text-zinc-300">
                    Sort all sections together
                  </Label>
                  <p className="text-sm text-zinc-500">
                    When enabled, clicking a column header sorts all sprint and backlog sections at
                    once. When disabled, each section has its own independent sort.
                  </p>
                </div>
                <Switch
                  id="unified-sort"
                  checked={unifiedSort}
                  onCheckedChange={(checked) => setUnifiedSort(checked === true)}
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
      </div>
    </div>
  )
}
