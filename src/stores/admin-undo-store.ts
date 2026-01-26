import { create } from 'zustand'

interface UserSnapshot {
  id: string
  name: string
  email: string
  isSystemAdmin: boolean
  isActive: boolean
}

interface MemberRoleSnapshot {
  membershipId: string
  projectId: string
  targetUserId: string
  userName: string
  previousRoleId: string
  previousRoleName: string
  newRoleId: string
  newRoleName: string
}

interface UserUndoAction {
  type: 'userDisable' | 'userEnable' | 'userMakeAdmin' | 'userRemoveAdmin'
  users: UserSnapshot[]
  timestamp: number
}

interface MemberRoleUndoAction {
  type: 'memberRoleChange'
  member: MemberRoleSnapshot
  timestamp: number
}

type AdminUndoAction = UserUndoAction | MemberRoleUndoAction

interface AdminUndoState {
  undoStack: AdminUndoAction[]
  redoStack: AdminUndoAction[]

  // Push a user status change action
  pushUserDisable: (users: UserSnapshot[]) => void
  pushUserEnable: (users: UserSnapshot[]) => void
  pushUserMakeAdmin: (users: UserSnapshot[]) => void
  pushUserRemoveAdmin: (users: UserSnapshot[]) => void
  pushMemberRoleChange: (member: MemberRoleSnapshot) => void

  // Undo the most recent action
  undo: () => AdminUndoAction | undefined

  // Redo the most recently undone action
  redo: () => AdminUndoAction | undefined

  // Check if undo/redo is available
  canUndo: () => boolean
  canRedo: () => boolean

  // Clear all history
  clear: () => void
}

export const useAdminUndoStore = create<AdminUndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUserDisable: (users) => {
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          type: 'userDisable',
          users,
          timestamp: Date.now(),
        },
      ],
      redoStack: [],
    }))
  },

  pushUserEnable: (users) => {
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          type: 'userEnable',
          users,
          timestamp: Date.now(),
        },
      ],
      redoStack: [],
    }))
  },

  pushUserMakeAdmin: (users) => {
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          type: 'userMakeAdmin',
          users,
          timestamp: Date.now(),
        },
      ],
      redoStack: [],
    }))
  },

  pushUserRemoveAdmin: (users) => {
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          type: 'userRemoveAdmin',
          users,
          timestamp: Date.now(),
        },
      ],
      redoStack: [],
    }))
  },

  pushMemberRoleChange: (member) => {
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          type: 'memberRoleChange',
          member,
          timestamp: Date.now(),
        },
      ],
      redoStack: [],
    }))
  },

  undo: () => {
    const state = get()
    if (state.undoStack.length === 0) return undefined

    const action = state.undoStack[state.undoStack.length - 1]
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, action],
    })
    return action
  },

  redo: () => {
    const state = get()
    if (state.redoStack.length === 0) return undefined

    const action = state.redoStack[state.redoStack.length - 1]
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, action],
    })
    return action
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clear: () => set({ undoStack: [], redoStack: [] }),
}))

// Expose for debugging
if (typeof window !== 'undefined') {
  ;(window as Window & { adminUndoStore?: typeof useAdminUndoStore }).adminUndoStore =
    useAdminUndoStore
}
