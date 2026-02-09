'use client'

import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  getSortedCategoriesWithPermissions,
  type Permission,
  type PermissionMeta,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface PermissionGridProps {
  selectedPermissions: Permission[]
  onChange: (permissions: Permission[]) => void
  disabled?: boolean
  /** Original permissions to compare against for highlighting changes */
  originalPermissions?: Permission[]
  /** Whether to show visual diff highlighting */
  showDiff?: boolean
}

export function PermissionGrid({
  selectedPermissions,
  onChange,
  disabled = false,
  originalPermissions,
  showDiff = false,
}: PermissionGridProps) {
  const categoriesWithPermissions = useMemo(() => getSortedCategoriesWithPermissions(), [])

  const selectedSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions])
  const originalSet = useMemo(() => new Set(originalPermissions || []), [originalPermissions])

  // Compute diff when showDiff is enabled
  const diff = useMemo(() => {
    if (!showDiff || !originalPermissions) {
      return { added: new Set<Permission>(), removed: new Set<Permission>() }
    }

    const added = new Set<Permission>()
    const removed = new Set<Permission>()

    // Permissions that are now selected but weren't originally
    for (const perm of selectedPermissions) {
      if (!originalSet.has(perm)) added.add(perm)
    }

    // Permissions that were originally selected but now aren't
    for (const perm of originalPermissions) {
      if (!selectedSet.has(perm)) removed.add(perm)
    }

    return { added, removed }
  }, [showDiff, originalPermissions, selectedPermissions, originalSet, selectedSet])

  const handleTogglePermission = (permission: Permission) => {
    if (disabled) return
    const newPermissions = selectedSet.has(permission)
      ? selectedPermissions.filter((p) => p !== permission)
      : [...selectedPermissions, permission]
    onChange(newPermissions)
  }

  const handleToggleCategory = (permissions: PermissionMeta[], selectAll: boolean) => {
    if (disabled) return
    const categoryKeys = permissions.map((p) => p.key)

    if (selectAll) {
      // Add all permissions from this category
      const newPermissions = [...new Set([...selectedPermissions, ...categoryKeys])]
      onChange(newPermissions)
    } else {
      // Remove all permissions from this category
      const newPermissions = selectedPermissions.filter((p) => !categoryKeys.includes(p))
      onChange(newPermissions)
    }
  }

  const isCategoryFullySelected = (permissions: PermissionMeta[]) => {
    return permissions.every((p) => selectedSet.has(p.key))
  }

  const isCategoryPartiallySelected = (permissions: PermissionMeta[]) => {
    const selected = permissions.filter((p) => selectedSet.has(p.key))
    return selected.length > 0 && selected.length < permissions.length
  }

  return (
    <div className="space-y-2">
      {categoriesWithPermissions.map(({ category, permissions }) => (
        <PermissionCategory
          key={category.key}
          label={category.label}
          description={category.description}
          permissions={permissions}
          selectedSet={selectedSet}
          isFullySelected={isCategoryFullySelected(permissions)}
          isPartiallySelected={isCategoryPartiallySelected(permissions)}
          onTogglePermission={handleTogglePermission}
          onToggleAll={(selectAll) => handleToggleCategory(permissions, selectAll)}
          disabled={disabled}
          showDiff={showDiff}
          addedPermissions={diff.added}
          removedPermissions={diff.removed}
        />
      ))}
    </div>
  )
}

interface PermissionCategoryProps {
  label: string
  description: string
  permissions: PermissionMeta[]
  selectedSet: Set<Permission>
  isFullySelected: boolean
  isPartiallySelected: boolean
  onTogglePermission: (permission: Permission) => void
  onToggleAll: (selectAll: boolean) => void
  disabled: boolean
  showDiff: boolean
  addedPermissions: Set<Permission>
  removedPermissions: Set<Permission>
}

function PermissionCategory({
  label,
  description,
  permissions,
  selectedSet,
  isFullySelected,
  isPartiallySelected,
  onTogglePermission,
  onToggleAll,
  disabled,
  showDiff,
  addedPermissions,
  removedPermissions,
}: PermissionCategoryProps) {
  // Check if this category has any changes
  const categoryHasChanges = permissions.some(
    (p) => addedPermissions.has(p.key) || removedPermissions.has(p.key),
  )
  return (
    <Collapsible
      defaultOpen
      className={cn(
        'rounded-lg border bg-zinc-900/50',
        showDiff && categoryHasChanges ? 'border-amber-700/50' : 'border-zinc-800',
      )}
    >
      <div className="flex items-center justify-between p-3">
        <CollapsibleTrigger className="flex items-center gap-2 hover:text-zinc-100 transition-colors">
          <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform duration-200 [[data-state=closed]_&]:-rotate-90" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">{label}</span>
              {showDiff && categoryHasChanges && (
                <span className="text-xs text-amber-500">Modified</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">{description}</p>
          </div>
        </CollapsibleTrigger>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Select All</span>
          <Checkbox
            checked={isFullySelected}
            data-state={
              isPartiallySelected ? 'indeterminate' : isFullySelected ? 'checked' : 'unchecked'
            }
            onCheckedChange={(checked) => onToggleAll(!!checked)}
            disabled={disabled}
            className={cn(
              'border-zinc-600',
              isPartiallySelected && 'bg-zinc-600 data-[state=indeterminate]:bg-zinc-600',
            )}
          />
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-t border-zinc-800 px-3 pb-3 pt-2">
          <div className="space-y-1">
            {permissions.map((permission) => (
              <PermissionRow
                key={permission.key}
                permission={permission}
                isSelected={selectedSet.has(permission.key)}
                onToggle={() => onTogglePermission(permission.key)}
                disabled={disabled}
                isAdded={showDiff && addedPermissions.has(permission.key)}
                isRemoved={showDiff && removedPermissions.has(permission.key)}
              />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface PermissionRowProps {
  permission: PermissionMeta
  isSelected: boolean
  onToggle: () => void
  disabled: boolean
  isAdded?: boolean
  isRemoved?: boolean
}

function PermissionRow({
  permission,
  isSelected,
  onToggle,
  disabled,
  isAdded = false,
  isRemoved = false,
}: PermissionRowProps) {
  const checkboxId = `permission-${permission.key}`
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors',
        !disabled && 'hover:bg-zinc-800/50',
        disabled && 'cursor-not-allowed opacity-60',
        isAdded && 'bg-emerald-950/30 hover:bg-emerald-950/40',
        isRemoved && 'bg-red-950/30 hover:bg-red-950/40',
      )}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault()
          onToggle()
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <Checkbox
        id={checkboxId}
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={disabled}
        className={cn(
          'mt-0.5 border-zinc-600',
          isAdded && 'border-emerald-600',
          isRemoved && 'border-red-600',
        )}
        aria-label={permission.label}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm',
            isAdded && 'text-emerald-300',
            isRemoved && 'text-red-300',
            !isAdded && !isRemoved && 'text-zinc-200',
          )}
        >
          {permission.label}
          {isAdded && <span className="ml-2 text-xs text-emerald-500 font-medium">+Added</span>}
          {isRemoved && <span className="ml-2 text-xs text-red-500 font-medium">-Removed</span>}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{permission.description}</p>
      </div>
    </div>
  )
}
