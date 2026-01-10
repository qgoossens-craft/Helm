import { useState, useEffect, useMemo } from 'react'
import { X, Search, FileText, Check, Loader2, FolderOpen } from 'lucide-react'
import { useUIStore, useSettingsStore } from '../store'
import type { VaultFile } from '../types/global'

export function ObsidianBrowserModal() {
  const { isObsidianBrowserOpen, obsidianBrowserContext, closeObsidianBrowser } = useUIStore()
  const { settings } = useSettingsStore()

  const [files, setFiles] = useState<VaultFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load files when modal opens
  useEffect(() => {
    if (isObsidianBrowserOpen && settings.obsidian_vault_path) {
      loadFiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isObsidianBrowserOpen, settings.obsidian_vault_path])

  // Reset state when modal closes
  useEffect(() => {
    if (!isObsidianBrowserOpen) {
      setFiles([])
      setSelectedFiles(new Set())
      setSearchQuery('')
      setError(null)
    }
  }, [isObsidianBrowserOpen])

  const loadFiles = async () => {
    if (!settings.obsidian_vault_path) return

    setIsLoading(true)
    setError(null)

    try {
      const vaultFiles = await window.api.obsidian.listFiles(settings.obsidian_vault_path)
      setFiles(vaultFiles)
    } catch (err) {
      setError('Failed to load vault files')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files

    const query = searchQuery.toLowerCase()
    return files.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.relativePath.toLowerCase().includes(query)
    )
  }, [files, searchQuery])

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedFiles(new Set(filteredFiles.map(f => f.path)))
  }

  const deselectAll = () => {
    setSelectedFiles(new Set())
  }

  const handleImport = async () => {
    if (selectedFiles.size === 0 || !obsidianBrowserContext) return

    setIsImporting(true)

    try {
      const result = await window.api.obsidian.importFiles(
        Array.from(selectedFiles),
        obsidianBrowserContext.projectId,
        obsidianBrowserContext.taskId,
        obsidianBrowserContext.quickTodoId
      )

      if (result.failed > 0) {
        console.error('Some files failed to import:', result.errors)
      }

      closeObsidianBrowser()
    } catch (err) {
      setError('Failed to import files')
      console.error(err)
    } finally {
      setIsImporting(false)
    }
  }

  if (!isObsidianBrowserOpen) return null

  // Check if vault path is configured
  if (!settings.obsidian_vault_path) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
        <div className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-md p-6 modal-content">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-helm-text">Import from Obsidian</h2>
            <button
              onClick={closeObsidianBrowser}
              className="p-1 text-helm-text-muted hover:text-helm-text transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="text-center py-8">
            <FolderOpen size={48} className="mx-auto text-helm-text-muted mb-4" />
            <p className="text-helm-text mb-2">No vault configured</p>
            <p className="text-sm text-helm-text-muted">
              Set your Obsidian vault path in Settings first.
            </p>
          </div>

          <button
            onClick={closeObsidianBrowser}
            className="w-full px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors"
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
      <div className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-helm-border">
          <h2 className="text-lg font-medium text-helm-text">Import from Obsidian</h2>
          <button
            onClick={closeObsidianBrowser}
            className="p-1 text-helm-text-muted hover:text-helm-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-helm-border">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-helm-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-10 pr-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Selection controls */}
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-helm-text-muted">
              {selectedFiles.size} of {filteredFiles.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-helm-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-helm-text-muted">|</span>
              <button
                onClick={deselectAll}
                className="text-helm-text-muted hover:text-helm-text"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-helm-text-muted" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-helm-error">
              <p>{error}</p>
              <button
                onClick={loadFiles}
                className="mt-2 text-sm text-helm-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-helm-text-muted">
              {searchQuery ? 'No matching notes found' : 'No markdown files in vault'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => toggleFileSelection(file.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedFiles.has(file.path)
                      ? 'bg-helm-primary/10 border border-helm-primary'
                      : 'hover:bg-helm-bg border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    selectedFiles.has(file.path)
                      ? 'bg-helm-primary border-helm-primary text-white'
                      : 'border-helm-border'
                  }`}>
                    {selectedFiles.has(file.path) && <Check size={14} />}
                  </div>
                  <FileText size={16} className="text-helm-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-helm-text truncate">{file.name}</p>
                    <p className="text-xs text-helm-text-muted truncate">{file.relativePath}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-helm-border">
          <button
            onClick={closeObsidianBrowser}
            className="px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedFiles.size === 0 || isImporting}
            className="px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
