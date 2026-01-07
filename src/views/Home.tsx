import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, ArrowRight, Inbox, AlertCircle, Bell, Check, ListTodo } from 'lucide-react'
import { useProjectsStore, useTasksStore, useSettingsStore, useUIStore, useQuickTodosStore } from '../store'
import type { QuickTodo } from '../types/global'

export function Home() {
  const { projects, fetchProjects, isLoading: projectsLoading } = useProjectsStore()
  const { inboxTasks, fetchInbox } = useTasksStore()
  const { settings, fetchSettings } = useSettingsStore()
  const { openKickoffWizard } = useUIStore()
  const { todos, overdueTodos, dueTodayTodos, fetchAll, fetchOverdue, fetchDueToday, toggleComplete } = useQuickTodosStore()

  useEffect(() => {
    fetchProjects()
    fetchInbox()
    fetchSettings()
    fetchAll()
    fetchOverdue()
    fetchDueToday()
  }, [fetchProjects, fetchInbox, fetchSettings, fetchAll, fetchOverdue, fetchDueToday])

  // Get current time for greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const userName = settings.name || 'there'

  // Get active projects
  const activeProjects = projects.filter((p) => p.status === 'active' && !p.archived_at)

  // Get recent incomplete todos from each list (max 3 each)
  const personalTodos = todos.filter((t) => t.list === 'personal' && !t.completed).slice(0, 3)
  const workTodos = todos.filter((t) => t.list === 'work' && !t.completed).slice(0, 3)

  return (
    <div className="h-full overflow-auto p-6 bg-helm-surface rounded-2xl">
      <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-helm-text mb-2">
        {greeting}, {userName}.
      </h1>
      <p className="text-helm-text-muted mb-8">
        {activeProjects.length > 0 ? "Here's where you left off." : 'Ready to start something new?'}
      </p>

      {/* Project status cards */}
      <div className="space-y-4">
        {projectsLoading ? (
          <div className="p-6 rounded-xl bg-helm-surface border border-helm-border">
            <p className="text-helm-text-muted text-center py-8">Loading projects...</p>
          </div>
        ) : activeProjects.length > 0 ? (
          activeProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))
        ) : (
          <div className="p-6 rounded-xl bg-helm-surface border border-helm-border">
            <p className="text-helm-text-muted text-center py-8">
              No active projects yet. Create your first project to get started.
            </p>
            <div className="flex justify-center">
              <button
                onClick={openKickoffWizard}
                className="px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors"
              >
                Create Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inbox summary */}
      <div className="mt-6 p-4 rounded-xl bg-helm-surface border border-helm-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox size={20} className="text-helm-text-muted" />
            <span className="text-helm-text">
              Inbox: {inboxTasks.length} item{inboxTasks.length !== 1 ? 's' : ''} waiting to be sorted
            </span>
          </div>
          <Link to="/inbox" className="text-sm text-helm-primary hover:underline">
            Open Inbox
          </Link>
        </div>
      </div>

      {/* Overdue todos */}
      {overdueTodos.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-helm-surface border border-helm-error/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-helm-error" />
              <span className="text-sm font-medium text-helm-error">Overdue</span>
            </div>
            <Link to="/todos" className="text-xs text-helm-text-muted hover:text-helm-text">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {overdueTodos.map((todo) => (
              <QuickTodoItem key={todo.id} todo={todo} onToggle={() => toggleComplete(todo.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Due today todos */}
      {dueTodayTodos.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-helm-surface border border-helm-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-helm-primary" />
              <span className="text-sm font-medium text-helm-text">Due Today</span>
            </div>
            <Link to="/todos" className="text-xs text-helm-text-muted hover:text-helm-text">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {dueTodayTodos.map((todo) => (
              <QuickTodoItem key={todo.id} todo={todo} onToggle={() => toggleComplete(todo.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Todos preview */}
      {(personalTodos.length > 0 || workTodos.length > 0) && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {/* Personal list */}
          <div className="p-4 rounded-xl bg-helm-surface border border-helm-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListTodo size={16} className="text-helm-primary" />
                <span className="text-sm font-medium text-helm-primary">Personal</span>
              </div>
              <Link to="/todos" className="text-xs text-helm-text-muted hover:text-helm-text">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {personalTodos.length > 0 ? (
                personalTodos.map((todo) => (
                  <QuickTodoItem key={todo.id} todo={todo} onToggle={() => toggleComplete(todo.id)} showList={false} />
                ))
              ) : (
                <p className="text-xs text-helm-text-muted">No personal todos</p>
              )}
            </div>
          </div>

          {/* Work list */}
          <div className="p-4 rounded-xl bg-helm-surface border border-helm-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListTodo size={16} className="text-helm-primary" />
                <span className="text-sm font-medium text-helm-primary">Work</span>
              </div>
              <Link to="/todos" className="text-xs text-helm-text-muted hover:text-helm-text">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {workTodos.length > 0 ? (
                workTodos.map((todo) => (
                  <QuickTodoItem key={todo.id} todo={todo} onToggle={() => toggleComplete(todo.id)} showList={false} />
                ))
              ) : (
                <p className="text-xs text-helm-text-muted">No work todos</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Focus mode CTA */}
      <div className="mt-8 flex justify-center">
        <Link
          to="/focus"
          className="px-6 py-3 bg-helm-surface-elevated hover:bg-helm-border text-helm-text rounded-lg transition-colors"
        >
          Enter Focus Mode
        </Link>
      </div>
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: {
    id: string
    name: string
    status: string
    context: string
    updated_at: string
  }
}

function ProjectCard({ project }: ProjectCardProps) {
  const { tasks, fetchTasksByProject } = useTasksStore()

  useEffect(() => {
    fetchTasksByProject(project.id)
  }, [project.id, fetchTasksByProject])

  const projectTasks = tasks.filter((t) => t.project_id === project.id)
  const completedTasks = projectTasks.filter((t) => t.status === 'done')
  const progress = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0

  return (
    <Link
      to={`/project/${project.id}`}
      className="block p-6 rounded-xl bg-helm-surface border border-helm-border hover:border-helm-primary transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <FolderKanban size={20} className="text-helm-primary" />
          <h3 className="font-medium text-helm-text">{project.name}</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-helm-surface-elevated text-helm-text-muted">
          {project.context}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-helm-surface-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-helm-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-helm-text-muted">
          {completedTasks.length}/{projectTasks.length} tasks
        </span>
        <ArrowRight
          size={16}
          className="text-helm-text-muted group-hover:text-helm-primary transition-colors"
        />
      </div>
    </Link>
  )
}

interface QuickTodoItemProps {
  todo: QuickTodo
  onToggle: () => void
  showList?: boolean
}

function QuickTodoItem({ todo, onToggle, showList = true }: QuickTodoItemProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-helm-bg transition-colors group">
      <button
        onClick={onToggle}
        className="w-4 h-4 rounded border border-helm-border hover:border-helm-primary flex items-center justify-center transition-colors"
      >
        {todo.completed && <Check size={10} className="text-helm-success" />}
      </button>
      <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-helm-text-muted' : 'text-helm-text'}`}>
        {todo.title}
      </span>
      {showList && <span className="text-xs text-helm-text-muted capitalize">{todo.list}</span>}
    </div>
  )
}
