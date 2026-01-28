/**
 * Fuzz tests for projects store invariants.
 * Tests that project operations maintain consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { type ProjectSummary, useProjectsStore } from '@/stores/projects-store'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useProjectsStore.setState({
    projects: [],
    isLoading: false,
    error: null,
  })
}

// Project summary generator
const projectSummaryArb: fc.Arbitrary<ProjectSummary> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  key: fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 2,
      maxLength: 6,
    })
    .map((chars) => chars.join('')),
  color: fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 6, maxLength: 6 })
    .map((chars) => `#${chars.join('')}`),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  role: fc.option(fc.constantFrom('owner', 'admin', 'member'), { nil: undefined }),
  _count: fc.option(
    fc.record({
      tickets: fc.nat({ max: 1000 }),
      members: fc.nat({ max: 100 }),
    }),
    { nil: undefined },
  ),
})

// Array of projects
const projectsArray = fc.array(projectSummaryArb, { minLength: 0, maxLength: 10 })

beforeEach(() => {
  resetStore()
})

describe('Projects Store Fuzz Tests', () => {
  describe('setProjects', () => {
    it('should store all provided projects', () => {
      fc.assert(
        fc.property(projectsArray, (projects) => {
          resetStore()
          useProjectsStore.getState().setProjects(projects)

          const stored = useProjectsStore.getState().projects
          expect(stored.length).toBe(projects.length)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should set loading to false', () => {
      fc.assert(
        fc.property(projectsArray, (projects) => {
          resetStore()
          useProjectsStore.setState({ isLoading: true })

          useProjectsStore.getState().setProjects(projects)

          expect(useProjectsStore.getState().isLoading).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should clear error', () => {
      fc.assert(
        fc.property(projectsArray, (projects) => {
          resetStore()
          useProjectsStore.setState({ error: 'Some error' })

          useProjectsStore.getState().setProjects(projects)

          expect(useProjectsStore.getState().error).toBeNull()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should replace existing projects', () => {
      fc.assert(
        fc.property(projectsArray, projectsArray, (initial, replacement) => {
          resetStore()
          useProjectsStore.getState().setProjects(initial)
          useProjectsStore.getState().setProjects(replacement)

          const stored = useProjectsStore.getState().projects
          expect(stored.length).toBe(replacement.length)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      fc.assert(
        fc.property(fc.boolean(), (loading) => {
          resetStore()
          useProjectsStore.getState().setLoading(loading)

          expect(useProjectsStore.getState().isLoading).toBe(loading)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setError', () => {
    it('should set error state', () => {
      fc.assert(
        fc.property(fc.option(fc.string(), { nil: null }), (error) => {
          resetStore()
          useProjectsStore.getState().setError(error)

          expect(useProjectsStore.getState().error).toBe(error)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should set loading to false when error is set', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (error) => {
          resetStore()
          useProjectsStore.setState({ isLoading: true })

          useProjectsStore.getState().setError(error)

          expect(useProjectsStore.getState().isLoading).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('addProject', () => {
    it('should increase project count by 1', () => {
      fc.assert(
        fc.property(projectsArray, projectSummaryArb, (initial, newProject) => {
          resetStore()
          useProjectsStore.setState({ projects: [...initial] })
          const initialCount = initial.length

          useProjectsStore.getState().addProject(newProject)

          expect(useProjectsStore.getState().projects.length).toBe(initialCount + 1)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should add project to list', () => {
      fc.assert(
        fc.property(projectSummaryArb, (project) => {
          resetStore()
          useProjectsStore.getState().addProject(project)

          const stored = useProjectsStore.getState().projects
          expect(stored.some((p) => p.id === project.id)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('updateProject', () => {
    it('should update existing project without changing count', () => {
      fc.assert(
        fc.property(
          fc.array(projectSummaryArb, { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (projects, newName) => {
            resetStore()
            useProjectsStore.setState({ projects: [...projects] })
            const targetProject = projects[0]
            const initialCount = projects.length

            useProjectsStore.getState().updateProject(targetProject.id, { name: newName })

            const stored = useProjectsStore.getState().projects
            expect(stored.length).toBe(initialCount)

            const updated = stored.find((p) => p.id === targetProject.id)
            expect(updated?.name).toBe(newName)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other projects', () => {
      fc.assert(
        fc.property(
          fc.array(projectSummaryArb, { minLength: 2, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (projects, newName) => {
            resetStore()
            useProjectsStore.setState({ projects: [...projects] })
            const targetProject = projects[0]
            const otherProject = projects[1]
            const originalOtherName = otherProject.name

            useProjectsStore.getState().updateProject(targetProject.id, { name: newName })

            const stored = useProjectsStore.getState().projects
            const other = stored.find((p) => p.id === otherProject.id)
            expect(other?.name).toBe(originalOtherName)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle non-existent project gracefully', () => {
      fc.assert(
        fc.property(projectsArray, fc.uuid(), (projects, fakeId) => {
          fc.pre(!projects.some((p) => p.id === fakeId))
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const initialCount = projects.length

          useProjectsStore.getState().updateProject(fakeId, { name: 'New Name' })

          expect(useProjectsStore.getState().projects.length).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('removeProject', () => {
    it('should decrease project count by 1', () => {
      fc.assert(
        fc.property(fc.array(projectSummaryArb, { minLength: 1, maxLength: 10 }), (projects) => {
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const initialCount = projects.length
          const targetProject = projects[0]

          useProjectsStore.getState().removeProject(targetProject.id)

          expect(useProjectsStore.getState().projects.length).toBe(initialCount - 1)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should remove correct project', () => {
      fc.assert(
        fc.property(fc.array(projectSummaryArb, { minLength: 1, maxLength: 10 }), (projects) => {
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const targetProject = projects[0]

          useProjectsStore.getState().removeProject(targetProject.id)

          const stored = useProjectsStore.getState().projects
          expect(stored.find((p) => p.id === targetProject.id)).toBeUndefined()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other projects', () => {
      fc.assert(
        fc.property(fc.array(projectSummaryArb, { minLength: 2, maxLength: 10 }), (projects) => {
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const targetProject = projects[0]
          const otherProject = projects[1]

          useProjectsStore.getState().removeProject(targetProject.id)

          const stored = useProjectsStore.getState().projects
          expect(stored.find((p) => p.id === otherProject.id)).toBeDefined()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle non-existent project gracefully', () => {
      fc.assert(
        fc.property(projectsArray, fc.uuid(), (projects, fakeId) => {
          fc.pre(!projects.some((p) => p.id === fakeId))
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const initialCount = projects.length

          useProjectsStore.getState().removeProject(fakeId)

          expect(useProjectsStore.getState().projects.length).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('getProject', () => {
    it('should return project by id', () => {
      fc.assert(
        fc.property(fc.array(projectSummaryArb, { minLength: 1, maxLength: 10 }), (projects) => {
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const targetProject = projects[0]

          const found = useProjectsStore.getState().getProject(targetProject.id)

          expect(found?.id).toBe(targetProject.id)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return undefined for non-existent project', () => {
      fc.assert(
        fc.property(projectsArray, fc.uuid(), (projects, fakeId) => {
          fc.pre(!projects.some((p) => p.id === fakeId))
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })

          const found = useProjectsStore.getState().getProject(fakeId)

          expect(found).toBeUndefined()
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('getProjectByKey', () => {
    it('should return project by key (case insensitive)', () => {
      fc.assert(
        fc.property(fc.array(projectSummaryArb, { minLength: 1, maxLength: 10 }), (projects) => {
          resetStore()
          useProjectsStore.setState({ projects: [...projects] })
          const targetProject = projects[0]

          const foundLower = useProjectsStore
            .getState()
            .getProjectByKey(targetProject.key.toLowerCase())
          const foundUpper = useProjectsStore
            .getState()
            .getProjectByKey(targetProject.key.toUpperCase())

          expect(foundLower?.id).toBe(targetProject.id)
          expect(foundUpper?.id).toBe(targetProject.id)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return undefined for non-existent key', () => {
      fc.assert(
        fc.property(
          projectsArray,
          fc.string({ minLength: 10, maxLength: 15 }),
          (projects, fakeKey) => {
            fc.pre(!projects.some((p) => p.key.toLowerCase() === fakeKey.toLowerCase()))
            resetStore()
            useProjectsStore.setState({ projects: [...projects] })

            const found = useProjectsStore.getState().getProjectByKey(fakeKey)

            expect(found).toBeUndefined()
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('add then remove invariants', () => {
    it('should return to original count after add then remove', () => {
      fc.assert(
        fc.property(projectsArray, projectSummaryArb, (initial, newProject) => {
          resetStore()
          useProjectsStore.setState({ projects: [...initial] })
          const initialCount = initial.length

          useProjectsStore.getState().addProject(newProject)
          useProjectsStore.getState().removeProject(newProject.id)

          expect(useProjectsStore.getState().projects.length).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
