'use client'

import { Palette } from 'lucide-react'
import { Suspense, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/common'
import { PreferencesTabs } from '@/components/preferences/preferences-tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useSettingsStore } from '@/stores/settings-store'

export default function AppearancePage() {
  return (
    <Suspense>
      <AppearanceContent />
    </Suspense>
  )
}

function AppearanceContent() {
  const {
    ticketDateMaxYearMode,
    setTicketDateMaxYearMode,
    ticketDateMaxYear,
    setTicketDateMaxYear,
    sidebarExpandedSections,
    setSidebarSectionExpanded,
    hideColorRemovalWarning,
    setHideColorRemovalWarning,
    enableParticleAnimations,
    setEnableParticleAnimations,
    showChatPanel,
    setShowChatPanel,
  } = useSettingsStore()

  const projects = useProjectsStore((s) => s.projects)

  const defaultMaxYear = new Date().getFullYear() + 5
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ticketDateMaxYearMode === 'custom' && customInputRef.current) {
      customInputRef.current.focus()
    }
  }, [ticketDateMaxYearMode])

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={Palette}
        category="Settings"
        title="Appearance"
        description="Customize the look and feel of your workspace"
        variant="hero"
        accentColor="green"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <PreferencesTabs activeTab="appearance" />

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
                        onChange={(e) => setTicketDateMaxYear(Number.parseInt(e.target.value, 10))}
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
                  <Label htmlFor="sidebar-account" className="text-zinc-300">
                    Account tabs expanded
                  </Label>
                  <p className="text-sm text-zinc-500">
                    Keep the account tabs section expanded in the sidebar
                  </p>
                </div>
                <Switch
                  id="sidebar-account"
                  checked={sidebarExpandedSections['section-account'] ?? false}
                  onCheckedChange={(checked) =>
                    setSidebarSectionExpanded('section-account', checked === true)
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
      </div>
    </div>
  )
}
