import { create } from 'zustand'
import type { ThemeId } from '../lib/themes'
import { applyTheme } from '../lib/themes'

interface Settings {
  name: string
  openai_api_key: string
  theme: ThemeId
}

interface SettingsState {
  settings: Settings
  isLoading: boolean
  error: string | null

  // Actions
  fetchSettings: () => Promise<void>
  updateSetting: (key: keyof Settings, value: string) => Promise<void>
  saveAllSettings: (settings: Settings) => Promise<void>
}

const defaultSettings: Settings = {
  name: '',
  openai_api_key: '',
  theme: 'peach-gradient'
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const allSettings = await window.api.settings.getAll()
      const theme = (allSettings.theme as ThemeId) || 'peach-gradient'

      // Sync theme from DB to localStorage and DOM
      applyTheme(theme)

      set({
        settings: {
          name: allSettings.name || '',
          openai_api_key: allSettings.openai_api_key || '',
          theme
        },
        isLoading: false
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  updateSetting: async (key, value) => {
    set({ error: null })
    try {
      await window.api.settings.set(key, value)

      // Apply theme immediately when changed
      if (key === 'theme') {
        applyTheme(value as ThemeId)
      }

      set((state) => ({
        settings: { ...state.settings, [key]: value }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  saveAllSettings: async (settings) => {
    set({ error: null })
    try {
      await Promise.all([
        window.api.settings.set('name', settings.name),
        window.api.settings.set('openai_api_key', settings.openai_api_key),
        window.api.settings.set('theme', settings.theme)
      ])

      // Apply theme
      applyTheme(settings.theme)

      set({ settings })
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  }
}))
