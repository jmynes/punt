import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // Copy/paste behavior
  openSinglePastedTicket: boolean
  setOpenSinglePastedTicket: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default: open single pasted ticket
      openSinglePastedTicket: true,
      setOpenSinglePastedTicket: (value) => set({ openSinglePastedTicket: value }),
    }),
    {
      name: 'punt-settings',
    },
  ),
)

