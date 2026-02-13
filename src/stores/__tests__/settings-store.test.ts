/**
 * Unit tests for settings store.
 * Covers all settings operations including custom colors and sidebar sections.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../settings-store'

// Helper to reset store state to defaults
function resetStore() {
  useSettingsStore.setState({
    openSinglePastedTicket: true,
    ticketDateMaxYearMode: 'default',
    ticketDateMaxYear: new Date().getFullYear() + 5,
    autoSaveOnDrawerClose: false,
    autoSaveOnRoleEditorClose: false,
    customColors: [],
    showUndoButtons: true,
    sidebarExpandedSections: {},
    hideColorRemovalWarning: false,
    persistTableSort: true,
    dismissedAddColumnProjects: [],
  })
}

describe('Settings Store', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('autoSaveOnRoleEditorClose', () => {
    it('should default to false', () => {
      expect(useSettingsStore.getState().autoSaveOnRoleEditorClose).toBe(false)
    })

    it('should set autoSaveOnRoleEditorClose to true', () => {
      useSettingsStore.getState().setAutoSaveOnRoleEditorClose(true)
      expect(useSettingsStore.getState().autoSaveOnRoleEditorClose).toBe(true)
    })

    it('should set autoSaveOnRoleEditorClose to false', () => {
      useSettingsStore.getState().setAutoSaveOnRoleEditorClose(true)
      useSettingsStore.getState().setAutoSaveOnRoleEditorClose(false)
      expect(useSettingsStore.getState().autoSaveOnRoleEditorClose).toBe(false)
    })
  })

  describe('showUndoButtons', () => {
    it('should default to true', () => {
      expect(useSettingsStore.getState().showUndoButtons).toBe(true)
    })

    it('should set showUndoButtons to false', () => {
      useSettingsStore.getState().setShowUndoButtons(false)
      expect(useSettingsStore.getState().showUndoButtons).toBe(false)
    })

    it('should set showUndoButtons back to true', () => {
      useSettingsStore.getState().setShowUndoButtons(false)
      useSettingsStore.getState().setShowUndoButtons(true)
      expect(useSettingsStore.getState().showUndoButtons).toBe(true)
    })
  })

  describe('customColors', () => {
    it('should default to empty array', () => {
      expect(useSettingsStore.getState().customColors).toEqual([])
    })

    it('should add a custom color', () => {
      useSettingsStore.getState().addCustomColor('#ff0000')
      expect(useSettingsStore.getState().customColors).toContain('#ff0000')
    })

    it('should normalize color to lowercase', () => {
      useSettingsStore.getState().addCustomColor('#FF0000')
      expect(useSettingsStore.getState().customColors).toContain('#ff0000')
      expect(useSettingsStore.getState().customColors).not.toContain('#FF0000')
    })

    it('should not add duplicate colors', () => {
      useSettingsStore.getState().addCustomColor('#ff0000')
      useSettingsStore.getState().addCustomColor('#FF0000')
      useSettingsStore.getState().addCustomColor('#ff0000')
      expect(useSettingsStore.getState().customColors.length).toBe(1)
    })

    it('should add new colors at the beginning', () => {
      useSettingsStore.getState().addCustomColor('#ff0000')
      useSettingsStore.getState().addCustomColor('#00ff00')
      expect(useSettingsStore.getState().customColors[0]).toBe('#00ff00')
      expect(useSettingsStore.getState().customColors[1]).toBe('#ff0000')
    })

    it('should limit to 20 colors', () => {
      for (let i = 0; i < 25; i++) {
        useSettingsStore.getState().addCustomColor(`#${i.toString().padStart(6, '0')}`)
      }
      expect(useSettingsStore.getState().customColors.length).toBe(20)
    })

    it('should keep the newest colors when at limit', () => {
      for (let i = 0; i < 25; i++) {
        useSettingsStore.getState().addCustomColor(`#${i.toString().padStart(6, '0')}`)
      }
      // The last added color (24) should be first
      expect(useSettingsStore.getState().customColors[0]).toBe('#000024')
    })

    it('should remove a custom color', () => {
      useSettingsStore.getState().addCustomColor('#ff0000')
      useSettingsStore.getState().addCustomColor('#00ff00')
      useSettingsStore.getState().removeCustomColor('#ff0000')
      expect(useSettingsStore.getState().customColors).not.toContain('#ff0000')
      expect(useSettingsStore.getState().customColors).toContain('#00ff00')
    })

    it('should remove color case-insensitively', () => {
      useSettingsStore.getState().addCustomColor('#ff0000')
      useSettingsStore.getState().removeCustomColor('#FF0000')
      expect(useSettingsStore.getState().customColors).not.toContain('#ff0000')
    })

    it('should handle removing non-existent color', () => {
      useSettingsStore.getState().addCustomColor('#ff0000')
      useSettingsStore.getState().removeCustomColor('#00ff00')
      expect(useSettingsStore.getState().customColors).toContain('#ff0000')
    })
  })

  describe('sidebarExpandedSections', () => {
    it('should default to empty object', () => {
      expect(useSettingsStore.getState().sidebarExpandedSections).toEqual({})
    })

    it('should set sidebar section expanded state', () => {
      useSettingsStore.getState().setSidebarSectionExpanded('admin', true)
      expect(useSettingsStore.getState().sidebarExpandedSections.admin).toBe(true)
    })

    it('should set multiple sidebar sections', () => {
      useSettingsStore.getState().setSidebarSectionExpanded('admin', true)
      useSettingsStore.getState().setSidebarSectionExpanded('project-1', false)
      expect(useSettingsStore.getState().sidebarExpandedSections.admin).toBe(true)
      expect(useSettingsStore.getState().sidebarExpandedSections['project-1']).toBe(false)
    })

    it('should toggle sidebar section from undefined to true', () => {
      useSettingsStore.getState().toggleSidebarSection('admin')
      expect(useSettingsStore.getState().sidebarExpandedSections.admin).toBe(true)
    })

    it('should toggle sidebar section from true to false', () => {
      useSettingsStore.getState().setSidebarSectionExpanded('admin', true)
      useSettingsStore.getState().toggleSidebarSection('admin')
      expect(useSettingsStore.getState().sidebarExpandedSections.admin).toBe(false)
    })

    it('should toggle sidebar section from false to true', () => {
      useSettingsStore.getState().setSidebarSectionExpanded('admin', false)
      useSettingsStore.getState().toggleSidebarSection('admin')
      expect(useSettingsStore.getState().sidebarExpandedSections.admin).toBe(true)
    })
  })

  describe('hideColorRemovalWarning', () => {
    it('should default to false', () => {
      expect(useSettingsStore.getState().hideColorRemovalWarning).toBe(false)
    })

    it('should set hideColorRemovalWarning to true', () => {
      useSettingsStore.getState().setHideColorRemovalWarning(true)
      expect(useSettingsStore.getState().hideColorRemovalWarning).toBe(true)
    })
  })

  describe('persistTableSort', () => {
    it('should default to true', () => {
      expect(useSettingsStore.getState().persistTableSort).toBe(true)
    })

    it('should set persistTableSort to false', () => {
      useSettingsStore.getState().setPersistTableSort(false)
      expect(useSettingsStore.getState().persistTableSort).toBe(false)
    })
  })

  describe('dismissedAddColumnProjects', () => {
    it('should default to empty array', () => {
      expect(useSettingsStore.getState().dismissedAddColumnProjects).toEqual([])
    })

    it('should dismiss add column for a project', () => {
      useSettingsStore.getState().dismissAddColumn('project-1')
      expect(useSettingsStore.getState().dismissedAddColumnProjects).toContain('project-1')
    })

    it('should not add duplicate dismissals', () => {
      useSettingsStore.getState().dismissAddColumn('project-1')
      useSettingsStore.getState().dismissAddColumn('project-1')
      expect(
        useSettingsStore.getState().dismissedAddColumnProjects.filter((id) => id === 'project-1')
          .length,
      ).toBe(1)
    })

    it('should undismiss add column for a project', () => {
      useSettingsStore.getState().dismissAddColumn('project-1')
      useSettingsStore.getState().dismissAddColumn('project-2')
      useSettingsStore.getState().undismissAddColumn('project-1')
      expect(useSettingsStore.getState().dismissedAddColumnProjects).not.toContain('project-1')
      expect(useSettingsStore.getState().dismissedAddColumnProjects).toContain('project-2')
    })

    it('should handle undismissing non-dismissed project', () => {
      useSettingsStore.getState().undismissAddColumn('project-1')
      expect(useSettingsStore.getState().dismissedAddColumnProjects).toEqual([])
    })
  })
})
