'use client'

import { Check, ImageIcon, Loader2, RotateCcw, Save, Trash2, Type, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PuntLogo } from '@/components/common/punt-logo'
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
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { withBasePath } from '@/lib/base-path'
import type { LogoMode } from '@/lib/branding'
import { DEFAULT_BRANDING } from '@/lib/branding'
import { cn } from '@/lib/utils'

export function BrandingSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()
  const uploadLogo = useUploadLogo()
  const deleteLogo = useDeleteLogo()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local form state
  const [appName, setAppName] = useState(DEFAULT_BRANDING.appName)
  const [logoMode, setLogoMode] = useState<LogoMode>(DEFAULT_BRANDING.logoMode)
  const [logoLetter, setLogoLetter] = useState(DEFAULT_BRANDING.logoLetter)
  const [logoGradientFrom, setLogoGradientFrom] = useState(DEFAULT_BRANDING.logoGradientFrom)
  const [logoGradientTo, setLogoGradientTo] = useState(DEFAULT_BRANDING.logoGradientTo)

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setAppName(settings.appName)
      setLogoMode((settings.logoMode as LogoMode) ?? 'default')
      setLogoLetter(settings.logoLetter)
      setLogoGradientFrom(settings.logoGradientFrom)
      setLogoGradientTo(settings.logoGradientTo)
    }
  }, [settings])

  const hasChanges =
    settings &&
    (appName !== settings.appName ||
      logoMode !== (settings.logoMode ?? 'default') ||
      logoLetter !== settings.logoLetter ||
      logoGradientFrom !== settings.logoGradientFrom ||
      logoGradientTo !== settings.logoGradientTo)

  const handleSave = () => {
    updateSettings.mutate({
      appName,
      logoMode,
      logoLetter,
      logoGradientFrom,
      logoGradientTo,
    })
  }

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: hasChanges && !updateSettings.isPending,
  })

  const handleResetToDefaults = () => {
    setAppName(DEFAULT_BRANDING.appName)
    setLogoMode(DEFAULT_BRANDING.logoMode)
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
      logoMode: DEFAULT_BRANDING.logoMode,
      logoLetter: DEFAULT_BRANDING.logoLetter,
      logoGradientFrom: DEFAULT_BRANDING.logoGradientFrom,
      logoGradientTo: DEFAULT_BRANDING.logoGradientTo,
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadLogo.mutate(file, {
        onSuccess: () => {
          // Auto-switch to custom mode on successful upload
          setLogoMode('custom')
          updateSettings.mutate({
            appName,
            logoMode: 'custom',
            logoLetter,
            logoGradientFrom,
            logoGradientTo,
          })
        },
      })
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveLogo = () => {
    deleteLogo.mutate(undefined, {
      onSuccess: () => {
        setLogoMode('default')
        updateSettings.mutate({
          appName,
          logoMode: 'default',
          logoLetter,
          logoGradientFrom,
          logoGradientTo,
        })
      },
    })
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

  // Render the active logo preview based on current mode
  const renderLogoPreview = (size: 'sm' | 'lg') => {
    const sizeClasses = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14'
    const textSize = size === 'sm' ? 'text-sm' : 'text-xl'
    const roundedClass = size === 'sm' ? 'rounded-lg' : 'rounded-xl'

    if (logoMode === 'custom' && settings?.logoUrl) {
      return (
        <img
          src={withBasePath(settings.logoUrl)}
          alt="Logo"
          className={cn(sizeClasses, roundedClass, 'object-contain')}
        />
      )
    }
    if (logoMode === 'letter') {
      return (
        <div
          className={cn(
            sizeClasses,
            roundedClass,
            'flex items-center justify-center text-white select-none',
          )}
          style={{
            background: `linear-gradient(to bottom right, ${logoGradientFrom}, ${logoGradientTo})`,
          }}
        >
          <span className={cn(textSize, 'font-bold')}>{logoLetter}</span>
        </div>
      )
    }
    return <PuntLogo className={cn(sizeClasses, roundedClass)} />
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
            Choose how the app logo appears in the header and login page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Preview */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-950/50 border border-zinc-800">
            {renderLogoPreview('lg')}
            <span className="text-2xl font-semibold text-zinc-100">{appName}</span>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Default PUNT Icon */}
            <button
              type="button"
              onClick={() => setLogoMode('default')}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-lg border p-4 transition-colors',
                logoMode === 'default'
                  ? 'border-amber-600 bg-amber-950/20'
                  : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600',
              )}
            >
              {logoMode === 'default' && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-amber-600 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <PuntLogo className="h-10 w-10 rounded-lg" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-200">PUNT Icon</p>
                <p className="text-xs text-zinc-500">Default logo</p>
              </div>
            </button>

            {/* Letter Icon */}
            <button
              type="button"
              onClick={() => setLogoMode('letter')}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-lg border p-4 transition-colors',
                logoMode === 'letter'
                  ? 'border-amber-600 bg-amber-950/20'
                  : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600',
              )}
            >
              {logoMode === 'letter' && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-amber-600 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white select-none"
                style={{
                  background: `linear-gradient(to bottom right, ${logoGradientFrom}, ${logoGradientTo})`,
                }}
              >
                <span className="text-sm font-bold">{logoLetter}</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-200">Letter Icon</p>
                <p className="text-xs text-zinc-500">Custom letter &amp; colors</p>
              </div>
            </button>

            {/* Custom Upload */}
            <button
              type="button"
              onClick={() => setLogoMode('custom')}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-lg border p-4 transition-colors',
                logoMode === 'custom'
                  ? 'border-amber-600 bg-amber-950/20'
                  : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600',
              )}
            >
              {logoMode === 'custom' && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-amber-600 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              {settings?.logoUrl ? (
                <img
                  src={withBasePath(settings.logoUrl)}
                  alt="Custom logo"
                  className="h-10 w-10 rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50">
                  <Upload className="h-4 w-4 text-zinc-500" />
                </div>
              )}
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-200">Custom Image</p>
                <p className="text-xs text-zinc-500">
                  {settings?.logoUrl ? 'Uploaded' : 'Upload an image'}
                </p>
              </div>
            </button>
          </div>

          {/* Mode-specific options */}
          {logoMode === 'letter' && (
            <>
              <Separator className="bg-zinc-700" />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-zinc-500" />
                  <Label className="text-zinc-300 font-medium">Letter Icon Settings</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="gradientFrom" className="text-zinc-300">
                      Gradient Start
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
                  <div className="space-y-2">
                    <Label htmlFor="gradientTo" className="text-zinc-300">
                      Gradient End
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
            </>
          )}

          {logoMode === 'custom' && (
            <>
              <Separator className="bg-zinc-700" />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-zinc-500" />
                  <Label className="text-zinc-300 font-medium">Custom Logo</Label>
                </div>
                <p className="text-sm text-zinc-500">
                  Upload a logo image (JPEG, PNG, GIF, WebP, or SVG). Max 2MB. Raster images will be
                  resized to 128x128.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
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
                        {settings?.logoUrl ? 'Replace Logo' : 'Upload Logo'}
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
                          Remove
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
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
