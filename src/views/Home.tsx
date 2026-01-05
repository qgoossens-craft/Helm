import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, ArrowRight } from 'lucide-react'
import { useProjectsStore, useTasksStore, useSettingsStore, useUIStore } from '../store'

export function Home() {
  const { projects, fetchProjects, isLoading: projectsLoading } = useProjectsStore()
  const { inboxTasks, fetchInbox } = useTasksStore()
  const { settings, fetchSettings } = useSettingsStore()
  const { openKickoffWizard } = useUIStore()

  useEffect(() => {
    fetchProjects()
    fetchInbox()
    fetchSettings()
  }, [fetchProjects, fetchInbox, fetchSettings])

  // Get current time for greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const userName = settings.name || 'there'

  // Get active projects
  const activeProjects = projects.filter((p) => p.status === 'active' && !p.archived_at)

  return (
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
            <span className="text-xl">📥</span>
            <span className="text-helm-text">
              Inbox: {inboxTasks.length} item{inboxTasks.length !== 1 ? 's' : ''} waiting to be sorted
            </span>
          </div>
          <Link to="/inbox" className="text-sm text-helm-primary hover:underline">
            Open Inbox
          </Link>
        </div>
      </div>

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
