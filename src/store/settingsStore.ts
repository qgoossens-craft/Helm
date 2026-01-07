import { create } from 'zustand'
import type { ThemeId } from '../lib/themes'
import { applyTheme } from '../lib/themes'

interface Settings {
  name: string
  openai_api_key: string
  theme: ThemeId
  // Navigation colors
  nav_home_color: string
  nav_inbox_color: string
  nav_focus_color: string
  nav_todos_color: string
  // Obsidian integration
  obsidian_vault_path: string
  // Allow additional dynamic keys
  [key: string]: string
}

interface SettingsState {
  settings: Settings
  isLoading: boolean
  error: string | null

  // Actions
  fetchSettings: () => Promise<void>
  updateSetting: (key: string, value: string) => Promise<void>
  saveAllSettings: (settings: Partial<Settings>) => Promise<void>
}

const defaultSettings: Settings = {
  name: '',
  openai_api_key: '',
  theme: 'peach-gradient',
  nav_home_color: '',
  nav_inbox_color: '',
  nav_focus_color: '',
  nav_todos_color: '',
  obsidian_vault_path: ''
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

      // Merge all settings from DB with defaults
      set({
        settings: {
          ...defaultSettings,
          ...allSettings,
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
