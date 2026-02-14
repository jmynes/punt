'use client'

import { ImageIcon, Loader2, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  useDeleteLogo,
  useSystemSettings,
  useUpdateSystemSettings,
  useUploadLogo,
} from '@/hooks/queries/use-system-settings'
import { DEFAULT_BRANDING } from '@/lib/branding'

export function BrandingSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const uploadLogo = useUploadLogo()
  const deleteLogo = useDeleteLogo()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local form state
  const [appName, setAppName] = useState(DEFAULT_BRANDING.appName)
  const [logoLetter, setLogoLetter] = useState(DEFAULT_BRANDING.logoLetter)
  const [logoGradientFrom, setLogoGradientFrom] = useState(DEFAULT_BRANDING.logoGradientFrom)
  const [logoGradientTo, setLogoGradientTo] = useState(DEFAULT_BRANDING.logoGradientTo)

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setAppName(settings.appName)
      setLogoLetter(settings.logoLetter)
      setLogoGradientFrom(settings.logoGradientFrom)
      setLogoGradientTo(settings.logoGradientTo)
    }
  }, [settings])

  const hasChanges =
    settings &&
    (appName !== settings.appName ||
      logoLetter !== settings.logoLetter ||
      logoGradientFrom !== settings.logoGradientFrom ||
      logoGradientTo !== settings.logoGradientTo)

  const handleSave = () => {
    updateSettings.mutate({
      appName,
      logoLetter,
      logoGradientFrom,
      logoGradientTo,
    })
  }

  const handleResetToDefaults = () => {
    setAppName(DEFAULT_BRANDING.appName)
    setLogoLetter(DEFAULT_BRANDING.logoLetter)
    setLogoGradientFrom(DEFAULT_BRANDING.logoGradientFrom)
    setLogoGradientTo(DEFAULT_BRANDING.logoGradientTo)

    // Also delete logo if one exists
    if (settings?.logoUrl) {
      deleteLogo.mutate()
    }

    // Save the defaults
    updateSettings.mutate({
      appName: DEFAULT_BRANDING.appName,
      logoLetter: DEFAULT_BRANDING.logoLetter,
      logoGradientFrom: DEFAULT_BRANDING.logoGradientFrom,
      logoGradientTo: DEFAULT_BRANDING.logoGradientTo,
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadLogo.mutate(file)
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveLogo = () => {
    deleteLogo.mutate()
  }

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
      {/* App Name */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Application Name</CardTitle>
          <CardDescription className="text-zinc-400">
            The name displayed in the header and browser title
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="appName" className="text-zinc-300">
              App Name
            </Label>
            <Input
              id="appName"
              type="text"
              maxLength={50}
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              placeholder="PUNT"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Logo</CardTitle>
          <CardDescription className="text-zinc-400">
            Upload a custom logo or customize the default letter icon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Preview */}
          <div className="flex items-center gap-6">
            <div className="space-y-2">
              <Label className="text-zinc-300">Current Logo</Label>
              <div className="flex items-center gap-4">
                {settings?.logoUrl ? (
                  <div className="relative">
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="h-12 w-12 rounded-lg object-contain bg-zinc-800"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-white select-none"
                    style={{
                      background: `linear-gradient(to bottom right, ${logoGradientFrom}, ${logoGradientTo})`,
                    }}
                  >
                    <span className="text-lg font-bold">{logoLetter}</span>
                  </div>
                )}
                <span className="text-xl font-semibold text-zinc-100">{appName}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-700" />

          {/* Upload Logo */}
          <div className="space-y-3">
            <Label className="text-zinc-300 font-medium">Custom Logo</Label>
            <p className="text-sm text-zinc-500">
              Upload a custom logo image (JPEG, PNG, GIF, or WebP). Max 2MB, will be resized to
              128x128.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLogo.isPending}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {uploadLogo.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </>
                )}
              </Button>
              {settings?.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRemoveLogo}
                  disabled={deleteLogo.isPending}
                  className="text-red-400 hover:bg-red-950/50 hover:text-red-300"
                >
                  {deleteLogo.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Logo
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <Separator className="bg-zinc-700" />

          {/* Letter Icon Customization */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-zinc-500" />
              <Label className="text-zinc-300 font-medium">Default Letter Icon</Label>
            </div>
            <p className="text-sm text-zinc-500">
              When no custom logo is uploaded, a letter icon is displayed. Customize its appearance
              below.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Letter */}
              <div className="space-y-2">
                <Label htmlFor="logoLetter" className="text-zinc-300">
                  Letter (1-2 characters)
                </Label>
                <Input
                  id="logoLetter"
                  type="text"
                  maxLength={2}
                  value={logoLetter}
                  onChange={(e) => setLogoLetter(e.target.value.slice(0, 2))}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  placeholder="P"
                />
              </div>

              {/* Gradient From */}
              <div className="space-y-2">
                <Label htmlFor="gradientFrom" className="text-zinc-300">
                  Gradient Start Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="gradientFrom"
                    value={logoGradientFrom}
                    onChange={(e) => setLogoGradientFrom(e.target.value)}
                    className="h-10 w-12 rounded border border-zinc-700 bg-zinc-800 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={logoGradientFrom}
                    onChange={(e) => setLogoGradientFrom(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono text-sm"
                    placeholder="#f59e0b"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Gradient To */}
              <div className="space-y-2">
                <Label htmlFor="gradientTo" className="text-zinc-300">
                  Gradient End Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="gradientTo"
                    value={logoGradientTo}
                    onChange={(e) => setLogoGradientTo(e.target.value)}
                    className="h-10 w-12 rounded border border-zinc-700 bg-zinc-800 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={logoGradientTo}
                    onChange={(e) => setLogoGradientTo(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono text-sm"
                    placeholder="#ea580c"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={handleResetToDefaults}
          disabled={updateSettings.isPending}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>

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
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
