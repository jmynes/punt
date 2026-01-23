'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Permission } from '@/lib/permissions'
import { PermissionGrid } from './permission-grid'

// Preset colors for role badges
const ROLE_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#6b7280', // gray
  '#f97316', // orange
]

export interface RoleFormData {
  name: string
  color: string
  description: string
  permissions: Permission[]
}

interface RoleEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: RoleFormData) => Promise<void>
  initialData?: RoleFormData
  isEditing?: boolean
  isDefault?: boolean
}

export function RoleEditorDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
  isEditing = false,
  isDefault = false,
}: RoleEditorDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(ROLE_COLORS[0])
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name)
      setColor(initialData.color)
      setDescription(initialData.description)
      setPermissions(initialData.permissions)
    } else if (open && !initialData) {
      setName('')
      setColor(ROLE_COLORS[0])
      setDescription('')
      setPermissions([])
    }
    setError(null)
  }, [open, initialData])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Role name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave({
        name: name.trim(),
        color,
        description: description.trim(),
        permissions,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Role: ${initialData?.name}` : 'Create New Role'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modify the role settings and permissions.'
              : 'Create a custom role with specific permissions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name and Color */}
          <div className="grid grid-cols-[1fr,auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Moderator, Contributor"
                disabled={isSaving || (isEditing && isDefault)}
                className="bg-zinc-800/50"
              />
              {isEditing && isDefault && (
                <p className="text-xs text-zinc-500">Default role names cannot be changed.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-1">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    disabled={isSaving}
                    className={`w-7 h-7 rounded-md transition-all ${
                      color === c
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this role can do..."
              disabled={isSaving}
              className="bg-zinc-800/50 resize-none"
              rows={2}
            />
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <p className="text-xs text-zinc-500 mb-3">
              Select the actions members with this role can perform.
            </p>
            <PermissionGrid
              selectedPermissions={permissions}
              onChange={setPermissions}
              disabled={isSaving}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
