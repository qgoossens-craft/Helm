import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Sparkles, Loader2, Check, Trash2 } from 'lucide-react'
import { useUIStore, useProjectsStore, useTasksStore } from '../store'
import type { ParsedProject } from '../types/global'

type Step = 'braindump' | 'parsing' | 'review' | 'creating'

export function KickoffWizard() {
  const navigate = useNavigate()
  const { isKickoffWizardOpen, closeKickoffWizard } = useUIStore()
  const { createProject, fetchProjects } = useProjectsStore()
  const { createTask } = useTasksStore()

  const [step, setStep] = useState<Step>('braindump')
  const [brainDump, setBrainDump] = useState('')
  const [parsedProject, setParsedProject] = useState<ParsedProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [editedName, setEditedName] = useState('')
  const [editedWhy, setEditedWhy] = useState('')
  const [editedDone, setEditedDone] = useState('')
  const [editedContext, setEditedContext] = useState<'work' | 'personal'>('personal')
  const [editedTasks, setEditedTasks] = useState<string[]>([])

  if (!isKickoffWizardOpen) return null

  const handleClose = () => {
    closeKickoffWizard()
    setStep('braindump')
    setBrainDump('')
    setParsedProject(null)
    setError(null)
  }

  const handleParse = async () => {
    if (!brainDump.trim()) return

    setStep('parsing')
    setError(null)

    try {
      const parsed = await window.api.copilot.parseProjectBrainDump(brainDump)
      setParsedProject(parsed)
      setEditedName(parsed.name)
      setEditedWhy(parsed.why)
      setEditedDone(parsed.doneDefinition)
      setEditedContext(parsed.context)
      setEditedTasks([...parsed.tasks])
      setStep('review')
    } catch (err) {
      setError((err as Error).message)
      setStep('braindump')
    }
  }

  const handleCreate = async () => {
    setStep('creating')
    setError(null)

    try {
      // Create the project
      const project = await createProject({
        name: editedName,
        why: editedWhy,
        done_definition: editedDone,
        status: 'active',
        context: editedContext
      })

      // Create the tasks
      for (let i = 0; i < editedTasks.length; i++) {
        if (editedTasks[i].trim()) {
          await createTask({
            project_id: project.id,
            parent_task_id: null,
            title: editedTasks[i],
            description: null,
            status: 'todo',
            order: i
          })
        }
      }

      // Refresh projects list
      await fetchProjects()

      // Close wizard and navigate to project
      handleClose()
      navigate(`/project/${project.id}`)
    } catch (err) {
      setError((err as Error).message)
      setStep('review')
    }
  }

  const handleRemoveTask = (index: number) => {
    setEditedTasks(editedTasks.filter((_, i) => i !== index))
  }

  const handleAddTask = () => {
    setEditedTasks([...editedTasks, ''])
  }

  const handleUpdateTask = (index: number, value: string) => {
    const newTasks = [...editedTasks]
    newTasks[index] = value
    setEditedTasks(newTasks)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop">
      <div className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-helm-border">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-helm-primary" />
            <h2 className="text-lg font-medium text-helm-text">New Project</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-helm-text-muted hover:text-helm-text rounded-lg hover:bg-helm-surface-elevated transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'braindump' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-helm-text font-medium mb-2">Brain dump your project idea</h3>
                <p className="text-sm text-helm-text-muted mb-4">
                  Just write everything you're thinking about this project. The AI will help extract a clear name, purpose, success criteria, and first tasks.
                </p>
              </div>

              <textarea
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                placeholder="Example: I want to build a personal website to showcase my portfolio. It needs to look professional and load fast. I should start by picking a tech stack, then design the layout, add my projects..."
                rows={8}
                autoFocus
                className="w-full px-4 py-3 bg-helm-bg border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors resize-none"
              />

              {error && (
                <div className="p-4 bg-helm-error/10 border border-helm-error/20 rounded-lg animate-slide-up">
                  <p className="text-sm text-helm-error">{error}</p>
                </div>
              )}
            </div>
          )}

          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
              <Loader2 size={32} className="text-helm-primary animate-spin mb-4" />
              <p className="text-helm-text-muted">Parsing your brain dump...</p>
              <p className="text-xs text-helm-text-muted mt-2">This may take a few seconds</p>
            </div>
          )}

          {step === 'review' && parsedProject && (
            <div className="space-y-6 animate-fade-in">
              <p className="text-sm text-helm-text-muted">
                Review and edit the extracted project details.
              </p>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-helm-text mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full px-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-helm-text focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
                />
              </div>

              {/* Why */}
              <div>
                <label className="block text-sm font-medium text-helm-text mb-2">
                  Why are you doing this?
                </label>
                <textarea
                  value={editedWhy}
                  onChange={(e) => setEditedWhy(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-helm-text focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors resize-none"
                />
              </div>

              {/* Done Definition */}
              <div>
                <label className="block text-sm font-medium text-helm-text mb-2">
                  What does "done" look like?
                </label>
                <textarea
                  value={editedDone}
                  onChange={(e) => setEditedDone(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-helm-text focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors resize-none"
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-helm-text mb-2">
                  Context
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditedContext('personal')}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      editedContext === 'personal'
                        ? 'bg-helm-primary text-white'
                        : 'bg-helm-bg text-helm-text-muted hover:text-helm-text border border-helm-border'
                    }`}
                  >
                    Personal
                  </button>
                  <button
                    onClick={() => setEditedContext('work')}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      editedContext === 'work'
                        ? 'bg-helm-primary text-white'
                        : 'bg-helm-bg text-helm-text-muted hover:text-helm-text border border-helm-border'
                    }`}
                  >
                    Work
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div>
                <label className="block text-sm font-medium text-helm-text mb-2">
                  First Tasks
                </label>
                <div className="space-y-2">
                  {editedTasks.map((task, index) => (
                    <div key={index} className="flex gap-2 animate-slide-up">
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => handleUpdateTask(index, e.target.value)}
                        className="flex-1 px-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-helm-text focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
                      />
                      <button
                        onClick={() => handleRemoveTask(index)}
                        className="p-2 text-helm-text-muted hover:text-helm-error hover:bg-helm-surface-elevated rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddTask}
                    className="w-full px-4 py-2 border border-dashed border-helm-border rounded-lg text-helm-text-muted hover:text-helm-text hover:border-helm-primary transition-colors text-sm"
                  >
                    + Add task
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-helm-error/10 border border-helm-error/20 rounded-lg animate-slide-up">
                  <p className="text-sm text-helm-error">{error}</p>
                </div>
              )}
            </div>
          )}

          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
              <Loader2 size={32} className="text-helm-primary animate-spin mb-4" />
              <p className="text-helm-text-muted">Creating your project...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-helm-border flex justify-between">
          {step === 'braindump' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!brainDump.trim()}
                className="px-6 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles size={16} />
                Parse with AI
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('braindump')}
                className="px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!editedName.trim()}
                className="px-6 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Check size={16} />
                Create Project
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
