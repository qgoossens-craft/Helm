// Theme IDs as const array for runtime validation
export const themeIds = ['peach-gradient', 'ocean-gradient', 'forest-gradient'] as const
export type ThemeId = typeof themeIds[number]

export interface ThemeDefinition {
  id: ThemeId
  name: string
  preview: string // CSS gradient/color for swatch preview
}

export const themes: ThemeDefinition[] = [
  { id: 'peach-gradient', name: 'Peach Sunset', preview: 'linear-gradient(135deg, #fff5ee, #ffe8d6, #ffb088)' },
  { id: 'ocean-gradient', name: 'Ocean Depths', preview: 'linear-gradient(145deg, #0f1419, #0f1f2e)' },
  { id: 'forest-gradient', name: 'Forest Mist', preview: 'linear-gradient(145deg, #0f140f, #1a2619)' },
]

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute('data-theme', themeId)
  localStorage.setItem('helm-theme', themeId)
}

export function getStoredTheme(): ThemeId {
  const stored = localStorage.getItem('helm-theme')
  if (stored && themes.some(t => t.id === stored)) {
    return stored as ThemeId
  }
  return 'peach-gradient'
}
