'use client'

import { Bell } from 'lucide-react'
import { Suspense } from 'react'
import { PageHeader } from '@/components/common'
import { PreferencesTabs } from '@/components/preferences/preferences-tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export default function NotificationsPage() {
  return (
    <Suspense>
      <NotificationsContent />
    </Suspense>
  )
}

function NotificationsContent() {
  const {
    toastAutoDismiss,
    setToastAutoDismiss,
    toastDismissDelay,
    setToastDismissDelay,
    errorToastAutoDismiss,
    setErrorToastAutoDismiss,
  } = useSettingsStore()

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={Bell}
        category="Settings"
        title="Notifications"
        description="Configure how notifications are displayed"
        variant="hero"
        accentColor="green"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <PreferencesTabs activeTab="notifications" />

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
      </div>
    </div>
  )
}
