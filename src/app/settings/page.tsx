'use client'

import { Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore } from '@/stores/settings-store'

export default function SettingsPage() {
  const {
    openSinglePastedTicket,
    setOpenSinglePastedTicket,
    ticketDateMaxYear,
    setTicketDateMaxYear,
    autoSaveOnDrawerClose,
    setAutoSaveOnDrawerClose,
  } = useSettingsStore()

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
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
            <div className="space-y-2">
              <Label htmlFor="date-max-year" className="text-zinc-300">
                Maximum year
              </Label>
              <p className="text-sm text-zinc-500">
                The maximum year available in date pickers (default: current year + 5)
              </p>
              <input
                id="date-max-year"
                type="number"
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 100}
                value={ticketDateMaxYear}
                onChange={(e) => setTicketDateMaxYear(Number.parseInt(e.target.value, 10))}
                className="w-32 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

