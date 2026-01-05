import { useState, useEffect } from 'react'
import { useSettingsStore } from '../store'
import { Check, AlertCircle } from 'lucide-react'

export function Settings() {
  const { settings, fetchSettings, saveAllSettings } = useSettingsStore()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    setName(settings.name)
    setApiKey(settings.openai_api_key)
  }, [settings])

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await saveAllSettings({ name, openai_api_key: apiKey })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
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
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-helm-text mb-8">Settings</h1>

      <div className="space-y-8">
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
          <div className="space-y-3">
            <ShortcutRow label="Quick capture" shortcut="⌘N" />
            <ShortcutRow label="Open copilot" shortcut="⌘K" />
            <ShortcutRow label="Focus mode" shortcut="⌘⇧F" />
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

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-helm-text">{label}</span>
      <kbd className="px-3 py-1 bg-helm-surface border border-helm-border rounded text-sm text-helm-text-muted font-mono">
        {shortcut}
      </kbd>
    </div>
  )
}
