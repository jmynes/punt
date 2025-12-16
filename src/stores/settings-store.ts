import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // Copy/paste behavior
  openSinglePastedTicket: boolean
  setOpenSinglePastedTicket: (value: boolean) => void

  // Date picker max year for ticket forms
  ticketDateMaxYearMode: 'default' | 'custom'
  setTicketDateMaxYearMode: (value: 'default' | 'custom') => void
  ticketDateMaxYear: number
  setTicketDateMaxYear: (value: number) => void

  // Ticket drawer unsaved changes behavior
  autoSaveOnDrawerClose: boolean
  setAutoSaveOnDrawerClose: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default: open single pasted ticket
      openSinglePastedTicket: true,
      setOpenSinglePastedTicket: (value) => set({ openSinglePastedTicket: value }),

      // Default: use default max year (current year + 5)
      ticketDateMaxYearMode: 'default',
      setTicketDateMaxYearMode: (value) => set({ ticketDateMaxYearMode: value }),
      ticketDateMaxYear: new Date().getFullYear() + 5,
      setTicketDateMaxYear: (value) => set({ ticketDateMaxYear: value }),

      // Default: show confirmation dialog for unsaved changes
      autoSaveOnDrawerClose: false,
      setAutoSaveOnDrawerClose: (value) => set({ autoSaveOnDrawerClose: value }),
    }),
    {
      name: 'punt-settings',
    },
  ),
)
