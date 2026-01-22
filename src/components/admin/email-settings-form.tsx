'use client'

import { AlertCircle, Info, Loader2, Mail, Save, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  useSendTestEmail,
  useSystemSettings,
  useUpdateSystemSettings,
} from '@/hooks/queries/use-system-settings'
import type { EmailProviderType } from '@/lib/email/types'

export function EmailSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const sendTestEmail = useSendTestEmail()

  // Local form state
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [emailProvider, setEmailProvider] = useState<EmailProviderType>('none')
  const [emailFromAddress, setEmailFromAddress] = useState('')
  const [emailFromName, setEmailFromName] = useState('PUNT')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(true)
  const [emailPasswordReset, setEmailPasswordReset] = useState(true)
  const [emailWelcome, setEmailWelcome] = useState(false)
  const [emailVerification, setEmailVerification] = useState(false)
  const [emailInvitations, setEmailInvitations] = useState(true)
  const [testEmailAddress, setTestEmailAddress] = useState('')

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setEmailEnabled(settings.emailEnabled)
      setEmailProvider(settings.emailProvider)
      setEmailFromAddress(settings.emailFromAddress)
      setEmailFromName(settings.emailFromName)
      setSmtpHost(settings.smtpHost)
      setSmtpPort(settings.smtpPort)
      setSmtpUsername(settings.smtpUsername)
      setSmtpSecure(settings.smtpSecure)
      setEmailPasswordReset(settings.emailPasswordReset)
      setEmailWelcome(settings.emailWelcome)
      setEmailVerification(settings.emailVerification)
      setEmailInvitations(settings.emailInvitations)
    }
  }, [settings])

  const hasChanges =
    settings &&
    (emailEnabled !== settings.emailEnabled ||
      emailProvider !== settings.emailProvider ||
      emailFromAddress !== settings.emailFromAddress ||
      emailFromName !== settings.emailFromName ||
      smtpHost !== settings.smtpHost ||
      smtpPort !== settings.smtpPort ||
      smtpUsername !== settings.smtpUsername ||
      smtpSecure !== settings.smtpSecure ||
      emailPasswordReset !== settings.emailPasswordReset ||
      emailWelcome !== settings.emailWelcome ||
      emailVerification !== settings.emailVerification ||
      emailInvitations !== settings.emailInvitations)

  const handleSave = () => {
    updateSettings.mutate({
      emailEnabled,
      emailProvider,
      emailFromAddress,
      emailFromName,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpSecure,
      emailPasswordReset,
      emailWelcome,
      emailVerification,
      emailInvitations,
    })
  }

  const handleSendTestEmail = () => {
    if (testEmailAddress) {
      sendTestEmail.mutate(testEmailAddress)
    }
  }

  const isEmailConfigured =
    emailEnabled &&
    emailProvider !== 'none' &&
    emailFromAddress &&
    (emailProvider !== 'smtp' || smtpHost)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-800 bg-red-900/20">
        <CardContent className="pt-6">
          <p className="text-red-400">Failed to load settings: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Email Provider Configuration */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Provider
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Configure how PUNT sends emails for password resets, notifications, and invitations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="emailEnabled"
              checked={emailEnabled}
              onCheckedChange={(checked) => setEmailEnabled(checked === true)}
              className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
            />
            <Label htmlFor="emailEnabled" className="text-zinc-300 cursor-pointer">
              Enable email functionality
            </Label>
          </div>

          {emailEnabled && (
            <>
              <Separator className="bg-zinc-700" />

              {/* Provider Selection */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Email Provider</Label>
                <Select
                  value={emailProvider}
                  onValueChange={(v) => setEmailProvider(v as EmailProviderType)}
                >
                  <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Disabled)</SelectItem>
                    <SelectItem value="smtp">SMTP (Self-hosted)</SelectItem>
                    <SelectItem value="resend">Resend (API)</SelectItem>
                    <SelectItem value="console">Console (Development)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  {emailProvider === 'smtp' &&
                    'Use your own mail server. Set SMTP password via EMAIL_SMTP_PASSWORD env var.'}
                  {emailProvider === 'resend' &&
                    'Use Resend API. Set API key via EMAIL_RESEND_API_KEY env var.'}
                  {emailProvider === 'console' &&
                    'Logs emails to server console. For development only.'}
                  {emailProvider === 'none' && 'Email functionality is disabled.'}
                </p>
              </div>

              {/* Sender Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFromAddress" className="text-zinc-300">
                    From Email Address
                  </Label>
                  <Input
                    id="emailFromAddress"
                    type="email"
                    placeholder="noreply@example.com"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFromName" className="text-zinc-300">
                    From Name
                  </Label>
                  <Input
                    id="emailFromName"
                    type="text"
                    placeholder="PUNT"
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
              </div>

              {/* SMTP Settings */}
              {emailProvider === 'smtp' && (
                <>
                  <Separator className="bg-zinc-700" />
                  <div className="space-y-4">
                    <Label className="text-zinc-300 font-medium">SMTP Settings</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtpHost" className="text-zinc-400 text-sm">
                          SMTP Host
                        </Label>
                        <Input
                          id="smtpHost"
                          type="text"
                          placeholder="smtp.example.com"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpPort" className="text-zinc-400 text-sm">
                          SMTP Port
                        </Label>
                        <Input
                          id="smtpPort"
                          type="number"
                          min={1}
                          max={65535}
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          className="bg-zinc-800 border-zinc-700 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpUsername" className="text-zinc-400 text-sm">
                          SMTP Username (optional)
                        </Label>
                        <Input
                          id="smtpUsername"
                          type="text"
                          placeholder="Leave empty to use From address"
                          value={smtpUsername}
                          onChange={(e) => setSmtpUsername(e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2 flex items-end">
                        <div className="flex items-center space-x-2 pb-2">
                          <Checkbox
                            id="smtpSecure"
                            checked={smtpSecure}
                            onCheckedChange={(checked) => setSmtpSecure(checked === true)}
                            className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                          />
                          <Label htmlFor="smtpSecure" className="text-zinc-300 cursor-pointer">
                            Use TLS/SSL
                          </Label>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-950/30 border border-amber-900/50">
                      <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-300/80">
                        Set the SMTP password via the{' '}
                        <code className="bg-amber-950/50 px-1 rounded">EMAIL_SMTP_PASSWORD</code>{' '}
                        environment variable for security.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Resend Info */}
              {emailProvider === 'resend' && (
                <>
                  <Separator className="bg-zinc-700" />
                  <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-950/30 border border-amber-900/50">
                    <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-300/80">
                      Set your Resend API key via the{' '}
                      <code className="bg-amber-950/50 px-1 rounded">EMAIL_RESEND_API_KEY</code>{' '}
                      environment variable.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Features */}
      {emailEnabled && emailProvider !== 'none' && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Email Features</CardTitle>
            <CardDescription className="text-zinc-400">
              Choose which email notifications are enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="emailPasswordReset"
                  checked={emailPasswordReset}
                  onCheckedChange={(checked) => setEmailPasswordReset(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                />
                <div>
                  <Label htmlFor="emailPasswordReset" className="text-zinc-300 cursor-pointer">
                    Password Reset
                  </Label>
                  <p className="text-xs text-zinc-500">Send password reset emails</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="emailWelcome"
                  checked={emailWelcome}
                  onCheckedChange={(checked) => setEmailWelcome(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                />
                <div>
                  <Label htmlFor="emailWelcome" className="text-zinc-300 cursor-pointer">
                    Welcome Emails
                  </Label>
                  <p className="text-xs text-zinc-500">Send welcome emails to new users</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="emailVerification"
                  checked={emailVerification}
                  onCheckedChange={(checked) => setEmailVerification(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  disabled
                />
                <div>
                  <Label htmlFor="emailVerification" className="text-zinc-400 cursor-not-allowed">
                    Email Verification
                  </Label>
                  <p className="text-xs text-zinc-500">Verify email addresses (coming soon)</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="emailInvitations"
                  checked={emailInvitations}
                  onCheckedChange={(checked) => setEmailInvitations(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  disabled
                />
                <div>
                  <Label htmlFor="emailInvitations" className="text-zinc-400 cursor-not-allowed">
                    Project Invitations
                  </Label>
                  <p className="text-xs text-zinc-500">
                    Send project invitation emails (coming soon)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Email */}
      {emailEnabled && emailProvider !== 'none' && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Test Email Configuration</CardTitle>
            <CardDescription className="text-zinc-400">
              Send a test email to verify your configuration is working.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEmailConfigured && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-950/30 border border-red-900/50">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300/80">
                  Please complete the email configuration above before testing.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="Enter email address for test"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 flex-1"
                disabled={!isEmailConfigured || hasChanges}
              />
              <Button
                onClick={handleSendTestEmail}
                disabled={
                  !testEmailAddress || !isEmailConfigured || sendTestEmail.isPending || hasChanges
                }
                variant="outline"
              >
                {sendTestEmail.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
            {hasChanges && (
              <p className="text-xs text-amber-400">
                Save your changes before sending a test email.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
          variant="primary"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Email Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
