'use client'

import { Settings } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export default function PreferencesPage() {
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
  } = useSettingsStore()

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
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold text-zinc-100">Preferences</h1>
        </div>

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
              <Checkbox
                id="open-single-pasted"
                checked={openSinglePastedTicket}
                onCheckedChange={(checked) => setOpenSinglePastedTicket(checked === true)}
                className="mt-1 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
            </div>

            <Separator className="bg-zinc-800" />

            <div className="flex items-start justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="auto-save-drawer" className="text-zinc-300">
                  Auto-save on drawer close
                </Label>
                <p className="text-sm text-zinc-500">
                  Automatically save changes when closing the ticket detail drawer without showing a
                  confirmation dialog
                </p>
              </div>
              <Checkbox
                id="auto-save-drawer"
                checked={autoSaveOnDrawerClose}
                onCheckedChange={(checked) => setAutoSaveOnDrawerClose(checked === true)}
                className="mt-1 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
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
              <Checkbox
                id="auto-save-role-editor"
                checked={autoSaveOnRoleEditorClose}
                onCheckedChange={(checked) => setAutoSaveOnRoleEditorClose(checked === true)}
                className="mt-1 border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
            </div>
          </CardContent>
        </Card>

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
                    // Prefill with default value when switching to custom
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
      </div>
    </div>
  )
}
