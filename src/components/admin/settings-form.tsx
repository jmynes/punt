'use client'

import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'

// All available MIME types that can be enabled
const ALL_IMAGE_TYPES = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'image/webp', label: 'WebP' },
]

const ALL_VIDEO_TYPES = [
  { value: 'video/mp4', label: 'MP4' },
  { value: 'video/webm', label: 'WebM' },
  { value: 'video/ogg', label: 'OGG' },
  { value: 'video/quicktime', label: 'QuickTime (MOV)' },
]

const ALL_DOCUMENT_TYPES = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/msword', label: 'Word (DOC)' },
  {
    value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word (DOCX)',
  },
  { value: 'application/vnd.ms-excel', label: 'Excel (XLS)' },
  {
    value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'Excel (XLSX)',
  },
  { value: 'text/plain', label: 'Plain Text (TXT)' },
  { value: 'text/csv', label: 'CSV' },
]

export function SettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  // Local form state
  const [maxImageSizeMB, setMaxImageSizeMB] = useState(10)
  const [maxVideoSizeMB, setMaxVideoSizeMB] = useState(100)
  const [maxDocumentSizeMB, setMaxDocumentSizeMB] = useState(25)
  const [maxAttachmentsPerTicket, setMaxAttachmentsPerTicket] = useState(20)
  const [allowedImageTypes, setAllowedImageTypes] = useState<string[]>([])
  const [allowedVideoTypes, setAllowedVideoTypes] = useState<string[]>([])
  const [allowedDocumentTypes, setAllowedDocumentTypes] = useState<string[]>([])

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setMaxImageSizeMB(settings.maxImageSizeMB)
      setMaxVideoSizeMB(settings.maxVideoSizeMB)
      setMaxDocumentSizeMB(settings.maxDocumentSizeMB)
      setMaxAttachmentsPerTicket(settings.maxAttachmentsPerTicket)
      setAllowedImageTypes(settings.allowedImageTypes)
      setAllowedVideoTypes(settings.allowedVideoTypes)
      setAllowedDocumentTypes(settings.allowedDocumentTypes)
    }
  }, [settings])

  const hasChanges =
    settings &&
    (maxImageSizeMB !== settings.maxImageSizeMB ||
      maxVideoSizeMB !== settings.maxVideoSizeMB ||
      maxDocumentSizeMB !== settings.maxDocumentSizeMB ||
      maxAttachmentsPerTicket !== settings.maxAttachmentsPerTicket ||
      JSON.stringify(allowedImageTypes.sort()) !==
        JSON.stringify(settings.allowedImageTypes.sort()) ||
      JSON.stringify(allowedVideoTypes.sort()) !==
        JSON.stringify(settings.allowedVideoTypes.sort()) ||
      JSON.stringify(allowedDocumentTypes.sort()) !==
        JSON.stringify(settings.allowedDocumentTypes.sort()))

  const handleSave = () => {
    updateSettings.mutate({
      maxImageSizeMB,
      maxVideoSizeMB,
      maxDocumentSizeMB,
      maxAttachmentsPerTicket,
      allowedImageTypes,
      allowedVideoTypes,
      allowedDocumentTypes,
    })
  }

  const toggleImageType = (type: string) => {
    setAllowedImageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const toggleVideoType = (type: string) => {
    setAllowedVideoTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const toggleDocumentType = (type: string) => {
    setAllowedDocumentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
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
      {/* File Size Limits */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">File Size Limits</CardTitle>
          <CardDescription className="text-zinc-400">
            Maximum file sizes for different file types (in MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxImageSize" className="text-zinc-300">
                Max Image Size (MB)
              </Label>
              <Input
                id="maxImageSize"
                type="number"
                min={1}
                max={100}
                value={maxImageSizeMB}
                onChange={(e) => setMaxImageSizeMB(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxVideoSize" className="text-zinc-300">
                Max Video Size (MB)
              </Label>
              <Input
                id="maxVideoSize"
                type="number"
                min={1}
                max={500}
                value={maxVideoSizeMB}
                onChange={(e) => setMaxVideoSizeMB(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxDocumentSize" className="text-zinc-300">
                Max Document Size (MB)
              </Label>
              <Input
                id="maxDocumentSize"
                type="number"
                min={1}
                max={100}
                value={maxDocumentSizeMB}
                onChange={(e) => setMaxDocumentSizeMB(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachment Limits */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Attachment Limits</CardTitle>
          <CardDescription className="text-zinc-400">
            Maximum number of attachments per ticket
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="maxAttachments" className="text-zinc-300">
              Max Attachments Per Ticket
            </Label>
            <Input
              id="maxAttachments"
              type="number"
              min={1}
              max={50}
              value={maxAttachmentsPerTicket}
              onChange={(e) => setMaxAttachmentsPerTicket(Number(e.target.value))}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
        </CardContent>
      </Card>

      {/* Allowed File Types */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Allowed File Types</CardTitle>
          <CardDescription className="text-zinc-400">
            Select which file types users can upload. SVG is blocked for security reasons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Types */}
          <div className="space-y-3">
            <Label className="text-zinc-300 font-medium">Images</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ALL_IMAGE_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.value}
                    checked={allowedImageTypes.includes(type.value)}
                    onCheckedChange={() => toggleImageType(type.value)}
                    className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <Label htmlFor={type.value} className="text-zinc-300 cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-zinc-700" />

          {/* Video Types */}
          <div className="space-y-3">
            <Label className="text-zinc-300 font-medium">Videos</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ALL_VIDEO_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.value}
                    checked={allowedVideoTypes.includes(type.value)}
                    onCheckedChange={() => toggleVideoType(type.value)}
                    className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <Label htmlFor={type.value} className="text-zinc-300 cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-zinc-700" />

          {/* Document Types */}
          <div className="space-y-3">
            <Label className="text-zinc-300 font-medium">Documents</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ALL_DOCUMENT_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.value}
                    checked={allowedDocumentTypes.includes(type.value)}
                    onCheckedChange={() => toggleDocumentType(type.value)}
                    className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <Label htmlFor={type.value} className="text-zinc-300 cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
