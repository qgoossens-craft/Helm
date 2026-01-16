import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { List, LayoutGrid, Plus, Check, Trash2, FileText, Image, File, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Filter, RotateCcw, Sparkles, Calendar, BookOpen, Link2, ExternalLink, Video, Globe, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useProjectsStore, useTasksStore, useUIStore, useCalendarStore } from '../store'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { PriorityIndicator } from '../components/PriorityIndicator'
import { PrioritySelector } from '../components/PrioritySelector'
import { CategorySelector } from '../components/CategorySelector'
import type { Task, Document, Source, UrlMetadata } from '../types/global'
import type { Priority } from '../lib/priorityConstants'

type ViewMode = 'list' | 'kanban'
type TaskFilter = 'all' | 'active' | 'todo' | 'in_progress' | 'done' | 'deleted'

export function Project() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('active')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showDocuments, setShowDocuments] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Sources state
  const [sources, setSources] = useState<Source[]>([])
  const [showSources, setShowSources] = useState(true)
  const [isAddingSource, setIsAddingSource] = useState(false)
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [sourcePreview, setSourcePreview] = useState<{
    isOpen: boolean
    source: Source | null
  }>({ isOpen: false, source: null })
  const [preview, setPreview] = useState<{
    isOpen: boolean
    dataUrl: string | null
    fileName: string
    fileType: string
  }>({ isOpen: false, dataUrl: null, fileName: '', fileType: '' })

  const { projects, fetchProjects, deleteProject } = useProjectsStore()
  const navigate = useNavigate()
  const { tasks, deletedTasks, fetchTasksByProject, fetchDeletedTasks, createTask, updateTask, deleteTask, restoreTask, projectCategories, fetchCategoriesByProject, createCategory } = useTasksStore()
  const { openCopilot, openObsidianBrowser, isObsidianBrowserOpen } = useUIStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (id) {
      fetchTasksByProject(id)
    }
  }, [id, fetchTasksByProject])

  useEffect(() => {
    if (id) {
      fetchCategoriesByProject(id)
    }
  }, [id, fetchCategoriesByProject])

  // Fetch deleted tasks when filter is selected
  useEffect(() => {
    if (id && taskFilter === 'deleted') {
      fetchDeletedTasks(id)
    }
  }, [id, taskFilter, fetchDeletedTasks])

  // Auto-select task from URL query param
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setSelectedTask(task)
        // Clear the query param after selecting
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, tasks, setSearchParams])

  useEffect(() => {
    async function fetchDocuments() {
      if (!id) return
      try {
        const docs = await window.api.documents.getByProject(id)
        // Filter to only show project-level documents (not task-bound)
        setDocuments(docs.filter(d => d.task_id === null))
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
    }
    fetchDocuments()
    // Refetch when Obsidian browser closes (after import)
  }, [id, isObsidianBrowserOpen])

  // Fetch project sources
  useEffect(() => {
    async function fetchSources() {
      if (!id) return
      try {
        const projectSources = await window.api.sources.getByProject(id)
        setSources(projectSources)
      } catch (err) {
        console.error('Failed to fetch sources:', err)
      }
    }
    fetchSources()
  }, [id])

  const project = projects.find((p) => p.id === id)
  const projectTasks = tasks.filter((t) => t.project_id === id && !t.parent_task_id)

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'deleted') return deletedTasks
    if (taskFilter === 'all') {
      // Sort: active tasks first (todo, in_progress), then done
      return [...projectTasks].sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        return 0
      })
    }
    if (taskFilter === 'active') return projectTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
    return projectTasks.filter((t) => t.status === taskFilter)
  }, [projectTasks, deletedTasks, taskFilter])

  // Count tasks by status for filter badges
  const taskCounts = useMemo(() => ({
    all: projectTasks.length,
    active: projectTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length,
    todo: projectTasks.filter((t) => t.status === 'todo').length,
    in_progress: projectTasks.filter((t) => t.status === 'in_progress').length,
    done: projectTasks.filter((t) => t.status === 'done').length,
    deleted: deletedTasks.length
  }), [projectTasks, deletedTasks])

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !id) return

    try {
      const newTask = await createTask({
        project_id: id,
        parent_task_id: null,
        title: newTaskTitle.trim(),
        description: null,
        status: 'todo',
        order: projectTasks.length
      })
      setNewTaskTitle('')
      setIsAddingTask(false)
      setSelectedTask(newTask)
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  const handleToggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      await updateTask(task.id, { status: newStatus })
      // Refresh calendar to update dot count for this date
      if (task.due_date) {
        useCalendarStore.getState().fetchItems()
      }
    } catch (err) {
      console.error('Failed to toggle task status:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleRestoreTask = async (taskId: string) => {
    try {
      await restoreTask(taskId)
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await updateTask(taskId, { status })
    } catch (err) {
      console.error('Failed to update task status:', err)
    }
  }

  const handlePriorityChange = async (taskId: string, priority: Priority | null) => {
    try {
      await updateTask(taskId, { priority })
    } catch (err) {
      console.error('Failed to update task priority:', err)
    }
  }

  const handleSetDueDate = async (taskId: string, date: string | null) => {
    try {
      await updateTask(taskId, { due_date: date })
      // Refresh calendar to show/hide the dot for this date
      useCalendarStore.getState().fetchItems()
    } catch (err) {
      console.error('Failed to set due date:', err)
    }
  }

  const handleCategoryChange = async (taskId: string, category: string | null) => {
    await updateTask(taskId, { category })
    // Refresh categories to include any new ones
    if (id) {
      fetchCategoriesByProject(id)
    }
  }

  const handleUploadDocument = async () => {
    if (!id) return
    setIsUploading(true)
    try {
      const result = await window.api.documents.upload(null, id)
      if (result === null) return // User cancelled

      if (result.success) {
        const docs = await window.api.documents.getByProject(id)
        setDocuments(docs.filter(d => d.task_id === null))
        pollDocumentStatus(result.documentId)
      } else {
        console.error('Failed to upload document:', result.error)
      }
    } catch (err) {
      console.error('Failed to upload document:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const pollDocumentStatus = async (documentId: string) => {
    const checkStatus = async () => {
      try {
        const doc = await window.api.documents.getById(documentId)
        if (!doc) return

        setDocuments((prev) => prev.map((d) => (d.id === documentId ? doc : d)))

        if (doc.processing_status === 'processing' || doc.processing_status === 'pending') {
          setTimeout(checkStatus, 1000)
        } else if (doc.processing_status === 'failed') {
          console.error(`Failed to process "${doc.name}"`)
        }
      } catch (err) {
        console.error('Failed to check document status:', err)
      }
    }
    setTimeout(checkStatus, 500)
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await window.api.documents.delete(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  const canPreviewDoc = (fileType: string) => {
    return fileType.startsWith('image/') ||
           fileType === 'application/pdf' ||
           fileType.startsWith('text/') ||
           fileType === 'application/json'
  }

  const handlePreviewDocument = async (doc: Document) => {
    if (!canPreviewDoc(doc.file_type)) {
      handleOpenExternal(doc)
      return
    }

    try {
      const dataUrl = await window.api.documents.getDataUrl(doc.id)
      if (dataUrl) {
        setPreview({
          isOpen: true,
          dataUrl,
          fileName: doc.name,
          fileType: doc.file_type
        })
      } else {
        console.error('File not found')
      }
    } catch (err) {
      console.error('Failed to load preview:', err)
    }
  }

  const handleOpenExternal = async (doc: Document) => {
    try {
      const result = await window.api.documents.openExternal(doc.id)
      if (result && result !== '') {
        console.error(`Failed to open: ${result}`)
      }
    } catch (err) {
      console.error('Failed to open document:', err)
    }
  }

  const closePreview = () => {
    setPreview({ isOpen: false, dataUrl: null, fileName: '', fileType: '' })
  }

  // Source handlers
  const handleAddSource = async () => {
    if (!newSourceUrl.trim() || !id) return

    setIsFetchingMetadata(true)
    try {
      const metadata: UrlMetadata = await window.api.sources.fetchMetadata(newSourceUrl.trim())
      const newSource = await window.api.sources.create({
        project_id: id,
        task_id: null,
        quick_todo_id: null,
        url: newSourceUrl.trim(),
        title: metadata.title,
        description: metadata.description,
        favicon_url: metadata.favicon_url,
        source_type: metadata.source_type
      })
      setSources(prev => [...prev, newSource])
      setNewSourceUrl('')
      setIsAddingSource(false)
    } catch (err) {
      console.error('Failed to add source:', err)
    } finally {
      setIsFetchingMetadata(false)
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await window.api.sources.delete(sourceId)
      setSources(prev => prev.filter(s => s.id !== sourceId))
    } catch (err) {
      console.error('Failed to delete source:', err)
    }
  }

  const handleOpenSourceExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getSourceIcon = (source: Source) => {
    switch (source.source_type) {
      case 'video':
        return <Video size={14} className="text-red-500" />
      case 'article':
        return <FileText size={14} className="text-blue-500" />
      case 'document':
        return <FileText size={14} className="text-green-500" />
      default:
        return <Globe size={14} className="text-helm-text-muted" />
    }
  }

  const closeSourcePreview = () => {
    setSourcePreview({ isOpen: false, source: null })
  }

  // Handle ESC key to close preview modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (preview.isOpen) closePreview()
        if (sourcePreview.isOpen) closeSourcePreview()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [preview.isOpen, sourcePreview.isOpen])

  const handleDeleteProject = async () => {
    if (!id) return
    try {
      await deleteProject(id)
      navigate('/')
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  const getFileIcon = (fileType: string, fileName?: string) => {
    if (fileType.startsWith('image/')) return <Image size={14} />
    if (fileType.includes('pdf') || fileType.includes('document')) return <FileText size={14} />
    // Show Obsidian icon for markdown files
    if (fileType === 'text/markdown' || fileName?.endsWith('.md')) {
      return <BookOpen size={14} className="text-purple-500" />
    }
    return <File size={14} />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full bg-helm-surface rounded-2xl">
        <div className="text-center">
          <p className="text-helm-text-muted mb-4">Project not found</p>
          <Link to="/" className="text-helm-primary hover:underline">
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-3">
      {/* Main content - Task list or Kanban */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto p-6 bg-helm-surface rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-helm-text truncate">{project.name}</h1>

          {/* View toggle */}
          <div className="flex bg-helm-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-helm-primary text-white' : 'text-helm-text-muted hover:text-helm-text'}`}
              title="List view"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-helm-primary text-white' : 'text-helm-text-muted hover:text-helm-text'}`}
              title="Kanban view"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Task filter tabs */}
        <div className="flex items-center gap-1 mb-4">
          <Filter size={14} className="text-helm-text-muted mr-1" />
          {([
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'done', label: 'Done' },
            { value: 'deleted', label: 'Deleted' }
          ] as const).map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTaskFilter(filter.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                taskFilter === filter.value
                  ? 'bg-helm-primary text-white'
                  : 'bg-helm-primary/10 text-helm-text-muted hover:text-helm-text hover:bg-helm-primary/20'
              }`}
            >
              {filter.label}
              <span className={`ml-1.5 ${taskFilter === filter.value ? 'text-white/70' : 'text-helm-text-muted'}`}>
                {taskCounts[filter.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Add task input */}
        <div className="mb-4">
          {isAddingTask ? (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title..."
                autoFocus
                className="flex-1 px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false)
                  setNewTaskTitle('')
                }}
                className="px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="flex items-center gap-2 px-4 py-2 text-helm-text-muted hover:text-helm-text hover:bg-helm-surface rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add task...
            </button>
          )}
        </div>

        {/* Task list or Kanban */}
        {viewMode === 'list' ? (
          <ListView
            tasks={filteredTasks}
            onToggle={handleToggleStatus}
            onDelete={handleDeleteTask}
            onRestore={handleRestoreTask}
            onSelect={setSelectedTask}
            onPriorityChange={handlePriorityChange}
            onSetDueDate={handleSetDueDate}
            onCategoryChange={handleCategoryChange}
            projectCategories={projectCategories}
            isDeleted={taskFilter === 'deleted'}
            projectId={id!}
            onCreateCategory={createCategory}
          />
        ) : (
          <KanbanView
            tasks={filteredTasks}
            onUpdateStatus={handleUpdateTaskStatus}
            onDelete={handleDeleteTask}
            onSelect={setSelectedTask}
          />
        )}
      </div>

      {/* Task detail panel */}
      {selectedTask && id && (
        <TaskDetailPanel
          task={selectedTask}
          projectId={id}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Right panel - Project info (hidden when task selected) */}
      {!selectedTask && (
      <aside className="w-80 flex-shrink-0 bg-helm-surface rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Why */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Why
            </h3>
            <p className="text-sm text-helm-text">
              {project.why || 'No purpose defined yet'}
            </p>
          </div>

          {/* Done is */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Done is
            </h3>
            <p className="text-sm text-helm-text">
              {project.done_definition || 'No success criteria defined yet'}
            </p>
          </div>

          {/* Progress */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Progress
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-helm-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-helm-primary transition-all"
                  style={{
                    width: `${projectTasks.length > 0 ? Math.round((projectTasks.filter(t => t.status === 'done').length / projectTasks.length) * 100) : 0}%`
                  }}
                />
              </div>
              <span className="text-sm text-helm-text-muted">
                {projectTasks.filter(t => t.status === 'done').length}/{projectTasks.length}
              </span>
            </div>
          </div>

          {/* Documents */}
          <div>
            <button
              onClick={() => setShowDocuments(!showDocuments)}
              className="flex items-center gap-2 text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 hover:text-helm-text transition-colors"
            >
              {showDocuments ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Documents
              {documents.length > 0 && (
                <span className="text-helm-text-muted">({documents.length})</span>
              )}
            </button>

            {showDocuments && (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-2 p-2 bg-helm-bg border rounded-lg group ${
                      doc.processing_status === 'failed'
                        ? 'border-helm-error/50'
                        : doc.processing_status === 'processing' || doc.processing_status === 'pending'
                        ? 'border-helm-primary/50'
                        : 'border-helm-border'
                    }`}
                  >
                    <span className="text-helm-text-muted flex-shrink-0">{getFileIcon(doc.file_type, doc.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs text-helm-text truncate ${
                          doc.processing_status === 'completed' ? 'cursor-pointer hover:text-helm-primary' : ''
                        }`}
                        onClick={() => {
                          if (doc.processing_status === 'completed') {
                            handlePreviewDocument(doc)
                          }
                        }}
                        title={doc.processing_status === 'completed' ? 'Click to open' : doc.name}
                      >
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-helm-text-muted">{formatFileSize(doc.file_size)}</span>
                        {doc.processing_status === 'pending' && (
                          <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                            <Loader2 size={10} className="animate-spin" />
                          </span>
                        )}
                        {doc.processing_status === 'processing' && (
                          <span className="flex items-center gap-1 text-xs text-helm-primary">
                            <Loader2 size={10} className="animate-spin" />
                          </span>
                        )}
                        {doc.processing_status === 'completed' && (
                          <CheckCircle2 size={10} className="text-helm-success" />
                        )}
                        {doc.processing_status === 'failed' && (
                          <span title={doc.processing_error || undefined}>
                            <AlertCircle size={10} className="text-helm-error" />
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <button
                    onClick={handleUploadDocument}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs text-helm-text-muted hover:text-helm-text bg-helm-bg hover:bg-helm-surface-elevated border border-dashed border-helm-border rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        Add document
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => openObsidianBrowser({ projectId: id || null, taskId: null })}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-helm-text-muted hover:text-helm-text bg-helm-bg hover:bg-purple-500/10 border border-dashed border-helm-border hover:border-purple-500/50 rounded-lg transition-colors"
                    title="Import from Obsidian"
                  >
                    <BookOpen size={12} className="text-purple-500" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sources */}
          <div>
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 hover:text-helm-text transition-colors"
            >
              {showSources ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Sources
              {sources.length > 0 && (
                <span className="text-helm-text-muted">({sources.length})</span>
              )}
            </button>

            {showSources && (
              <div className="space-y-2">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center gap-2 p-2 bg-helm-bg border border-helm-border rounded-lg group cursor-pointer hover:border-helm-primary transition-colors"
                    onClick={() => setSourcePreview({ isOpen: true, source })}
                  >
                    {source.favicon_url ? (
                      <img src={source.favicon_url} alt="" className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <span className="flex-shrink-0">{getSourceIcon(source)}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-helm-text truncate">
                        {source.title}
                      </p>
                      <p className="text-xs text-helm-text-muted truncate">
                        {new URL(source.url).hostname}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenSourceExternal(source.url)
                      }}
                      className="p-1 text-helm-text-muted hover:text-helm-primary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Open in browser"
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSource(source.id)
                      }}
                      className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {isAddingSource ? (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      placeholder="https://..."
                      autoFocus
                      className="w-full px-3 py-2 text-xs bg-helm-bg border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddSource()
                        if (e.key === 'Escape') {
                          setIsAddingSource(false)
                          setNewSourceUrl('')
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddSource}
                        disabled={!newSourceUrl.trim() || isFetchingMetadata}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isFetchingMetadata ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          'Add'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingSource(false)
                          setNewSourceUrl('')
                        }}
                        className="px-3 py-1.5 text-xs text-helm-text-muted hover:text-helm-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingSource(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-helm-text-muted hover:text-helm-text bg-helm-bg hover:bg-helm-surface-elevated border border-dashed border-helm-border rounded-lg transition-colors"
                  >
                    <Link2 size={12} />
                    Add link
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Delete Project */}
          <div className="pt-4 border-t border-helm-border">
            {showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-sm text-helm-text">
                  Delete <strong>{project.name}</strong>? This will also delete all tasks and documents.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteProject}
                    className="flex-1 px-3 py-2 bg-helm-error hover:bg-helm-error/90 text-white text-sm rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-2 text-helm-text-muted hover:text-helm-text text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-helm-text-muted hover:text-helm-error transition-colors"
              >
                <Trash2 size={14} />
                Delete project
              </button>
            )}
          </div>

        </div>

        {/* Jeeves button at bottom */}
        <div className="p-2 border-t border-helm-border">
          <button
            onClick={() => openCopilot({ projectId: id })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-helm-surface-elevated text-sm text-helm-text transition-colors"
          >
            <Sparkles size={16} />
            <span>Ask Jeeves</span>
          </button>
        </div>
      </aside>
      )}

      {/* Document Preview Modal - Click backdrop or press Escape to close */}
      {preview.isOpen && preview.dataUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-8 cursor-pointer"
          onClick={closePreview}
        >
          <div className="max-w-full max-h-full flex flex-col items-center cursor-default" onClick={(e) => e.stopPropagation()}>
            {/* Image preview */}
            {preview.fileType.startsWith('image/') && (
              <img
                src={preview.dataUrl}
                alt={preview.fileName}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            )}

            {/* PDF preview */}
            {preview.fileType === 'application/pdf' && (
              <iframe
                src={preview.dataUrl}
                title={preview.fileName}
                className="w-[90vw] max-w-4xl h-[80vh] rounded-lg shadow-2xl bg-white"
              />
            )}

            {/* Markdown preview */}
            {preview.fileType === 'text/markdown' && (
              <div className="w-[90vw] max-w-4xl h-[80vh] overflow-auto bg-helm-surface text-helm-text p-6 rounded-lg shadow-2xl">
                <div className="prose prose-helm prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {new TextDecoder().decode(Uint8Array.from(atob(preview.dataUrl.split(',')[1]), c => c.charCodeAt(0)))}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Text/JSON preview (non-markdown) */}
            {(preview.fileType.startsWith('text/') && preview.fileType !== 'text/markdown') || preview.fileType === 'application/json' ? (
              <pre className="w-[90vw] max-w-4xl h-[80vh] overflow-auto bg-helm-surface text-helm-text p-6 rounded-lg shadow-2xl text-sm font-mono whitespace-pre-wrap">
                {new TextDecoder().decode(Uint8Array.from(atob(preview.dataUrl.split(',')[1]), c => c.charCodeAt(0)))}
              </pre>
            ) : null}

            <p className="text-center text-helm-text-muted text-sm mt-4 bg-helm-surface/80 px-3 py-1 rounded">{preview.fileName}</p>
          </div>
        </div>
      )}

      {/* Source Preview Modal */}
      {sourcePreview.isOpen && sourcePreview.source && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          onClick={closeSourcePreview}
        >
          <div
            className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with favicon and type */}
            <div className="flex items-start gap-3 mb-4">
              {sourcePreview.source.favicon_url ? (
                <img
                  src={sourcePreview.source.favicon_url}
                  alt=""
                  className="w-8 h-8 rounded flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-helm-bg flex items-center justify-center flex-shrink-0">
                  {getSourceIcon(sourcePreview.source)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-helm-text mb-1">
                  {sourcePreview.source.title}
                </h3>
                <p className="text-xs text-helm-text-muted truncate">
                  {new URL(sourcePreview.source.url).hostname}
                </p>
              </div>
              <span className="px-2 py-0.5 text-xs rounded bg-helm-bg text-helm-text-muted capitalize">
                {sourcePreview.source.source_type}
              </span>
            </div>

            {/* Description */}
            {sourcePreview.source.description && (
              <p className="text-sm text-helm-text-muted mb-4 line-clamp-3">
                {sourcePreview.source.description}
              </p>
            )}

            {/* URL */}
            <div className="p-3 bg-helm-bg rounded-lg mb-4">
              <p className="text-xs text-helm-text-muted break-all">
                {sourcePreview.source.url}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenSourceExternal(sourcePreview.source!.url)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors"
              >
                <ExternalLink size={16} />
                Open in Browser
              </button>
              <button
                onClick={closeSourcePreview}
                className="px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface CategoryGroupProps {
  category: string | null
  tasks: Task[]
  isCollapsed: boolean
  onToggleCollapse: () => void
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onSelect: (task: Task) => void
  onPriorityChange: (id: string, priority: Priority | null) => void
  onSetDueDate: (id: string, date: string | null) => void
  onCategoryChange: (id: string, category: string | null) => void
  projectCategories: string[]
  isDeleted: boolean
  // Drag and drop props
  onDragOver?: (e: React.DragEvent) => void
  onDragEnter?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  isDragOver?: boolean
  onTaskDragStart?: (e: React.DragEvent, taskId: string) => void
  onTaskDragEnd?: () => void
  draggingTaskId?: string | null
}

function CategoryGroup({ category, tasks, isCollapsed, onToggleCollapse, onToggle, onDelete, onRestore, onSelect, onPriorityChange, onSetDueDate, onCategoryChange, projectCategories, isDeleted, onDragOver, onDragEnter, onDragLeave, onDrop, isDragOver, onTaskDragStart, onTaskDragEnd, draggingTaskId }: CategoryGroupProps) {
  return (
    <div
      className={`space-y-1 rounded-lg transition-all ${
        isDragOver ? 'bg-helm-primary/10 ring-2 ring-helm-primary/30' : ''
      }`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        onClick={onToggleCollapse}
        className="flex items-center gap-2 text-sm font-medium text-helm-text-muted hover:text-helm-text transition-colors w-full py-1 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleCollapse()
          }
        }}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <Tag size={14} />
        <span className="truncate">{category || 'Uncategorized'}</span>
        <span className="text-xs">({tasks.length})</span>
      </div>

      {!isCollapsed && (
        <div className="space-y-1.5 pl-6">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              onRestore={onRestore}
              onSelect={onSelect}
              onPriorityChange={onPriorityChange}
              onSetDueDate={onSetDueDate}
              onCategoryChange={onCategoryChange}
              projectCategories={projectCategories}
              isDeleted={isDeleted}
              draggable={!isDeleted}
              onDragStart={onTaskDragStart}
              onDragEnd={onTaskDragEnd}
              isDragging={draggingTaskId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ListViewProps {
  tasks: Task[]
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onSelect: (task: Task) => void
  onPriorityChange: (id: string, priority: Priority | null) => void
  onSetDueDate: (id: string, date: string | null) => void
  onCategoryChange: (id: string, category: string | null) => void
  projectCategories: string[]
  isDeleted: boolean
  projectId: string
  onCreateCategory: (projectId: string, categoryName: string) => void
}

function ListView({ tasks, onToggle, onDelete, onRestore, onSelect, onPriorityChange, onSetDueDate, onCategoryChange, projectCategories, isDeleted, projectId, onCreateCategory }: ListViewProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    position: { x: number; y: number }
    mode: 'menu' | 'input'
    inputValue: string
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingTaskId(taskId)
  }

  const handleDragEnd = () => {
    setDraggingTaskId(null)
    setDragOverCategory(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, categoryKey: string) => {
    e.preventDefault()
    setDragOverCategory(categoryKey)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement
    const related = e.relatedTarget as HTMLElement
    if (!target.contains(related)) {
      setDragOverCategory(null)
    }
  }

  const handleCategoryDrop = async (e: React.DragEvent, category: string | null) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')

    if (taskId) {
      const task = tasks.find(t => t.id === taskId)
      if (task && task.category !== category) {
        await onCategoryChange(taskId, category)
      }
    }

    setDraggingTaskId(null)
    setDragOverCategory(null)
  }

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    const uncategorized: Task[] = []

    // Initialize groups for all known categories (including empty ones)
    projectCategories.forEach(category => {
      groups[category] = []
    })

    // Populate groups with tasks
    tasks.forEach(task => {
      if (task.category) {
        if (!groups[task.category]) groups[task.category] = []
        groups[task.category].push(task)
      } else {
        uncategorized.push(task)
      }
    })

    const sortedCategories = Object.keys(groups).sort()
    return { groups, uncategorized, sortedCategories }
  }, [tasks, projectCategories])

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    // Only trigger if not clicking on a task item
    const target = e.target as HTMLElement
    if (target.closest('[data-task-item]')) {
      return
    }

    e.preventDefault()

    // Calculate position with viewport boundary adjustment
    const menuWidth = 180
    const menuHeight = 40 // Approximate height for menu mode
    let x = e.clientX
    let y = e.clientY

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8
    }

    setContextMenu({
      visible: true,
      position: { x, y },
      mode: 'menu',
      inputValue: ''
    })
  }

  const handleNewCategoryClick = () => {
    setContextMenu(prev => prev ? { ...prev, mode: 'input' } : null)
    // Focus input after state update
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleCreateCategory = () => {
    if (contextMenu?.inputValue.trim()) {
      onCreateCategory(projectId, contextMenu.inputValue.trim())
      setContextMenu(null)
    }
  }

  const handleContextMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setContextMenu(null)
    } else if (e.key === 'Enter' && contextMenu?.mode === 'input') {
      handleCreateCategory()
    }
  }

  // Click-outside detection for context menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }

    if (contextMenu?.visible) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu?.visible])

  if (tasks.length === 0) {
    return (
      <div className="flex-1 space-y-2" onContextMenu={handleContextMenu}>
        <div className="text-center py-12 text-helm-text-muted">
          <p>{isDeleted ? 'No deleted tasks.' : 'No tasks yet. Add your first task above.'}</p>
        </div>

        {/* Context menu */}
        {contextMenu?.visible && (
          <div
            ref={contextMenuRef}
            className="fixed bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
            style={{ left: contextMenu.position.x, top: contextMenu.position.y }}
            onKeyDown={handleContextMenuKeyDown}
          >
            {contextMenu.mode === 'menu' ? (
              <button
                onClick={handleNewCategoryClick}
                className="w-full px-3 py-2 text-left text-sm text-helm-text hover:bg-helm-bg transition-colors flex items-center gap-2"
              >
                <Plus size={14} className="text-helm-primary" />
                New Category
              </button>
            ) : (
              <div className="px-3 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={contextMenu.inputValue}
                  onChange={(e) => setContextMenu(prev => prev ? { ...prev, inputValue: e.target.value } : null)}
                  onKeyDown={handleContextMenuKeyDown}
                  placeholder="Category name..."
                  className="w-full px-2 py-1.5 text-sm bg-helm-bg border border-helm-border rounded text-helm-text placeholder-helm-text-muted focus:outline-none focus:border-helm-primary"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2" onContextMenu={handleContextMenu}>
      {/* Categorized tasks */}
      {groupedTasks.sortedCategories.map(category => (
        <CategoryGroup
          key={category}
          category={category}
          tasks={groupedTasks.groups[category]}
          isCollapsed={collapsedCategories.has(category)}
          onToggleCollapse={() => toggleCategory(category)}
          onToggle={onToggle}
          onDelete={onDelete}
          onRestore={onRestore}
          onSelect={onSelect}
          onPriorityChange={onPriorityChange}
          onSetDueDate={onSetDueDate}
          onCategoryChange={onCategoryChange}
          projectCategories={projectCategories}
          isDeleted={isDeleted}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, category)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleCategoryDrop(e, category)}
          isDragOver={dragOverCategory === category}
          onTaskDragStart={handleDragStart}
          onTaskDragEnd={handleDragEnd}
          draggingTaskId={draggingTaskId}
        />
      ))}

      {/* Uncategorized tasks */}
      {groupedTasks.uncategorized.length > 0 && (
        <CategoryGroup
          category={null}
          tasks={groupedTasks.uncategorized}
          isCollapsed={collapsedCategories.has('__uncategorized__')}
          onToggleCollapse={() => toggleCategory('__uncategorized__')}
          onToggle={onToggle}
          onDelete={onDelete}
          onRestore={onRestore}
          onSelect={onSelect}
          onPriorityChange={onPriorityChange}
          onSetDueDate={onSetDueDate}
          onCategoryChange={onCategoryChange}
          projectCategories={projectCategories}
          isDeleted={isDeleted}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, 'uncategorized')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleCategoryDrop(e, null)}
          isDragOver={dragOverCategory === 'uncategorized'}
          onTaskDragStart={handleDragStart}
          onTaskDragEnd={handleDragEnd}
          draggingTaskId={draggingTaskId}
        />
      )}

      {/* Context menu */}
      {contextMenu?.visible && (
        <div
          ref={contextMenuRef}
          className="fixed bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{ left: contextMenu.position.x, top: contextMenu.position.y }}
          onKeyDown={handleContextMenuKeyDown}
        >
          {contextMenu.mode === 'menu' ? (
            <button
              onClick={handleNewCategoryClick}
              className="w-full px-3 py-2 text-left text-sm text-helm-text hover:bg-helm-bg transition-colors flex items-center gap-2"
            >
              <Plus size={14} className="text-helm-primary" />
              New Category
            </button>
          ) : (
            <div className="px-3 py-2">
              <input
                ref={inputRef}
                type="text"
                value={contextMenu.inputValue}
                onChange={(e) => setContextMenu(prev => prev ? { ...prev, inputValue: e.target.value } : null)}
                onKeyDown={handleContextMenuKeyDown}
                placeholder="Category name..."
                className="w-full px-2 py-1.5 text-sm bg-helm-bg border border-helm-border rounded text-helm-text placeholder-helm-text-muted focus:outline-none focus:border-helm-primary"
                autoFocus
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface TaskRowProps {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onSelect: (task: Task) => void
  onPriorityChange: (id: string, priority: Priority | null) => void
  onSetDueDate: (id: string, date: string | null) => void
  onCategoryChange: (id: string, category: string | null) => void
  projectCategories: string[]
  isDeleted: boolean
  // Drag props
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, taskId: string) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

function TaskRow({ task, onToggle, onDelete, onRestore, onSelect, onPriorityChange, onSetDueDate, onCategoryChange, projectCategories, isDeleted, draggable, onDragStart, onDragEnd, isDragging }: TaskRowProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (task.status !== 'done') {
      // Completing: show animation first
      setIsCompleting(true)
      setTimeout(() => {
        onToggle(task)
        setIsCompleting(false)
      }, 500)
    } else {
      // Uncompleting: just toggle immediately
      onToggle(task)
    }
  }

  const formatDueDate = (dateStr: string | null): string => {
    if (!dateStr) return ''

    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Reset time for comparison
    today.setHours(0, 0, 0, 0)
    tomorrow.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)

    if (date.getTime() === today.getTime()) return 'Today'
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'

    // Check if within this week
    const dayDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (dayDiff > 0 && dayDiff < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())

  return (
    <div
      data-task-item
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => !isDeleted && !isCompleting && onSelect(task)}
      className={`grid grid-cols-[auto_auto_1fr_auto_5rem] items-center gap-2 px-3 py-2.5 bg-helm-surface border rounded-lg group animate-slide-up transition-colors relative z-0 hover:z-10 ${
        isDeleted ? 'border-helm-border/50 opacity-60' : isOverdue ? 'border-helm-error/50 cursor-pointer hover:border-helm-primary' : 'border-helm-border cursor-pointer hover:border-helm-primary'
      } ${isCompleting ? 'animate-complete-out' : ''} ${isDragging ? 'opacity-50' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* Column 1: Checkbox */}
      <div className="w-5">
        {!isDeleted && (
          <button
            onClick={handleToggle}
            disabled={isCompleting}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              task.status === 'done' || isCompleting
                ? 'bg-helm-success border-helm-success text-white'
                : 'border-helm-border hover:border-helm-primary'
            }`}
          >
            {(task.status === 'done' || isCompleting) && (
              <Check size={12} className={isCompleting ? 'animate-check-pop' : ''} />
            )}
          </button>
        )}
      </div>

      {/* Column 2: Priority (fixed width to maintain alignment when empty) */}
      <div className="w-2.5">
        <PriorityIndicator priority={task.priority} />
      </div>

      {/* Column 3: Title (flexible) */}
      <span className={`text-sm truncate ${task.status === 'done' || isDeleted || isCompleting ? 'text-helm-text-muted line-through' : 'text-helm-text'}`}>
        {task.title}
      </span>

      {/* Column 4: Status + Due date (auto width) */}
      <div className="flex items-center gap-2 justify-end">
        {!isDeleted && task.status === 'in_progress' && !isCompleting && (
          <span className="text-xs px-2 py-0.5 rounded bg-helm-primary/20 text-helm-primary whitespace-nowrap">
            In Progress
          </span>
        )}
        {!isDeleted && task.due_date && task.status !== 'done' && !isCompleting && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs group-hover:hidden whitespace-nowrap ${
            isOverdue ? 'text-helm-error bg-helm-error/10' : 'text-helm-text-muted bg-helm-bg'
          }`}>
            <Calendar size={12} />
            {formatDueDate(task.due_date)}
          </div>
        )}
      </div>

      {/* Column 5: Category (fixed width for alignment) */}
      <div className="text-right">
        {task.category && (
          <span className="text-xs px-2 py-0.5 rounded bg-helm-primary/10 text-helm-primary inline-block">
            {task.category}
          </span>
        )}
      </div>

      {/* Hover actions - absolutely positioned overlay */}
      {!isDeleted && !isCompleting && (
        <div
          className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-helm-surface pl-2"
          onClick={(e) => e.stopPropagation()}
        >
          {task.status !== 'done' && (
            <>
              <PrioritySelector priority={task.priority} onPriorityChange={(p) => onPriorityChange(task.id, p)} />
              <CategorySelector
                category={task.category}
                projectCategories={projectCategories}
                onCategoryChange={(category) => onCategoryChange(task.id, category)}
              />
              {/* Due date picker */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDatePicker(!showDatePicker)
                  }}
                  className={`p-1 rounded transition-colors hover:bg-helm-surface-elevated ${
                    isOverdue ? 'text-helm-error' : 'text-helm-primary'
                  }`}
                  title={task.due_date ? `Due: ${formatDueDate(task.due_date)}` : 'Set due date'}
                >
                  <Calendar size={14} />
                </button>

                {showDatePicker && (
                  <div className="absolute right-0 top-full mt-1 bg-helm-surface border border-helm-border rounded-lg shadow-lg p-2 z-50">
                    <input
                      type="date"
                      value={task.due_date || ''}
                      onChange={(e) => {
                        onSetDueDate(task.id, e.target.value || null)
                        setShowDatePicker(false)
                      }}
                      className="bg-helm-bg border border-helm-border rounded px-2 py-1 text-sm text-helm-text"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {task.due_date && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetDueDate(task.id, null)
                          setShowDatePicker(false)
                        }}
                        className="block w-full mt-1 text-xs text-helm-text-muted hover:text-helm-error"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="p-1 text-helm-primary hover:text-helm-error transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {isDeleted && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRestore(task.id)
          }}
          className="p-1.5 text-helm-text-muted hover:text-helm-success opacity-0 group-hover:opacity-100 transition-all"
          title="Restore"
        >
          <RotateCcw size={16} />
        </button>
      )}
    </div>
  )
}

interface KanbanViewProps {
  tasks: Task[]
  onUpdateStatus: (id: string, status: Task['status']) => void
  onDelete: (id: string) => void
  onSelect: (task: Task) => void
}

function KanbanView({ tasks, onUpdateStatus, onDelete, onSelect }: KanbanViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const columns: { id: Task['status']; title: string }[] = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'done', title: 'Done' }
  ]

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
    setDraggingId(taskId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) {
      onUpdateStatus(taskId, status)
    }
    setDraggingId(null)
  }

  return (
    <div className="flex-1 flex gap-4 pb-4">
      {columns.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.id)
        return (
          <div
            key={column.id}
            className="flex-1 min-w-0 bg-helm-surface rounded-lg p-4 flex flex-col border-2 border-helm-primary/30"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-helm-text">{column.title}</h3>
              <span className="text-xs font-medium bg-helm-primary/10 text-helm-primary px-2 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2 flex-1 min-h-32">
              {columnTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-helm-primary/5 flex items-center justify-center mb-2">
                    <Plus size={18} className="text-helm-primary/40" />
                  </div>
                  <p className="text-sm text-helm-text-muted">No tasks yet</p>
                  <p className="text-xs text-helm-text-muted/60 mt-1">Drag a task here</p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isDragging={draggingId === task.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDelete={onDelete}
                    onSelect={onSelect}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KanbanCardProps {
  task: Task
  isDragging: boolean
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragEnd: () => void
  onDelete: (id: string) => void
  onSelect: (task: Task) => void
}

function KanbanCard({ task, isDragging, onDragStart, onDragEnd, onDelete, onSelect }: KanbanCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(task)}
      className={`p-3 bg-helm-bg border border-helm-border rounded-lg cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md hover:border-l-2 hover:border-l-helm-primary transition-all ${isDragging ? 'opacity-0' : ''}`}
    >
      <div className="flex items-center gap-2">
        <PriorityIndicator priority={task.priority} />
        <p className="text-sm text-helm-text flex-1">{task.title}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-helm-text-muted">
          {new Date(task.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
