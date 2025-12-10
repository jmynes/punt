import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // Copy/paste behavior
  openSinglePastedTicket: boolean
  setOpenSinglePastedTicket: (value: boolean) => void

  // Date picker max year for ticket forms
  ticketDateMaxYear: number
  setTicketDateMaxYear: (value: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default: open single pasted ticket
      openSinglePastedTicket: true,
      setOpenSinglePastedTicket: (value) => set({ openSinglePastedTicket: value }),

      // Default: allow dates up to current year + 5 for ticket forms
      ticketDateMaxYear: new Date().getFullYear() + 5,
      setTicketDateMaxYear: (value) => set({ ticketDateMaxYear: value }),
    }),
    {
      name: 'punt-settings',
    },
  ),
)


