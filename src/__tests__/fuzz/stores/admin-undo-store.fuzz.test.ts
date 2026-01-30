/**
 * Fuzz tests for admin undo store invariants.
 * Tests that admin undo/redo operations maintain consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAdminUndoStore } from '@/stores/admin-undo-store'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useAdminUndoStore.setState({
    undoStack: [],
    redoStack: [],
  })
}

// User snapshot generator
const userSnapshot = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  email: fc.string({ minLength: 3, maxLength: 50 }),
  isSystemAdmin: fc.boolean(),
  isActive: fc.boolean(),
})

// Array of user snapshots
const userSnapshots = fc.array(userSnapshot, { minLength: 1, maxLength: 5 })

// Member role snapshot generator
const memberRoleSnapshot = fc.record({
  membershipId: fc.uuid(),
  projectId: fc.uuid(),
  targetUserId: fc.uuid(),
  userName: fc.string({ minLength: 1, maxLength: 50 }),
  previousRoleId: fc.uuid(),
  previousRoleName: fc.constantFrom('owner', 'admin', 'member'),
  newRoleId: fc.uuid(),
  newRoleName: fc.constantFrom('owner', 'admin', 'member'),
})

beforeEach(() => {
  resetStore()
})

describe('Admin Undo Store Fuzz Tests', () => {
  describe('pushUserDisable', () => {
    it('should increase undo stack size by 1', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          const initialSize = useAdminUndoStore.getState().undoStack.length

          useAdminUndoStore.getState().pushUserDisable(users)

          expect(useAdminUndoStore.getState().undoStack.length).toBe(initialSize + 1)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should clear redo stack when pushing new action', () => {
      fc.assert(
        fc.property(userSnapshots, userSnapshots, (users1, users2) => {
          resetStore()
          // Set up initial redo stack
          useAdminUndoStore.getState().pushUserDisable(users1)
          useAdminUndoStore.getState().undo()
          expect(useAdminUndoStore.getState().redoStack.length).toBeGreaterThan(0)

          useAdminUndoStore.getState().pushUserDisable(users2)

          expect(useAdminUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should add action with correct type', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()

          useAdminUndoStore.getState().pushUserDisable(users)

          const stack = useAdminUndoStore.getState().undoStack
          expect(stack[stack.length - 1].type).toBe('userDisable')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('pushUserEnable', () => {
    it('should add action with correct type', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()

          useAdminUndoStore.getState().pushUserEnable(users)

          const stack = useAdminUndoStore.getState().undoStack
          expect(stack[stack.length - 1].type).toBe('userEnable')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('pushUserMakeAdmin', () => {
    it('should add action with correct type', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()

          useAdminUndoStore.getState().pushUserMakeAdmin(users)

          const stack = useAdminUndoStore.getState().undoStack
          expect(stack[stack.length - 1].type).toBe('userMakeAdmin')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('pushUserRemoveAdmin', () => {
    it('should add action with correct type', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()

          useAdminUndoStore.getState().pushUserRemoveAdmin(users)

          const stack = useAdminUndoStore.getState().undoStack
          expect(stack[stack.length - 1].type).toBe('userRemoveAdmin')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('pushMemberRoleChange', () => {
    it('should add action with correct type', () => {
      fc.assert(
        fc.property(memberRoleSnapshot, (member) => {
          resetStore()

          useAdminUndoStore.getState().pushMemberRoleChange(member)

          const stack = useAdminUndoStore.getState().undoStack
          expect(stack[stack.length - 1].type).toBe('memberRoleChange')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('undo', () => {
    it('should return last pushed action', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users)

          const undone = useAdminUndoStore.getState().undo()

          expect(undone?.type).toBe('userDisable')
          if (undone?.type === 'userDisable') {
            expect(undone.users).toEqual(users)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should decrease undo stack size by 1 when non-empty', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users)
          const initialSize = useAdminUndoStore.getState().undoStack.length

          useAdminUndoStore.getState().undo()

          expect(useAdminUndoStore.getState().undoStack.length).toBe(initialSize - 1)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return undefined when stack is empty', () => {
      resetStore()
      const result = useAdminUndoStore.getState().undo()

      expect(result).toBeUndefined()
    })

    it('should move action to redo stack', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users)

          useAdminUndoStore.getState().undo()

          const redoStack = useAdminUndoStore.getState().redoStack
          expect(redoStack.length).toBe(1)
          expect(redoStack[0].type).toBe('userDisable')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('redo', () => {
    it('should return last undone action', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users)
          useAdminUndoStore.getState().undo()

          const redone = useAdminUndoStore.getState().redo()

          expect(redone?.type).toBe('userDisable')
          if (redone?.type === 'userDisable') {
            expect(redone.users).toEqual(users)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should move action back to undo stack', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users)
          useAdminUndoStore.getState().undo()
          useAdminUndoStore.getState().redo()

          const undoStack = useAdminUndoStore.getState().undoStack
          expect(undoStack.length).toBe(1)
          expect(undoStack[0].type).toBe('userDisable')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return undefined when redo stack is empty', () => {
      resetStore()
      const result = useAdminUndoStore.getState().redo()

      expect(result).toBeUndefined()
    })
  })

  describe('canUndo and canRedo', () => {
    it('canUndo should reflect undo stack state', () => {
      fc.assert(
        fc.property(fc.boolean(), (shouldPush) => {
          resetStore()
          if (shouldPush) {
            useAdminUndoStore.getState().pushUserDisable([
              {
                id: '1',
                name: 'Test',
                email: 'test@test.com',
                isSystemAdmin: false,
                isActive: true,
              },
            ])
          }

          const canUndo = useAdminUndoStore.getState().canUndo()

          expect(canUndo).toBe(shouldPush)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('canRedo should reflect redo stack state', () => {
      fc.assert(
        fc.property(fc.boolean(), (shouldUndo) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable([
            {
              id: '1',
              name: 'Test',
              email: 'test@test.com',
              isSystemAdmin: false,
              isActive: true,
            },
          ])
          if (shouldUndo) {
            useAdminUndoStore.getState().undo()
          }

          const canRedo = useAdminUndoStore.getState().canRedo()

          expect(canRedo).toBe(shouldUndo)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('clear', () => {
    it('should empty both stacks', () => {
      fc.assert(
        fc.property(userSnapshots, userSnapshots, (users1, users2) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users1)
          useAdminUndoStore.getState().pushUserEnable(users2)
          useAdminUndoStore.getState().undo()

          useAdminUndoStore.getState().clear()

          expect(useAdminUndoStore.getState().undoStack.length).toBe(0)
          expect(useAdminUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('undo/redo cycle invariants', () => {
    it('undo then redo should restore original state', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          useAdminUndoStore.getState().pushUserDisable(users)

          useAdminUndoStore.getState().undo()
          useAdminUndoStore.getState().redo()

          const undoStack = useAdminUndoStore.getState().undoStack
          expect(undoStack.length).toBe(1)
          expect(undoStack[0].type).toBe('userDisable')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('multiple operations should maintain stack consistency', () => {
      fc.assert(
        fc.property(fc.array(userSnapshots, { minLength: 1, maxLength: 5 }), (userArrays) => {
          resetStore()

          // Push all actions
          for (const users of userArrays) {
            useAdminUndoStore.getState().pushUserDisable(users)
          }

          expect(useAdminUndoStore.getState().undoStack.length).toBe(userArrays.length)
          expect(useAdminUndoStore.getState().redoStack.length).toBe(0)

          // Undo all
          for (let i = 0; i < userArrays.length; i++) {
            useAdminUndoStore.getState().undo()
          }

          expect(useAdminUndoStore.getState().undoStack.length).toBe(0)
          expect(useAdminUndoStore.getState().redoStack.length).toBe(userArrays.length)

          // Redo all
          for (let i = 0; i < userArrays.length; i++) {
            useAdminUndoStore.getState().redo()
          }

          expect(useAdminUndoStore.getState().undoStack.length).toBe(userArrays.length)
          expect(useAdminUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('timestamp invariants', () => {
    it('should include timestamp on all actions', () => {
      fc.assert(
        fc.property(userSnapshots, (users) => {
          resetStore()
          const beforeTime = Date.now()

          useAdminUndoStore.getState().pushUserDisable(users)

          const stack = useAdminUndoStore.getState().undoStack
          const action = stack[stack.length - 1]
          expect(action.timestamp).toBeGreaterThanOrEqual(beforeTime)
          expect(action.timestamp).toBeLessThanOrEqual(Date.now())
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
