import { useState, useEffect } from 'react'
import { useSettingsStore, useProjectsStore } from '../store'
import { Check, AlertCircle, ChevronDown, ChevronRight, Home, Inbox, Focus, ListTodo, FolderOpen } from 'lucide-react'
import type { ThemeId } from '../lib/themes'
import { themes } from '../lib/themes'
import { PROJECT_COLORS, PROJECT_ICONS } from '../components/Layout'

// Navigation items for customization
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'focus', label: 'Focus', icon: Focus },
  { id: 'todos', label: 'Todos', icon: ListTodo },
] as const

export function Settings() {
  const { settings, fetchSettings, saveAllSettings, updateSetting } = useSettingsStore()
  const { projects, fetchProjects, updateProject } = useProjectsStore()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchProjects()
  }, [fetchSettings, fetchProjects])

  useEffect(() => {
    setName(settings.name)
    setApiKey(settings.openai_api_key)
  }, [settings])

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await saveAllSettings({ name, openai_api_key: apiKey, theme: settings.theme })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
    }
  }

  const handleThemeChange = async (themeId: ThemeId) => {
    try {
      await updateSetting('theme', themeId)
    } catch (error) {
      console.error('Failed to update theme:', error)
    }
  }

  const handleTestApiKey = async () => {
    if (!apiKey) return

    setTestStatus('testing')
    try {
      // Save the key first so the main process can use it
      await saveAllSettings({ name, openai_api_key: apiKey })

      // For now, just validate the format
      if (apiKey.startsWith('sk-') && apiKey.length > 20) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
      }
    } catch (error) {
      setTestStatus('error')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  return (
    <div className="h-full overflow-auto p-6 bg-helm-surface rounded-2xl">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-helm-text mb-8">Settings</h1>

      <div className="space-y-8">
        {/* Appearance */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            Appearance
          </h2>
          <div>
            <label className="block text-sm text-helm-text mb-3">Theme</label>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`relative p-1 rounded-xl transition-all ${
                    settings.theme === theme.id
                      ? 'ring-2 ring-helm-primary ring-offset-2 ring-offset-helm-bg'
                      : 'hover:ring-2 hover:ring-helm-border hover:ring-offset-2 hover:ring-offset-helm-bg'
                  }`}
                >
                  <div
                    className="h-16 rounded-lg mb-2"
                    style={{ background: theme.preview }}
                  />
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm text-helm-text">{theme.name}</span>
                    {settings.theme === theme.id && (
                      <Check size={14} className="text-helm-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Navigation Colors */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            Navigation
          </h2>
          <div className="space-y-3">
            {NAV_ITEMS.map((item) => {
              const currentColor = settings[`nav_${item.id}_color` as keyof typeof settings] as string || ''
              const colorHex = currentColor ? PROJECT_COLORS[currentColor] : undefined

              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-24">
                    <item.icon size={16} style={colorHex ? { color: colorHex } : undefined} className={colorHex ? '' : 'text-helm-text-muted'} />
                    <span className="text-sm text-helm-text">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSetting(`nav_${item.id}_color`, '')}
                      className={`w-6 h-6 rounded-full border-2 border-dashed transition-all ${
                        !currentColor
                          ? 'border-helm-text ring-2 ring-offset-2 ring-offset-helm-bg ring-helm-text'
                          : 'border-helm-border hover:border-helm-text-muted'
                      }`}
                      title="Default (no color)"
                    />
                    {Object.entries(PROJECT_COLORS).map(([colorId, hex]) => (
                      <button
                        key={colorId}
                        onClick={() => updateSetting(`nav_${item.id}_color`, colorId)}
                        className={`w-6 h-6 rounded-full transition-all ${
                          currentColor === colorId
                            ? 'ring-2 ring-offset-2 ring-offset-helm-bg ring-helm-text'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={colorId.charAt(0).toUpperCase() + colorId.slice(1)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Projects */}
        {projects.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            Projects
          </h2>
          <div className="space-y-2">
            {projects.filter(p => !p.archived_at).map((project) => {
              const isExpanded = expandedProject === project.id
              const CurrentIcon = PROJECT_ICONS[project.icon || 'folder'] || PROJECT_ICONS.folder
              const currentColor = PROJECT_COLORS[project.color || 'orange'] || PROJECT_COLORS.orange

              return (
                <div key={project.id} className="border border-helm-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-helm-surface-elevated transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <CurrentIcon size={16} style={{ color: currentColor }} />
                    <span className="text-sm text-helm-text flex-1 text-left">{project.name}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-4 border-t border-helm-border pt-3">
                      {/* Color */}
                      <div>
                        <label className="block text-xs text-helm-text-muted mb-2">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(PROJECT_COLORS).map(([colorId, colorHex]) => (
                            <button
                              key={colorId}
                              onClick={() => updateProject(project.id, { color: colorId })}
                              className={`w-6 h-6 rounded-full transition-all ${
                                (project.color || 'orange') === colorId
                                  ? 'ring-2 ring-offset-2 ring-offset-helm-bg ring-helm-text'
                                  : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: colorHex }}
                              title={colorId.charAt(0).toUpperCase() + colorId.slice(1)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Icon */}
                      <div>
                        <label className="block text-xs text-helm-text-muted mb-2">Icon</label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(PROJECT_ICONS).map(([iconId, IconComponent]) => (
                            <button
                              key={iconId}
                              onClick={() => updateProject(project.id, { icon: iconId })}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                (project.icon || 'folder') === iconId
                                  ? 'bg-helm-primary text-white'
                                  : 'bg-helm-bg text-helm-text-muted hover:bg-helm-surface-elevated hover:text-helm-text'
                              }`}
                              title={iconId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            >
                              <IconComponent size={16} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
        )}

        {/* General */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            General
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-helm-text mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should I call you?"
                className="w-full px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
              />
              <p className="mt-1 text-xs text-helm-text-muted">
                This is how the AI will address you in greetings and conversations.
              </p>
            </div>
          </div>
        </section>

        {/* AI */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            AI
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-helm-text mb-2">OpenAI API Key</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1 px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors font-mono text-sm"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text-muted hover:text-helm-text transition-colors"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={handleTestApiKey}
                  disabled={!apiKey || testStatus === 'testing'}
                  className="px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text-muted hover:text-helm-text transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {testStatus === 'testing' ? (
                    'Testing...'
                  ) : testStatus === 'success' ? (
                    <>
                      <Check size={14} className="text-helm-success" />
                      Valid
                    </>
                  ) : testStatus === 'error' ? (
                    <>
                      <AlertCircle size={14} className="text-helm-error" />
                      Invalid
                    </>
                  ) : (
                    'Test'
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-helm-text-muted">
                Your API key is stored locally and never sent anywhere except OpenAI.
              </p>
            </div>
          </div>
        </section>

        {/* Obsidian Integration */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            Obsidian
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-helm-text mb-2">Vault Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.obsidian_vault_path || ''}
                  onChange={(e) => updateSetting('obsidian_vault_path', e.target.value)}
                  placeholder="/Users/username/Obsidian/MyVault"
                  className="flex-1 px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors font-mono text-sm"
                />
                <button
                  onClick={async () => {
                    const path = await window.api.obsidian.selectVaultPath()
                    if (path) {
                      await updateSetting('obsidian_vault_path', path)
                    }
                  }}
                  className="px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text-muted hover:text-helm-text transition-colors flex items-center gap-2"
                >
                  <FolderOpen size={16} />
                  Browse
                </button>
              </div>
              <p className="mt-1 text-xs text-helm-text-muted">
                Path to your Obsidian vault. You can import notes from here into projects.
              </p>
            </div>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            Data
          </h2>
          <div className="p-4 bg-helm-surface border border-helm-border rounded-lg">
            <p className="text-sm text-helm-text-muted mb-4">
              Database location: ~/Library/Application Support/Helm
            </p>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg text-sm transition-colors">
                Export all data
              </button>
              <button className="px-4 py-2 bg-helm-surface-elevated hover:bg-helm-border text-helm-text rounded-lg text-sm transition-colors">
                Import
              </button>
            </div>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h2 className="text-sm font-medium text-helm-text-muted uppercase tracking-wider mb-4">
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ShortcutCard label="Quick switcher" shortcut="⌘⌘" />
            <ShortcutCard label="Global capture" shortcut="⌘↵" />
            <ShortcutCard label="Open Jeeves" shortcut="⌘K" />
            <ShortcutCard label="Focus mode" shortcut="⌘⇧F" />
          </div>
        </section>
      </div>

      {/* Save button */}
      <div className="mt-8 pt-6 border-t border-helm-border">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="px-6 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saveStatus === 'saving' ? (
            'Saving...'
          ) : saveStatus === 'saved' ? (
            <>
              <Check size={16} />
              Saved
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
      </div>
    </div>
  )
}

function ShortcutCard({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-helm-bg border border-helm-border rounded-lg">
      <kbd className="px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-lg text-helm-text font-mono">
        {shortcut}
      </kbd>
      <span className="text-xs text-helm-text-muted">{label}</span>
    </div>
  )
}
