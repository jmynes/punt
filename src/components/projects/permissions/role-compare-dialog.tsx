'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getSortedCategoriesWithPermissions,
  type Permission,
  type PermissionMeta,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { RoleWithPermissions } from '@/types'

interface RoleCompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RoleWithPermissions[]
}

export function RoleCompareDialog({ open, onOpenChange, roles }: RoleCompareDialogProps) {
  const [roleAId, setRoleAId] = useState<string>(roles[0]?.id || '')
  const [roleBId, setRoleBId] = useState<string>(roles[1]?.id || '')

  const roleA = useMemo(() => roles.find((r) => r.id === roleAId), [roles, roleAId])
  const roleB = useMemo(() => roles.find((r) => r.id === roleBId), [roles, roleBId])

  const categoriesWithPermissions = useMemo(() => getSortedCategoriesWithPermissions(), [])

  // Compute diff
  const diff = useMemo(() => {
    if (!roleA || !roleB) return { added: new Set<Permission>(), removed: new Set<Permission>() }

    const permSetA = new Set(roleA.permissions)
    const permSetB = new Set(roleB.permissions)

    const added = new Set<Permission>()
    const removed = new Set<Permission>()

    // Permissions in B but not in A (added)
    for (const perm of roleB.permissions) {
      if (!permSetA.has(perm)) added.add(perm)
    }

    // Permissions in A but not in B (removed)
    for (const perm of roleA.permissions) {
      if (!permSetB.has(perm)) removed.add(perm)
    }

    return { added, removed }
  }, [roleA, roleB])

  const hasDifferences = diff.added.size > 0 || diff.removed.size > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Compare Roles</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Select two roles to compare their permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">Base Role (A)</Label>
            <Select value={roleAId} onValueChange={setRoleAId}>
              <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      {role.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Compare To (B)</Label>
            <Select value={roleBId} onValueChange={setRoleBId}>
              <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      {role.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {roleA && roleB && (
          <div className="mt-4">
            {/* Summary */}
            <div className="flex items-center gap-4 mb-4 text-sm">
              {hasDifferences ? (
                <>
                  {diff.added.size > 0 && (
                    <Badge className="bg-emerald-900/50 text-emerald-400 border-emerald-700">
                      +{diff.added.size} in {roleB.name}
                    </Badge>
                  )}
                  {diff.removed.size > 0 && (
                    <Badge className="bg-red-900/50 text-red-400 border-red-700">
                      -{diff.removed.size} in {roleB.name}
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-zinc-500">Both roles have identical permissions</span>
              )}
            </div>

            {/* Diff View */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {categoriesWithPermissions.map(({ category, permissions }) => {
                  // Check if any permission in this category has differences
                  const categoryHasDiff = permissions.some(
                    (p) => diff.added.has(p.key) || diff.removed.has(p.key),
                  )
                  const categoryPermissionsInA = permissions.filter((p) =>
                    roleA.permissions.includes(p.key),
                  )
                  const categoryPermissionsInB = permissions.filter((p) =>
                    roleB.permissions.includes(p.key),
                  )

                  // Skip categories where neither role has any permissions
                  if (categoryPermissionsInA.length === 0 && categoryPermissionsInB.length === 0) {
                    return null
                  }

                  return (
                    <div
                      key={category.key}
                      className={cn(
                        'rounded-lg border bg-zinc-900/50 overflow-hidden',
                        categoryHasDiff ? 'border-zinc-700' : 'border-zinc-800',
                      )}
                    >
                      <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-800">
                        <span className="text-sm font-medium text-zinc-200">{category.label}</span>
                      </div>
                      <div className="p-2 space-y-1">
                        {permissions.map((permission) => {
                          const inA = roleA.permissions.includes(permission.key)
                          const inB = roleB.permissions.includes(permission.key)
                          const isAdded = diff.added.has(permission.key)
                          const isRemoved = diff.removed.has(permission.key)

                          // Skip if neither role has this permission
                          if (!inA && !inB) return null

                          return (
                            <PermissionDiffRow
                              key={permission.key}
                              permission={permission}
                              inRoleA={inA}
                              inRoleB={inB}
                              isAdded={isAdded}
                              isRemoved={isRemoved}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface PermissionDiffRowProps {
  permission: PermissionMeta
  inRoleA: boolean
  inRoleB: boolean
  isAdded: boolean
  isRemoved: boolean
}

function PermissionDiffRow({
  permission,
  inRoleA,
  inRoleB,
  isAdded,
  isRemoved,
}: PermissionDiffRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-2 py-1.5 rounded-md text-sm',
        isAdded && 'bg-emerald-950/30',
        isRemoved && 'bg-red-950/30',
        !isAdded && !isRemoved && 'bg-zinc-800/30',
      )}
    >
      {/* Status indicator */}
      <div className="w-16 flex-shrink-0 flex items-center gap-1">
        <div
          className={cn(
            'w-4 h-4 rounded text-center text-xs font-medium flex items-center justify-center',
            inRoleA ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 text-zinc-600',
          )}
        >
          A
        </div>
        <div
          className={cn(
            'w-4 h-4 rounded text-center text-xs font-medium flex items-center justify-center',
            inRoleB
              ? isAdded
                ? 'bg-emerald-700 text-emerald-200'
                : 'bg-zinc-700 text-zinc-300'
              : isRemoved
                ? 'bg-red-700 text-red-200'
                : 'bg-zinc-800 text-zinc-600',
          )}
        >
          B
        </div>
      </div>

      {/* Permission info */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            isAdded && 'text-emerald-300',
            isRemoved && 'text-red-300',
            !isAdded && !isRemoved && 'text-zinc-300',
          )}
        >
          {permission.label}
        </span>
      </div>

      {/* Diff badge */}
      {isAdded && (
        <Badge className="bg-emerald-900/50 text-emerald-400 border-emerald-700 text-xs px-1.5">
          +Added
        </Badge>
      )}
      {isRemoved && (
        <Badge className="bg-red-900/50 text-red-400 border-red-700 text-xs px-1.5">-Removed</Badge>
      )}
    </div>
  )
}
