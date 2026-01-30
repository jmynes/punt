'use client'

import {
  AlertTriangle,
  Archive,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FolderX,
  Lock,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  checkIfExportEncrypted,
  fileToBase64,
  isZipContent,
} from '@/hooks/queries/use-database-backup'
import { DatabaseExportDialog } from './database-export-dialog'
import { DatabaseImportDialog } from './database-import-dialog'
import { DatabaseWipeDialog } from './database-wipe-dialog'
import { DatabaseWipeProjectsDialog } from './database-wipe-projects-dialog'

function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null

  const getStrength = (pwd: string): { level: number; label: string; color: string } => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (pwd.length >= 16) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' }
    if (score <= 4) return { level: 2, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 5) return { level: 3, label: 'Good', color: 'bg-blue-500' }
    return { level: 4, label: 'Strong', color: 'bg-green-500' }
  }

  const { level, label, color } = getStrength(password)

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= level ? color : 'bg-zinc-700'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  )
}

export function DatabaseSettings() {
  const [exportPassword, setExportPassword] = useState('')
  const [showExportPassword, setShowExportPassword] = useState(false)
  const [includeAttachments, setIncludeAttachments] = useState(false)
  const [includeAvatars, setIncludeAvatars] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importFileBase64, setImportFileBase64] = useState<string | null>(null)
  const [isZip, setIsZip] = useState(false)
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showWipeProjectsDialog, setShowWipeProjectsDialog] = useState(false)
  const [showWipeDialog, setShowWipeDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportClick = () => {
    setShowExportDialog(true)
  }

  const handleExportComplete = () => {
    setExportPassword('')
    setIncludeAttachments(false)
    setIncludeAvatars(false)
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)

    // Read file as base64
    const base64 = await fileToBase64(file)
    setImportFileBase64(base64)

    // Check file type
    const isZipFile = isZipContent(base64)
    setIsZip(isZipFile)

    // For JSON files, check if encrypted
    if (!isZipFile) {
      try {
        const text = atob(base64)
        setIsEncrypted(checkIfExportEncrypted(text))
      } catch {
        setIsEncrypted(false)
      }
    } else {
      // For ZIP files, encryption status will be detected during parsing
      setIsEncrypted(false)
    }
  }, [])

  const handleImportClick = () => {
    if (!importFileBase64) return
    setShowImportDialog(true)
  }

  const handleImportComplete = () => {
    setShowImportDialog(false)
    setImportFile(null)
    setImportFileBase64(null)
    setIsZip(false)
    setIsEncrypted(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const clearImportFile = () => {
    setImportFile(null)
    setImportFileBase64(null)
    setIsZip(false)
    setIsEncrypted(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const includeFiles = includeAttachments || includeAvatars

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Database
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Download a complete backup of your database. Optionally include files and encrypt with a
            password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Options */}
          <div className="space-y-3">
            <Label className="text-zinc-300">Include Files</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeAttachments"
                  checked={includeAttachments}
                  onCheckedChange={(checked) => setIncludeAttachments(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                />
                <Label
                  htmlFor="includeAttachments"
                  className="text-zinc-300 cursor-pointer flex items-center gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Ticket attachments
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeAvatars"
                  checked={includeAvatars}
                  onCheckedChange={(checked) => setIncludeAvatars(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                />
                <Label
                  htmlFor="includeAvatars"
                  className="text-zinc-300 cursor-pointer flex items-center gap-2"
                >
                  <FileImage className="h-4 w-4" />
                  Profile pictures
                </Label>
              </div>
            </div>
            {includeFiles && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <Archive className="h-3 w-3" />
                Export will be a ZIP file containing data and files
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="exportPassword" className="text-zinc-300">
              Encryption Password (Optional)
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="exportPassword"
                type="text"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="Leave empty for unencrypted backup"
                className={`bg-zinc-800 border-zinc-700 text-zinc-100 pl-10 pr-10 ${!showExportPassword ? 'password-mask' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowExportPassword(!showExportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showExportPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthIndicator password={exportPassword} />
            {exportPassword && (
              <p className="text-xs text-amber-500">
                Remember this password. You will need it to restore the backup.
              </p>
            )}
          </div>

          <Button onClick={handleExportClick} variant="primary" className="w-full sm:w-auto">
            <Download className="h-4 w-4" />
            Export Database
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Database
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Restore from a backup file (.json or .zip). This will replace all existing data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">Warning: Data Loss</p>
              <p className="text-red-300/80 mt-1">
                Importing a backup will permanently delete all existing data including users,
                projects, tickets, and settings. This action cannot be undone.
              </p>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="importFile" className="text-zinc-300">
              Backup File
            </Label>
            <div className="flex gap-2">
              <Input
                id="importFile"
                type="file"
                accept=".json,.zip"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 file:bg-zinc-700 file:text-zinc-200 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded"
              />
              {importFile && (
                <Button variant="outline" size="sm" onClick={clearImportFile}>
                  Clear
                </Button>
              )}
            </div>
            {importFile && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>{importFile.name}</span>
                {isZip && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <Archive className="h-3 w-3" />
                    ZIP Archive
                  </span>
                )}
                {isEncrypted && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Lock className="h-3 w-3" />
                    Encrypted
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleImportClick}
            disabled={!importFileBase64}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            Import Database
          </Button>
        </CardContent>
      </Card>

      {/* Wipe Projects Section */}
      <Card className="border-amber-900/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <FolderX className="h-5 w-5 text-amber-400" />
            Wipe All Projects
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Delete all projects, tickets, and sprints while keeping user accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-400">Warning</p>
              <p className="text-amber-300/80 mt-1">
                This will delete all projects, tickets, sprints, labels, and related data. User
                accounts and system settings will be preserved.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowWipeProjectsDialog(true)}
            variant="destructive"
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
          >
            <FolderX className="h-4 w-4" />
            Wipe All Projects
          </Button>
        </CardContent>
      </Card>

      {/* Wipe Database Section */}
      <Card className="border-red-900/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-400" />
            Wipe Entire Database
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Delete all data and start fresh with a new admin account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">Danger Zone</p>
              <p className="text-red-300/80 mt-1">
                This will permanently delete all users, projects, tickets, and settings. Make sure
                you have exported a backup first if you need to preserve any data.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowWipeDialog(true)}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            Wipe Entire Database
          </Button>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <DatabaseExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        exportOptions={{
          password: exportPassword || undefined,
          includeAttachments,
          includeAvatars,
        }}
        onComplete={handleExportComplete}
      />

      {/* Import Dialog */}
      {showImportDialog && importFileBase64 && (
        <DatabaseImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          fileContent={importFileBase64}
          isZip={isZip}
          isEncrypted={isEncrypted}
          onComplete={handleImportComplete}
        />
      )}

      {/* Wipe Projects Dialog */}
      <DatabaseWipeProjectsDialog
        open={showWipeProjectsDialog}
        onOpenChange={setShowWipeProjectsDialog}
      />

      {/* Wipe Database Dialog */}
      <DatabaseWipeDialog open={showWipeDialog} onOpenChange={setShowWipeDialog} />
    </div>
  )
}
