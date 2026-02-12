'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  CheckSquare,
  Copy,
  GitCompare,
  GripVertical,
  Loader2,
  Lock,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Square,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ColorPickerBody } from '@/components/tickets/label-select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  availableUserKeys,
  memberKeys,
  useAvailableUsers,
  useProjectMembers,
} from '@/hooks/queries/use-members'
import {
  useCreateRole,
  useDeleteRole,
  useProjectRoles,
  useReorderRoles,
  useUpdateRole,
} from '@/hooks/queries/use-roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useHasPermission, useIsSystemAdmin } from '@/hooks/use-permissions'
import { getTabId } from '@/hooks/use-realtime'
import { LABEL_COLORS } from '@/lib/constants'
import { ALL_PERMISSIONS, PERMISSIONS } from '@/lib/permissions'
import { type DefaultRoleName, ROLE_POSITIONS, ROLE_PRESETS } from '@/lib/permissions/presets'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import {
  type BulkMemberRoleSnapshot,
  type MemberSnapshot,
  useAdminUndoStore,
} from '@/stores/admin-undo-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { Permission, RoleWithPermissions } from '@/types'
import { PermissionGrid } from './permission-grid'
import { RoleCompareDialog } from './role-compare-dialog'

interface RolesTabProps {
  projectId: string
}

interface SortableRoleItemProps {
  role: RoleWithPermissions
  isSelected: boolean
  isCreating: boolean
  canManageRoles: boolean | undefined
  onSelect: () => void
  onClone: () => void
  onDelete: () => void
  cloneDisabled: boolean
}

function SortableRoleItem({
  role,
  isSelected,
  isCreating,
  canManageRoles,
  onSelect,
  onClone,
  onDelete,
  cloneDisabled,
}: SortableRoleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role.id,
    disabled: !canManageRoles,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded-md transition-colors',
        isDragging && 'z-50 bg-zinc-700 shadow-lg ring-1 ring-amber-500/50',
        isSelected && !isCreating ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
      )}
    >
      {/* Drag handle */}
      {canManageRoles && (
        <button
          type="button"
          className="ml-1 cursor-grab touch-none text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-400 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex-1 flex items-center gap-3 px-3 py-2 text-left transition-colors min-w-0',
          !canManageRoles && 'pl-3',
          isSelected && !isCreating ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: role.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{role.name}</span>
            {role.isDefault && <Lock className="h-3 w-3 text-zinc-600 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{role.memberCount || 0} members</span>
          </div>
        </div>
      </button>
      {canManageRoles && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 mr-1 text-zinc-500 hover:text-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onClone()
              }}
              disabled={cloneDisabled}
            >
              <Copy className="mr-2 h-4 w-4" />
              Clone
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              disabled={role.isDefault || (role.memberCount || 0) > 0}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function RolesTab({ projectId }: RolesTabProps) {
  const { data: roles, isLoading: rolesLoading } = useProjectRoles(projectId)
  const { data: members, isLoading: membersLoading } = useProjectMembers(projectId)
  const createRole = useCreateRole(projectId)
  const updateRole = useUpdateRole(projectId)
  const deleteRole = useDeleteRole(projectId)
  const reorderRoles = useReorderRoles(projectId)
  const queryClient = useQueryClient()

  const {
    undo,
    redo,
    canUndo,
    canRedo,
    pushMemberAdd,
    pushMemberRemove,
    pushBulkMemberRoleChange,
  } = useAdminUndoStore()

  const canManageRoles = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)
  const isSystemAdmin = useIsSystemAdmin()
  const currentUser = useCurrentUser()

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [addMemberSearch, setAddMemberSearch] = useState('')

  // Available users for adding to this role
  const { data: availableUsers } = useAvailableUsers(projectId, addMemberSearch)

  // Form state for editing
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(LABEL_COLORS[0])
  const [editDescription, setEditDescription] = useState('')
  const [editPermissions, setEditPermissions] = useState<Permission[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Unsaved changes confirmation
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  const [pendingRole, setPendingRole] = useState<RoleWithPermissions | null>(null)
  const [rememberPreference, setRememberPreference] = useState(false)
  const { autoSaveOnRoleEditorClose, setAutoSaveOnRoleEditorClose } = useSettingsStore()

  // Delete confirmation
  const [deletingRole, setDeletingRole] = useState<RoleWithPermissions | null>(null)

  // Compare roles dialog
  const [showCompareDialog, setShowCompareDialog] = useState(false)

  // Multi-select state for role members
  const [memberSelectedIds, setMemberSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedMemberId, setLastSelectedMemberId] = useState<string | null>(null)
  const [isChangingBulkRole, setIsChangingBulkRole] = useState(false)
  const [isRemovingBulk, setIsRemovingBulk] = useState(false)
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false)

  // Show diff while editing
  const [showDiff, setShowDiff] = useState(false)
  const [originalPermissions, setOriginalPermissions] = useState<Permission[]>([])

  const isLoading = rolesLoading || membersLoading

  // Get the selected role
  const selectedRole = useMemo(() => {
    if (!selectedRoleId || !roles) return null
    return roles.find((r) => r.id === selectedRoleId) || null
  }, [selectedRoleId, roles])

  // Check if all permissions are currently enabled
  const allPermissionsEnabled = useMemo(
    () =>
      editPermissions.length === ALL_PERMISSIONS.length &&
      ALL_PERMISSIONS.every((p) => editPermissions.includes(p)),
    [editPermissions],
  )

  // Map a default role's position to its preset name for permission lookup
  const getPresetNameByPosition = useCallback((position: number): DefaultRoleName | null => {
    const entry = Object.entries(ROLE_POSITIONS).find(([, pos]) => pos === position)
    return entry ? (entry[0] as DefaultRoleName) : null
  }, [])

  // Check if the selected role's permissions match the preset defaults
  const isAtDefaults = useMemo(() => {
    if (isCreating || !selectedRole?.isDefault) return true
    const presetName = getPresetNameByPosition(selectedRole.position)
    if (!presetName) return true
    const preset = ROLE_PRESETS[presetName]
    return (
      editPermissions.length === preset.length && preset.every((p) => editPermissions.includes(p))
    )
  }, [
    editPermissions,
    selectedRole?.isDefault,
    selectedRole?.position,
    isCreating,
    getPresetNameByPosition,
  ])

  // Get members for the selected role
  const roleMembers = useMemo(() => {
    if (!selectedRoleId || !members) return []
    return members.filter((m) => m.roleId === selectedRoleId)
  }, [selectedRoleId, members])

  // Split role members into current user and others for multi-select
  const currentMemberInRole = roleMembers.find((m) => m.userId === currentUser?.id)
  const otherMembersInRole = roleMembers.filter((m) => m.userId !== currentUser?.id)

  // Multi-select helpers
  const allOtherMembersSelected =
    otherMembersInRole.length > 0 && otherMembersInRole.every((m) => memberSelectedIds.has(m.id))
  const someMembersSelected = memberSelectedIds.size > 0

  const handleMemberSelect = useCallback(
    (memberId: string, shiftKey: boolean) => {
      // Shift-click range selection
      if (shiftKey && lastSelectedMemberId && otherMembersInRole.length > 0) {
        const memberIds = otherMembersInRole.map((m) => m.id)
        const lastIndex = memberIds.indexOf(lastSelectedMemberId)
        const currentIndex = memberIds.indexOf(memberId)

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)
          const rangeIds = memberIds.slice(start, end + 1)

          setMemberSelectedIds((prev) => {
            const next = new Set(prev)
            const allSelected = rangeIds.every((id) => prev.has(id))
            for (const id of rangeIds) {
              if (allSelected) {
                next.delete(id)
              } else {
                next.add(id)
              }
            }
            return next
          })
          return
        }
      }

      // Normal toggle
      setMemberSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(memberId)) {
          next.delete(memberId)
        } else {
          next.add(memberId)
        }
        return next
      })
      setLastSelectedMemberId(memberId)
    },
    [lastSelectedMemberId, otherMembersInRole],
  )

  const selectAllMembers = () => {
    setMemberSelectedIds(new Set(otherMembersInRole.map((m) => m.id)))
  }

  const selectNoMembers = () => {
    setMemberSelectedIds(new Set())
  }

  // Clear selection when switching roles
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedRoleId is intentionally the only dependency - we want to reset selection when the role changes
  useEffect(() => {
    setMemberSelectedIds(new Set())
    setLastSelectedMemberId(null)
  }, [selectedRoleId])

  // Combined search results: members from other roles + available users
  const searchResults = useMemo(() => {
    if (!addMemberSearch.trim()) return []
    const search = addMemberSearch.toLowerCase()

    // Members from other roles (will be moved)
    const otherRoleMembers = (members || [])
      .filter((m) => m.roleId !== selectedRoleId)
      .filter(
        (m) =>
          m.user.name.toLowerCase().includes(search) ||
          m.user.email?.toLowerCase().includes(search),
      )
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        avatarColor: m.user.avatarColor,
        memberId: m.id,
        currentRole: roles?.find((r) => r.id === m.roleId),
        isExistingMember: true as const,
      }))

    // Available users (will be added)
    const newUsers = (availableUsers || []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      avatarColor: u.avatarColor,
      memberId: null,
      currentRole: null,
      isExistingMember: false as const,
    }))

    return [...otherRoleMembers, ...newUsers]
  }, [addMemberSearch, members, selectedRoleId, roles, availableUsers])

  // Invalidate member queries helper
  const invalidateMemberQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
    queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
    queryClient.invalidateQueries({ queryKey: availableUserKeys.byProject(projectId) })
  }, [queryClient, projectId])

  // Member action handlers with undo support
  const handleAddMemberToRole = useCallback(
    async (userId: string, userName: string, roleId: string) => {
      const roleName = roles?.find((r) => r.id === roleId)?.name || 'role'
      try {
        const res = await fetch(`/api/projects/${projectId}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tab-Id': getTabId(),
          },
          body: JSON.stringify({ userId, roleId }),
        })
        if (!res.ok) throw new Error('Failed to add member')
        const data = await res.json()
        invalidateMemberQueries()

        const snapshot: MemberSnapshot = {
          membershipId: data.id,
          projectId,
          userId,
          userName,
          roleId,
          roleName,
        }
        pushMemberAdd(projectId, [snapshot])
        toast.success(`Added ${userName} as ${roleName} (Ctrl+Z to undo)`)
      } catch {
        toast.error('Failed to add member')
      }
    },
    [projectId, roles, invalidateMemberQueries, pushMemberAdd],
  )

  const handleChangeMemberRole = useCallback(
    async (
      memberId: string,
      userId: string,
      userName: string,
      previousRoleId: string,
      newRoleId: string,
    ) => {
      const previousRoleName = roles?.find((r) => r.id === previousRoleId)?.name || 'role'
      const newRoleName = roles?.find((r) => r.id === newRoleId)?.name || 'role'
      try {
        const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Tab-Id': getTabId(),
          },
          body: JSON.stringify({ roleId: newRoleId }),
        })
        if (!res.ok) throw new Error('Failed to update role')
        invalidateMemberQueries()

        const snapshot: BulkMemberRoleSnapshot = {
          membershipId: memberId,
          userId,
          userName,
          previousRoleId,
          previousRoleName,
          newRoleId,
          newRoleName,
        }
        pushBulkMemberRoleChange(projectId, [snapshot])
        toast.success(`Changed ${userName} to ${newRoleName} (Ctrl+Z to undo)`)
      } catch {
        toast.error('Failed to update role')
      }
    },
    [projectId, roles, invalidateMemberQueries, pushBulkMemberRoleChange],
  )

  const handleRemoveMemberFromRole = useCallback(
    async (memberId: string, userId: string, userName: string, roleId: string) => {
      const roleName = roles?.find((r) => r.id === roleId)?.name || 'role'
      try {
        const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
          method: 'DELETE',
          headers: { 'X-Tab-Id': getTabId() },
        })
        if (!res.ok) throw new Error('Failed to remove member')
        invalidateMemberQueries()

        const snapshot: MemberSnapshot = {
          membershipId: memberId,
          projectId,
          userId,
          userName,
          roleId,
          roleName,
        }
        pushMemberRemove(projectId, [snapshot])
        toast.success(`Removed ${userName} (Ctrl+Z to undo)`)
      } catch {
        toast.error('Failed to remove member')
      }
    },
    [projectId, roles, invalidateMemberQueries, pushMemberRemove],
  )

  // Bulk change role for selected members
  const handleBulkRoleChange = useCallback(
    async (newRoleId: string) => {
      if (memberSelectedIds.size === 0 || !selectedRoleId) return

      setIsChangingBulkRole(true)
      const count = memberSelectedIds.size
      const newRoleName = roles?.find((r) => r.id === newRoleId)?.name || 'role'
      const currentRoleName = roles?.find((r) => r.id === selectedRoleId)?.name || 'role'

      // Capture member snapshots for undo (with previous roles)
      const roleChanges: BulkMemberRoleSnapshot[] = [...memberSelectedIds]
        .map((memberId) => {
          const member = roleMembers.find((m) => m.id === memberId)
          if (!member) return null
          return {
            membershipId: member.id,
            userId: member.userId,
            userName: member.user.name,
            previousRoleId: selectedRoleId,
            previousRoleName: currentRoleName,
            newRoleId,
            newRoleName,
          }
        })
        .filter((m): m is BulkMemberRoleSnapshot => m !== null)

      try {
        await Promise.all(
          [...memberSelectedIds].map(async (memberId) => {
            const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ roleId: newRoleId }),
            })
            if (!res.ok) {
              const error = await res.json()
              throw new Error(error.error || 'Failed to update role')
            }
          }),
        )
        invalidateMemberQueries()

        // Push to undo stack
        pushBulkMemberRoleChange(projectId, roleChanges)

        toast.success(
          `Moved ${count} member${count !== 1 ? 's' : ''} to ${newRoleName} (Ctrl+Z to undo)`,
        )
        setMemberSelectedIds(new Set())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update roles')
      } finally {
        setIsChangingBulkRole(false)
      }
    },
    [
      memberSelectedIds,
      selectedRoleId,
      roles,
      roleMembers,
      projectId,
      invalidateMemberQueries,
      pushBulkMemberRoleChange,
    ],
  )

  // Bulk remove selected members
  const handleBulkRemove = useCallback(async () => {
    if (memberSelectedIds.size === 0 || !selectedRoleId) return

    setIsRemovingBulk(true)
    const count = memberSelectedIds.size
    const roleName = roles?.find((r) => r.id === selectedRoleId)?.name || 'role'

    // Capture member snapshots for undo
    const removedMembers: MemberSnapshot[] = [...memberSelectedIds]
      .map((memberId) => {
        const member = roleMembers.find((m) => m.id === memberId)
        if (!member) return null
        return {
          membershipId: member.id,
          projectId,
          userId: member.userId,
          userName: member.user.name,
          roleId: selectedRoleId,
          roleName,
        }
      })
      .filter((m): m is MemberSnapshot => m !== null)

    try {
      await Promise.all(
        [...memberSelectedIds].map(async (memberId) => {
          const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
            method: 'DELETE',
            headers: { 'X-Tab-Id': getTabId() },
          })
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to remove member')
          }
        }),
      )
      invalidateMemberQueries()

      // Push to undo stack
      pushMemberRemove(projectId, removedMembers)

      toast.success(`Removed ${count} member${count !== 1 ? 's' : ''} (Ctrl+Z to undo)`)
      setMemberSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove members')
    } finally {
      setIsRemovingBulk(false)
      setShowBulkRemoveDialog(false)
    }
  }, [
    memberSelectedIds,
    selectedRoleId,
    roles,
    roleMembers,
    projectId,
    invalidateMemberQueries,
    pushMemberRemove,
  ])

  // Handle undo
  const handleUndo = useCallback(async () => {
    const action = undo()
    if (!action) return

    if (action.type === 'memberRemove' && action.projectId === projectId) {
      try {
        await Promise.all(
          action.members.map(async (member) => {
            const res = await fetch(`/api/projects/${projectId}/members`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ userId: member.userId, roleId: member.roleId }),
            })
            if (!res.ok) throw new Error('Failed to restore member')
          }),
        )
        invalidateMemberQueries()
        toast.success(
          `Restored ${action.members.length} member${action.members.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Failed to restore members')
      }
    } else if (action.type === 'memberAdd' && action.projectId === projectId) {
      try {
        const currentMembers = members || []
        await Promise.all(
          action.members.map(async (member) => {
            const current = currentMembers.find((m) => m.userId === member.userId)
            if (!current) return
            const res = await fetch(`/api/projects/${projectId}/members/${current.id}`, {
              method: 'DELETE',
              headers: { 'X-Tab-Id': getTabId() },
            })
            if (!res.ok) throw new Error('Failed to remove member')
          }),
        )
        invalidateMemberQueries()
        toast.success(
          `Removed ${action.members.length} member${action.members.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Failed to remove members')
      }
    } else if (action.type === 'bulkMemberRoleChange' && action.projectId === projectId) {
      try {
        await Promise.all(
          action.members.map(async (member) => {
            const res = await fetch(`/api/projects/${projectId}/members/${member.membershipId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ roleId: member.previousRoleId }),
            })
            if (!res.ok) throw new Error('Failed to restore role')
          }),
        )
        invalidateMemberQueries()
        toast.success(
          `Restored roles for ${action.members.length} member${action.members.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Failed to restore roles')
      }
    }
  }, [undo, projectId, members, invalidateMemberQueries])

  // Handle redo
  const handleRedo = useCallback(async () => {
    const action = redo()
    if (!action) return

    if (action.type === 'memberRemove' && action.projectId === projectId) {
      try {
        const currentMembers = members || []
        await Promise.all(
          action.members.map(async (member) => {
            const current = currentMembers.find((m) => m.userId === member.userId)
            if (!current) return
            const res = await fetch(`/api/projects/${projectId}/members/${current.id}`, {
              method: 'DELETE',
              headers: { 'X-Tab-Id': getTabId() },
            })
            if (!res.ok) throw new Error('Failed to remove member')
          }),
        )
        invalidateMemberQueries()
        toast.success(
          `Removed ${action.members.length} member${action.members.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Failed to remove members')
      }
    } else if (action.type === 'memberAdd' && action.projectId === projectId) {
      try {
        await Promise.all(
          action.members.map(async (member) => {
            const res = await fetch(`/api/projects/${projectId}/members`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ userId: member.userId, roleId: member.roleId }),
            })
            if (!res.ok) throw new Error('Failed to add member')
          }),
        )
        invalidateMemberQueries()
        toast.success(
          `Added ${action.members.length} member${action.members.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Failed to add members')
      }
    } else if (action.type === 'bulkMemberRoleChange' && action.projectId === projectId) {
      try {
        await Promise.all(
          action.members.map(async (member) => {
            const res = await fetch(`/api/projects/${projectId}/members/${member.membershipId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ roleId: member.newRoleId }),
            })
            if (!res.ok) throw new Error('Failed to update role')
          }),
        )
        invalidateMemberQueries()
        toast.success(
          `Updated roles for ${action.members.length} member${action.members.length !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Failed to update roles')
      }
    }
  }, [redo, projectId, members, invalidateMemberQueries])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) handleUndo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo()) handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, canUndo, canRedo])

  // Load role data into form
  const loadRoleData = useCallback((role: RoleWithPermissions) => {
    setEditName(role.name)
    setEditColor(role.color)
    setEditDescription(role.description || '')
    setEditPermissions(role.permissions)
    setOriginalPermissions(role.permissions)
    setHasChanges(false)
    setShowDiff(false)
  }, [])

  // Select the first role by default when roles load
  useEffect(() => {
    if (roles && roles.length > 0 && !selectedRoleId && !isCreating) {
      setSelectedRoleId(roles[0].id)
      loadRoleData(roles[0])
    }
  }, [roles, selectedRoleId, isCreating, loadRoleData])

  // Handle role selection
  const handleSelectRole = (role: RoleWithPermissions) => {
    // Don't switch if already on this role
    if (role.id === selectedRoleId && !isCreating) return

    if (hasChanges) {
      if (autoSaveOnRoleEditorClose) {
        // Auto-save and switch
        handleSave().then(() => {
          setSelectedRoleId(role.id)
          setIsCreating(false)
          loadRoleData(role)
        })
        return
      }
      // Show confirmation dialog
      setPendingRole(role)
      setRememberPreference(false)
      setShowUnsavedConfirm(true)
      return
    }
    setSelectedRoleId(role.id)
    setIsCreating(false)
    loadRoleData(role)
  }

  // Confirm switch without saving
  const handleConfirmDiscard = () => {
    if (pendingRole) {
      setSelectedRoleId(pendingRole.id)
      setIsCreating(false)
      loadRoleData(pendingRole)
    }
    setShowUnsavedConfirm(false)
    setPendingRole(null)
    setRememberPreference(false)
  }

  // Save and switch
  const handleConfirmSaveAndSwitch = async () => {
    if (rememberPreference) {
      setAutoSaveOnRoleEditorClose(true)
    }
    await handleSave()
    if (pendingRole) {
      setSelectedRoleId(pendingRole.id)
      setIsCreating(false)
      loadRoleData(pendingRole)
    }
    setShowUnsavedConfirm(false)
    setPendingRole(null)
    setRememberPreference(false)
  }

  // Handle starting to create a new role
  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedRoleId(null)
    setEditName('')
    setEditColor(LABEL_COLORS[0])
    setEditDescription('')
    setEditPermissions([])
    setHasChanges(false)
  }

  // Handle drag end for role reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !roles) return

      const oldIndex = roles.findIndex((r) => r.id === active.id)
      const newIndex = roles.findIndex((r) => r.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      // Create new order
      const newRoles = [...roles]
      const [movedRole] = newRoles.splice(oldIndex, 1)
      newRoles.splice(newIndex, 0, movedRole)

      // Optimistically update the cache
      queryClient.setQueryData(
        ['roles', 'project', projectId],
        newRoles.map((r, i) => ({ ...r, position: i })),
      )

      // Persist to server
      reorderRoles.mutate(newRoles.map((r) => r.id))
    },
    [roles, queryClient, projectId, reorderRoles],
  )

  // Check if form values differ from the original role
  const checkForChanges = (
    name: string,
    color: string,
    description: string,
    permissions: Permission[],
  ) => {
    if (isCreating) {
      // For new roles, any non-default values count as changes
      return name.trim() !== '' || description.trim() !== '' || permissions.length > 0
    }
    if (!selectedRole) return false

    const nameChanged = name !== selectedRole.name
    const colorChanged = color !== selectedRole.color
    const descChanged = (description || '') !== (selectedRole.description || '')
    const permsChanged =
      permissions.length !== selectedRole.permissions.length ||
      permissions.some((p) => !selectedRole.permissions.includes(p)) ||
      selectedRole.permissions.some((p) => !permissions.includes(p))

    return nameChanged || colorChanged || descChanged || permsChanged
  }

  // Handle form field changes
  const handleFieldChange = (field: string, value: unknown) => {
    let newName = editName
    let newColor = editColor
    let newDescription = editDescription
    let newPermissions = editPermissions

    switch (field) {
      case 'name':
        newName = value as string
        setEditName(newName)
        break
      case 'color':
        newColor = value as string
        setEditColor(newColor)
        break
      case 'description':
        newDescription = value as string
        setEditDescription(newDescription)
        break
      case 'permissions':
        newPermissions = value as Permission[]
        setEditPermissions(newPermissions)
        break
    }

    setHasChanges(checkForChanges(newName, newColor, newDescription, newPermissions))
  }

  // Save the role
  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error('Role name is required')
      return
    }

    try {
      if (isCreating) {
        const newRole = await createRole.mutateAsync({
          name: editName.trim(),
          color: editColor,
          description: editDescription.trim() || undefined,
          permissions: editPermissions,
        })
        setIsCreating(false)
        setSelectedRoleId(newRole.id)
      } else if (selectedRole) {
        await updateRole.mutateAsync({
          roleId: selectedRole.id,
          name: editName.trim(),
          color: editColor,
          description: editDescription.trim() || null,
          permissions: editPermissions,
        })
      }
      setHasChanges(false)
    } catch {
      // Error is handled by the mutation
    }
  }

  // Cancel editing
  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false)
      if (roles && roles.length > 0) {
        setSelectedRoleId(roles[0].id)
        loadRoleData(roles[0])
      }
    } else if (selectedRole) {
      loadRoleData(selectedRole)
    }
  }

  // Clone a role
  const handleCloneRole = async (role: RoleWithPermissions) => {
    try {
      const newRole = await createRole.mutateAsync({
        name: `${role.name} (Copy)`,
        color: role.color,
        description: role.description || undefined,
        permissions: role.permissions,
      })
      setSelectedRoleId(newRole.id)
      setIsCreating(false)
      loadRoleData(newRole)
      toast.success(`Cloned role "${role.name}"`)
    } catch {
      // Error handled by mutation
    }
  }

  // Delete a role
  const handleDeleteRole = async () => {
    if (!deletingRole) return
    try {
      await deleteRole.mutateAsync(deletingRole.id)
      setDeletingRole(null)
      // Select first available role
      if (roles && roles.length > 1) {
        const remainingRoles = roles.filter((r) => r.id !== deletingRole.id)
        if (remainingRoles.length > 0) {
          setSelectedRoleId(remainingRoles[0].id)
          loadRoleData(remainingRoles[0])
        }
      }
    } catch {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full min-h-[500px]">
      {/* Left Panel - Role List */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
          <div className="flex items-center gap-1">
            {roles && roles.length >= 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompareDialog(true)}
                title="Compare Roles"
              >
                <GitCompare className="h-4 w-4" />
              </Button>
            )}
            {canManageRoles && (
              <Button variant="ghost" size="sm" onClick={handleStartCreate}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <DndContext
            id="roles-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={roles?.map((r) => r.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 pr-3">
                {roles?.map((role) => (
                  <SortableRoleItem
                    key={role.id}
                    role={role}
                    isSelected={selectedRoleId === role.id}
                    isCreating={isCreating}
                    canManageRoles={canManageRoles}
                    onSelect={() => handleSelectRole(role)}
                    onClone={() => handleCloneRole(role)}
                    onDelete={() => setDeletingRole(role)}
                    cloneDisabled={createRole.isPending}
                  />
                ))}

                {isCreating && (
                  <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-amber-900/20 border border-amber-700/50">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <span className="text-sm font-medium text-amber-400">
                      {editName || 'New Role'}
                    </span>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>
      </div>

      {/* Right Panel - Role Editor */}
      <div className="flex-1 min-w-0">
        {selectedRole || isCreating ? (
          <Tabs defaultValue="permissions" className="h-full flex flex-col">
            {/* Tab bar */}
            <div className="mb-4">
              <TabsList className="w-full grid grid-cols-2 h-auto p-0 bg-transparent rounded-none gap-0">
                <TabsTrigger
                  value="permissions"
                  className="!rounded-none !rounded-l-lg !border !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger
                  value="members"
                  className="!rounded-none !rounded-r-lg !border !border-l-0 !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white disabled:!opacity-50"
                  disabled={isCreating}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Members ({roleMembers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <Card className="flex-1 flex flex-col bg-zinc-900/50 border-zinc-800 min-h-0">
              <CardHeader className="flex-shrink-0 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: editColor }} />
                  {canManageRoles ? (
                    <div className="group/title relative flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative">
                        <Input
                          value={editName}
                          onChange={(e) => handleFieldChange('name', e.target.value)}
                          placeholder="Role name..."
                          className="!text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 cursor-text"
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-700 group-hover/title:bg-zinc-500 group-focus-within/title:bg-amber-500 transition-colors" />
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-zinc-600 group-hover/title:text-zinc-400 group-focus-within/title:text-amber-500 transition-colors flex-shrink-0" />
                    </div>
                  ) : (
                    <CardTitle className="text-lg">{editName || 'New Role'}</CardTitle>
                  )}
                  {selectedRole?.isDefault && (
                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                      <Lock className="mr-1 h-3 w-3" />
                      Default
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {isCreating
                    ? 'Create a new role with custom permissions.'
                    : `Configure permissions and manage members for this role.`}
                </CardDescription>
              </CardHeader>

              <TabsContent value="permissions" className="flex-1 min-h-0 mt-0">
                <ScrollArea className="h-full">
                  <CardContent className="pt-0 space-y-4">
                    {/* Color */}
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <ColorPickerBody
                        activeColor={editColor}
                        onColorChange={(color) => handleFieldChange('color', color)}
                        onApply={(color) => {
                          if (/^#[0-9A-Fa-f]{6}$/i.test(color)) {
                            handleFieldChange('color', color)
                          }
                        }}
                        isDisabled={!canManageRoles}
                        projectId={projectId}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="role-description">Description (optional)</Label>
                      <Textarea
                        id="role-description"
                        value={editDescription}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        placeholder="Describe what this role can do..."
                        disabled={!canManageRoles}
                        className="bg-zinc-800/50 resize-none border-zinc-700 hover:border-zinc-500"
                        rows={2}
                      />
                    </div>

                    {/* Permissions */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Permissions</Label>
                        <div className="flex items-center gap-3">
                          {!isCreating && hasChanges && (
                            <label
                              htmlFor="show-diff"
                              className="flex items-center gap-2 cursor-pointer select-none"
                            >
                              <span className="text-xs text-zinc-500">Show changes</span>
                              <Checkbox
                                id="show-diff"
                                checked={showDiff}
                                onCheckedChange={(checked) => setShowDiff(checked === true)}
                                className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                              />
                            </label>
                          )}
                          {canManageRoles &&
                            !isCreating &&
                            selectedRole?.isDefault &&
                            !isAtDefaults &&
                            (() => {
                              const presetName = getPresetNameByPosition(selectedRole.position)
                              return presetName ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleFieldChange('permissions', [...ROLE_PRESETS[presetName]])
                                  }
                                  className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Reset to Defaults
                                </Button>
                              ) : null
                            })()}
                          {canManageRoles && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleFieldChange(
                                  'permissions',
                                  allPermissionsEnabled ? [] : [...ALL_PERMISSIONS],
                                )
                              }
                              className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              {allPermissionsEnabled ? 'Disable All' : 'Enable All'}
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 mb-3">
                        Select the actions members with this role can perform.
                      </p>
                      <PermissionGrid
                        selectedPermissions={editPermissions}
                        onChange={(perms) => handleFieldChange('permissions', perms)}
                        disabled={!canManageRoles}
                        originalPermissions={originalPermissions}
                        showDiff={showDiff && !isCreating}
                      />
                    </div>
                  </CardContent>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="members" className="flex-1 min-h-0 mt-0">
                <ScrollArea className="h-full">
                  <CardContent className="pt-0 space-y-4">
                    {/* Add member section */}
                    {canManageRoles && selectedRoleId && (
                      <div className="space-y-2">
                        <Label>Add member to this role</Label>
                        <div className="relative">
                          <Input
                            value={addMemberSearch}
                            onChange={(e) => setAddMemberSearch(e.target.value)}
                            placeholder="Search users to add..."
                            className="bg-zinc-800/50 border-zinc-700 hover:border-zinc-500"
                          />
                          {addMemberSearch && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-10 max-h-48 overflow-auto">
                              {searchResults.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    if (
                                      user.isExistingMember &&
                                      user.memberId &&
                                      user.currentRole
                                    ) {
                                      handleChangeMemberRole(
                                        user.memberId,
                                        user.id,
                                        user.name,
                                        user.currentRole.id,
                                        selectedRoleId,
                                      )
                                    } else {
                                      handleAddMemberToRole(user.id, user.name, selectedRoleId)
                                    }
                                    setAddMemberSearch('')
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 transition-colors text-left"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                                    <AvatarFallback
                                      className="text-xs text-white"
                                      style={{
                                        backgroundColor:
                                          user.avatarColor || getAvatarColor(user.id),
                                      }}
                                    >
                                      {getInitials(user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm text-zinc-200 truncate">{user.name}</p>
                                      {user.currentRole && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-4 border-zinc-600"
                                          style={{ color: user.currentRole.color }}
                                        >
                                          {user.currentRole.name}
                                        </Badge>
                                      )}
                                    </div>
                                    {user.email && (
                                      <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                                    )}
                                    {user.currentRole && (
                                      <p className="text-xs text-amber-500/70 mt-0.5">
                                        Will move from {user.currentRole.name}
                                      </p>
                                    )}
                                  </div>
                                  <UserPlus className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}
                          {addMemberSearch && searchResults.length === 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-10 px-3 py-2 text-sm text-zinc-500">
                              No users found
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Members list */}
                    {roleMembers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <Users className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm">No members with this role</p>
                        <p className="text-xs mt-1">Use the search above to add members</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Members ({roleMembers.length})</Label>
                          {/* Select All Row */}
                          {canManageRoles && otherMembersInRole.length > 0 && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={
                                  allOtherMembersSelected ? selectNoMembers : selectAllMembers
                                }
                                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                              >
                                {allOtherMembersSelected ? (
                                  <CheckSquare className="h-4 w-4 text-amber-500" />
                                ) : someMembersSelected ? (
                                  <Minus className="h-4 w-4 text-amber-500" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                                <span>
                                  {memberSelectedIds.size > 0
                                    ? `${memberSelectedIds.size} selected`
                                    : 'Select all'}
                                </span>
                              </button>
                              {memberSelectedIds.size > 0 && (
                                <button
                                  type="button"
                                  onClick={selectNoMembers}
                                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {(() => {
                          const renderMemberRow = (
                            member: (typeof roleMembers)[0],
                            isCurrentUser = false,
                          ) => {
                            const isSelected = memberSelectedIds.has(member.id)
                            const canSelect = canManageRoles && !isCurrentUser

                            return (
                              <div
                                key={member.id}
                                onMouseDown={(e) => {
                                  if (e.shiftKey) e.preventDefault()
                                }}
                                onClick={(e) => {
                                  if (canSelect) {
                                    handleMemberSelect(member.id, e.shiftKey)
                                  }
                                }}
                                className={cn(
                                  'flex items-center justify-between p-3 rounded-lg border transition-all duration-150',
                                  canSelect && 'cursor-pointer',
                                  isSelected
                                    ? 'ring-1 ring-amber-500/50 bg-amber-500/5 border-amber-500/30'
                                    : 'bg-zinc-800/30 border-zinc-800',
                                  canSelect && !isSelected && 'hover:bg-zinc-800/50',
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Checkbox */}
                                  {canSelect && (
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleMemberSelect(member.id, false)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-zinc-500 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-600"
                                    />
                                  )}
                                  {isSystemAdmin ? (
                                    <Link
                                      href={`/admin/users/${member.user.username}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="group/profile flex items-center gap-3 text-inherit hover:text-zinc-50 transition-colors"
                                    >
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage
                                          src={member.user.avatar || undefined}
                                          alt={member.user.name}
                                        />
                                        <AvatarFallback
                                          className="text-xs font-medium text-white"
                                          style={{
                                            backgroundColor:
                                              member.user.avatarColor ||
                                              getAvatarColor(member.user.id || member.user.name),
                                          }}
                                        >
                                          {getInitials(member.user.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-medium text-zinc-200 group-hover/profile:underline">
                                            {member.user.name}
                                          </p>
                                          {isCurrentUser && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] px-1.5 py-0 h-4 border-amber-600 text-amber-500"
                                            >
                                              You
                                            </Badge>
                                          )}
                                        </div>
                                        {member.user.email && (
                                          <p className="text-xs text-zinc-500">
                                            {member.user.email}
                                          </p>
                                        )}
                                      </div>
                                    </Link>
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage
                                          src={member.user.avatar || undefined}
                                          alt={member.user.name}
                                        />
                                        <AvatarFallback
                                          className="text-xs font-medium text-white"
                                          style={{
                                            backgroundColor:
                                              member.user.avatarColor ||
                                              getAvatarColor(member.user.id || member.user.name),
                                          }}
                                        >
                                          {getInitials(member.user.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-medium text-zinc-200">
                                            {member.user.name}
                                          </p>
                                          {isCurrentUser && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] px-1.5 py-0 h-4 border-amber-600 text-amber-500"
                                            >
                                              You
                                            </Badge>
                                          )}
                                        </div>
                                        {member.user.email && (
                                          <p className="text-xs text-zinc-500">
                                            {member.user.email}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {canManageRoles && (
                                  <div
                                    className="flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {roles && roles.length > 1 && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"
                                          >
                                            <ArrowRightLeft className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="min-w-[140px]">
                                          {roles
                                            .filter((r) => r.id !== selectedRoleId)
                                            .map((role) => (
                                              <DropdownMenuItem
                                                key={role.id}
                                                onClick={() =>
                                                  handleChangeMemberRole(
                                                    member.id,
                                                    member.userId,
                                                    member.user.name,
                                                    member.roleId,
                                                    role.id,
                                                  )
                                                }
                                                className="gap-2"
                                              >
                                                <div
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: role.color }}
                                                />
                                                {role.name}
                                              </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        handleRemoveMemberFromRole(
                                          member.id,
                                          member.userId,
                                          member.user.name,
                                          member.roleId,
                                        )
                                      }
                                      className="text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <>
                              {currentMemberInRole && (
                                <>
                                  {renderMemberRow(currentMemberInRole, true)}
                                  {otherMembersInRole.length > 0 && (
                                    <div className="flex items-center gap-3 py-2">
                                      <div className="flex-1 h-px bg-zinc-800" />
                                      <span className="text-xs text-zinc-600 uppercase tracking-wider">
                                        Other Members
                                      </span>
                                      <div className="flex-1 h-px bg-zinc-800" />
                                    </div>
                                  )}
                                </>
                              )}
                              {otherMembersInRole.map((member) => renderMemberRow(member, false))}
                            </>
                          )
                        })()}
                      </div>
                    )}

                    {/* Floating Bulk Action Bar */}
                    {memberSelectedIds.size > 0 && (
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
                        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50">
                          <span className="text-sm text-zinc-300 font-medium pr-2 border-r border-zinc-700">
                            {memberSelectedIds.size} selected
                          </span>

                          {/* Move to Role */}
                          {roles && roles.length > 1 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-zinc-400">Move to:</span>
                              <Select
                                value=""
                                onValueChange={handleBulkRoleChange}
                                disabled={isChangingBulkRole}
                              >
                                <SelectTrigger className="h-7 w-[110px] bg-zinc-800 border-zinc-600 text-sm">
                                  <SelectValue
                                    placeholder={isChangingBulkRole ? 'Moving...' : 'Select...'}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles
                                    .filter((r) => r.id !== selectedRoleId)
                                    .map((role) => (
                                      <SelectItem key={role.id} value={role.id}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: role.color }}
                                          />
                                          <span>{role.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="w-px h-6 bg-zinc-700" />

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            onClick={() => setShowBulkRemoveDialog(true)}
                            disabled={isRemovingBulk}
                          >
                            <UserMinus className="h-4 w-4 mr-1.5" />
                            Remove
                          </Button>

                          <div className="w-px h-6 bg-zinc-700" />

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-zinc-200"
                            onClick={selectNoMembers}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </ScrollArea>
              </TabsContent>

              {/* Footer bar with save/cancel actions */}
              {canManageRoles && hasChanges && (
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
                  <p className="text-sm text-zinc-400">You have unsaved changes</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={createRole.isPending || updateRole.isPending}
                    >
                      {(createRole.isPending || updateRole.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isCreating ? 'Create Role' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Tabs>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a role to view its permissions</p>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved changes confirmation dialog */}
      <AlertDialog
        open={showUnsavedConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowUnsavedConfirm(false)
            setPendingRole(null)
            setRememberPreference(false)
          }
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              You have unsaved changes to this role. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-role-preference"
                checked={rememberPreference}
                onCheckedChange={(checked) => setRememberPreference(checked === true)}
                className="border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <Label
                htmlFor="remember-role-preference"
                className="text-sm text-zinc-300 cursor-pointer select-none"
              >
                Remember my preference to save and switch
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => {
                setShowUnsavedConfirm(false)
                setPendingRole(null)
                setRememberPreference(false)
              }}
            >
              Go Back
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDiscard}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Discard
            </Button>
            <AlertDialogAction
              onClick={handleConfirmSaveAndSwitch}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Save and Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete role confirmation dialog */}
      <AlertDialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Role</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deletingRole?.isDefault ? (
                'Default roles cannot be deleted.'
              ) : (deletingRole?.memberCount || 0) > 0 ? (
                <>
                  This role has{' '}
                  <span className="text-zinc-200 font-medium">
                    {deletingRole?.memberCount} member
                    {(deletingRole?.memberCount || 0) !== 1 ? 's' : ''}
                  </span>
                  . Reassign them to another role before deleting.
                </>
              ) : (
                <>
                  Are you sure you want to delete the role{' '}
                  <span className="text-zinc-200 font-medium">"{deletingRole?.name}"</span>? This
                  action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            {!deletingRole?.isDefault && (deletingRole?.memberCount || 0) === 0 && (
              <AlertDialogAction
                onClick={handleDeleteRole}
                className="bg-red-600 hover:bg-red-500 text-white"
                disabled={deleteRole.isPending}
              >
                {deleteRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Role
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Remove Members Confirmation */}
      <AlertDialog open={showBulkRemoveDialog} onOpenChange={setShowBulkRemoveDialog}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Remove {memberSelectedIds.size} Members
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to remove {memberSelectedIds.size} member
              {memberSelectedIds.size !== 1 ? 's' : ''} from this project? They will lose access to
              all project resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isRemovingBulk}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRemove}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isRemovingBulk}
            >
              {isRemovingBulk ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                `Remove ${memberSelectedIds.size} Member${memberSelectedIds.size !== 1 ? 's' : ''}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compare roles dialog */}
      {roles && roles.length >= 2 && (
        <RoleCompareDialog
          open={showCompareDialog}
          onOpenChange={setShowCompareDialog}
          roles={roles}
        />
      )}
    </div>
  )
}
