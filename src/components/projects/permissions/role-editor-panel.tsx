'use client'

import { Lock, Palette, Pencil, RotateCcw, Shield } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ColorPickerBody } from '@/components/tickets/label-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions/constants'
import { cn } from '@/lib/utils'
import { PermissionGrid } from './permission-grid'

/**
 * Base styling for tab triggers in the role editor.
 * Use with cn() when adding extra tabs (e.g. Members tab).
 */
export const ROLE_TAB_TRIGGER_CLASS =
  '!rounded-none !border !border-l-0 !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white'

interface RoleEditorPanelProps {
  /** Role name (controlled) */
  name: string
  /** Role color hex (controlled) */
  color: string
  /** Role description (controlled) */
  description: string
  /** Selected permissions (controlled) */
  permissions: Permission[]

  /** Change handlers */
  onNameChange: (name: string) => void
  onColorChange: (color: string) => void
  onDescriptionChange: (description: string) => void
  onPermissionsChange: (permissions: Permission[]) => void

  /** Whether the user can edit (default: true) */
  canEdit?: boolean
  /** Whether this role has the "Default" badge */
  isDefault?: boolean
  /** Whether this is an owner role with all permissions forced */
  isOwnerRole?: boolean
  /** Description text shown under the role name in the header */
  headerDescription?: string

  /** Preset permissions for "Reset to Defaults" button */
  presetPermissions?: Permission[]
  /** Whether current permissions match the preset (hides Reset button when true) */
  isAtDefaults?: boolean

  /** Enable diff highlighting in PermissionGrid */
  showDiff?: boolean
  /** Original permissions for diff comparison */
  originalPermissions?: Permission[]
  /** Callback when user toggles diff view */
  onShowDiffChange?: (show: boolean) => void
  /** Whether there are unsaved changes (controls diff toggle visibility) */
  hasUnsavedChanges?: boolean
  /** Whether this is a new role being created (hides diff toggle) */
  isCreating?: boolean

  /** Project ID for color picker context */
  projectId?: string

  /** Additional tab triggers to render after Permissions tab */
  extraTabTriggers?: ReactNode
  /** Additional TabsContent elements */
  extraTabContent?: ReactNode
  /** Number of tab columns (default: 2) */
  tabColumns?: 2 | 3

  /** Footer element rendered at the bottom of the card */
  footer?: ReactNode
}

/**
 * Shared editor panel for role configuration.
 * Used by both admin default roles and project-level roles.
 * Provides Appearance + Permissions tabs with optional extra tabs.
 */
export function RoleEditorPanel({
  name,
  color,
  description,
  permissions,
  onNameChange,
  onColorChange,
  onDescriptionChange,
  onPermissionsChange,
  canEdit = true,
  isDefault = false,
  isOwnerRole = false,
  headerDescription,
  presetPermissions,
  isAtDefaults = true,
  showDiff = false,
  originalPermissions,
  onShowDiffChange,
  hasUnsavedChanges = false,
  isCreating = false,
  projectId,
  extraTabTriggers,
  extraTabContent,
  tabColumns = 2,
  footer,
}: RoleEditorPanelProps) {
  const allPermissionsEnabled = useMemo(
    () =>
      permissions.length === ALL_PERMISSIONS.length &&
      ALL_PERMISSIONS.every((p) => permissions.includes(p)),
    [permissions],
  )

  return (
    <Tabs defaultValue="appearance" className="h-full flex flex-col">
      <div className="mb-4">
        <TabsList
          className={cn(
            'w-full h-auto p-0 bg-transparent rounded-none gap-0 grid',
            tabColumns === 2 ? 'grid-cols-2' : 'grid-cols-3',
          )}
        >
          <TabsTrigger
            value="appearance"
            className={cn(ROLE_TAB_TRIGGER_CLASS, '!rounded-l-lg !border-l')}
          >
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className={cn(ROLE_TAB_TRIGGER_CLASS, tabColumns === 2 && '!rounded-r-lg')}
          >
            <Shield className="mr-2 h-4 w-4" />
            Permissions
          </TabsTrigger>
          {extraTabTriggers}
        </TabsList>
      </div>

      <Card className="flex-1 flex flex-col bg-zinc-900/50 border-zinc-800 min-h-0">
        <CardHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            {canEdit ? (
              <div className="group/title relative flex items-center gap-2 flex-1 min-w-0">
                <div className="relative">
                  <Input
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="Role name..."
                    className="!text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 cursor-text"
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-700 group-hover/title:bg-zinc-500 group-focus-within/title:bg-amber-500 transition-colors" />
                </div>
                <Pencil className="h-3.5 w-3.5 text-zinc-600 group-hover/title:text-zinc-400 group-focus-within/title:text-amber-500 transition-colors flex-shrink-0" />
              </div>
            ) : (
              <CardTitle className="text-lg">{name || 'New Role'}</CardTitle>
            )}
            {isDefault && (
              <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                <Lock className="mr-1 h-3 w-3" />
                Default
              </Badge>
            )}
          </div>
          {headerDescription && <CardDescription>{headerDescription}</CardDescription>}
          {canEdit ? (
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Add a description..."
              className="bg-zinc-800/50 resize-none border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 mt-2"
              rows={2}
            />
          ) : (
            description && <p className="text-sm text-zinc-400 mt-2">{description}</p>
          )}
        </CardHeader>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPickerBody
                  activeColor={color}
                  onColorChange={onColorChange}
                  onApply={(c) => {
                    if (/^#[0-9A-Fa-f]{6}$/i.test(c)) {
                      onColorChange(c)
                    }
                  }}
                  isDisabled={!canEdit}
                  projectId={projectId}
                />
              </div>
            </CardContent>
          </ScrollArea>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Permissions</Label>
                  <div className="flex items-center gap-3">
                    {onShowDiffChange && !isCreating && hasUnsavedChanges && (
                      <label
                        htmlFor="show-diff"
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <span className="text-xs text-zinc-500">Show changes</span>
                        <Checkbox
                          id="show-diff"
                          checked={showDiff}
                          onCheckedChange={(checked) => onShowDiffChange(checked === true)}
                          className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                        />
                      </label>
                    )}
                    {canEdit && !isOwnerRole && presetPermissions && !isAtDefaults && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPermissionsChange([...presetPermissions])}
                        className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Reset to Defaults
                      </Button>
                    )}
                    {canEdit && !isOwnerRole && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onPermissionsChange(allPermissionsEnabled ? [] : [...ALL_PERMISSIONS])
                        }
                        className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        {allPermissionsEnabled ? 'Disable All' : 'Enable All'}
                      </Button>
                    )}
                  </div>
                </div>
                {isOwnerRole && (
                  <p className="text-xs text-zinc-500">Owner always has all permissions.</p>
                )}
                {!isOwnerRole && (
                  <p className="text-xs text-zinc-500 mb-3">
                    Select the actions members with this role can perform.
                  </p>
                )}
                <PermissionGrid
                  selectedPermissions={permissions}
                  onChange={onPermissionsChange}
                  disabled={!canEdit || isOwnerRole}
                  originalPermissions={originalPermissions}
                  showDiff={showDiff && !isCreating}
                />
              </div>
            </CardContent>
          </ScrollArea>
        </TabsContent>

        {extraTabContent}
        {footer}
      </Card>
    </Tabs>
  )
}
