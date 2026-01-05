import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, SkipForward, Sparkles, Loader2, PartyPopper } from 'lucide-react'
import { useProjectsStore, useTasksStore, useUIStore } from '../store'
import type { Task, Project } from '../types/global'

export function Focus() {
  const { projects, fetchProjects } = useProjectsStore()
  const { tasks, fetchTasksByProject, updateTask } = useTasksStore()
  const { openCopilot } = useUIStore()

  const [currentTask, setCurrentTask] = useState<Task | null>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBreakingDown, setIsBreakingDown] = useState(false)

  // Find the next task to work on
  useEffect(() => {
    const loadNextTask = async () => {
      setIsLoading(true)
      await fetchProjects()

      // Get active projects
      const activeProjects = projects.filter(p => p.status === 'active' && !p.archived_at)

      // Find a task to focus on
      for (const project of activeProjects) {
        await fetchTasksByProject(project.id)
        const projectTasks = tasks.filter(t => t.project_id === project.id)

        // First priority: in_progress tasks
        const inProgress = projectTasks.find(t => t.status === 'in_progress')
        if (inProgress) {
          setCurrentTask(inProgress)
          setCurrentProject(project)
          setIsLoading(false)
          return
        }

        // Second priority: first todo task
        const firstTodo = projectTasks.find(t => t.status === 'todo')
        if (firstTodo) {
          setCurrentTask(firstTodo)
          setCurrentProject(project)
          setIsLoading(false)
          return
        }
      }

      // No tasks found
      setCurrentTask(null)
      setCurrentProject(null)
      setIsLoading(false)
    }

    loadNextTask()
  }, [fetchProjects, fetchTasksByProject])

  const handleDone = async () => {
    if (!currentTask) return

    await updateTask(currentTask.id, { status: 'done' })

    // Refresh to get next task
    setIsLoading(true)
    await fetchProjects()
    if (currentProject) {
      await fetchTasksByProject(currentProject.id)
    }

    // Find next task
    const projectTasks = tasks.filter(t => t.project_id === currentProject?.id && t.id !== currentTask.id)
    const nextTask = projectTasks.find(t => t.status === 'in_progress') || projectTasks.find(t => t.status === 'todo')

    if (nextTask) {
      setCurrentTask(nextTask)
    } else {
      setCurrentTask(null)
      setCurrentProject(null)
    }
    setIsLoading(false)
  }

  const handleSkip = async () => {
    if (!currentTask || !currentProject) return

    // Mark current task as skipped (move to end of list) and find next
    await fetchTasksByProject(currentProject.id)

    const projectTasks = tasks.filter(t => t.project_id === currentProject.id && t.id !== currentTask.id)
    const nextTask = projectTasks.find(t => t.status === 'in_progress') || projectTasks.find(t => t.status === 'todo')

    if (nextTask) {
      setCurrentTask(nextTask)
    } else {
      // No other tasks, show current one again or show empty
      setCurrentTask(null)
    }
  }

  const handleBreakDown = async () => {
    if (!currentTask || !currentProject) return

    setIsBreakingDown(true)

    try {
      const subtasks = await window.api.copilot.suggestTaskBreakdown(
        currentTask.title,
        `Project: ${currentProject.name}. ${currentProject.why}`
      )

      // Create subtasks (we'll add them as new tasks for now)
      const { createTask } = useTasksStore.getState()
      for (let i = 0; i < subtasks.length; i++) {
        await createTask({
          project_id: currentProject.id,
          parent_task_id: currentTask.id,
          title: subtasks[i],
          description: null,
          status: 'todo',
          order: i
        })
      }

      // Mark original task as in progress since we're breaking it down
      await updateTask(currentTask.id, { status: 'in_progress' })

      // Refresh
      await fetchTasksByProject(currentProject.id)
    } catch (error) {
      console.error('Failed to break down task:', error)
    }

    setIsBreakingDown(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="text-helm-primary animate-spin" />
      </div>
    )
  }

  if (!currentTask || !currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <PartyPopper size={64} className="text-helm-primary mb-6 mx-auto" />
          <h1 className="text-2xl font-semibold text-helm-text mb-2">
            You're all caught up!
          </h1>
          <p className="text-helm-text-muted mb-8">
            No tasks waiting for your attention.
          </p>
          <Link
            to="/"
            className="px-6 py-3 bg-helm-surface hover:bg-helm-surface-elevated text-helm-text rounded-lg transition-colors inline-block"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-lg">
        {/* Project name */}
        <Link
          to={`/project/${currentProject.id}`}
          className="text-helm-text-muted hover:text-helm-primary transition-colors mb-2 inline-block"
        >
          {currentProject.name}
        </Link>
        <div className="w-16 h-px bg-helm-border mx-auto mb-8" />

        {/* Current task */}
        <h1 className="text-3xl font-semibold text-helm-text mb-8">
          {currentTask.title}
        </h1>

        {/* Why reminder */}
        {currentProject.why && (
          <p className="text-helm-text-muted mb-12">
            <span className="text-sm uppercase tracking-wider">Why this matters:</span>
            <br />
            <span className="italic">"{currentProject.why}"</span>
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleDone}
            className="flex items-center gap-2 px-6 py-3 bg-helm-success hover:brightness-110 text-white rounded-lg transition-all"
          >
            <Check size={20} />
            Done
          </button>
          <button
            onClick={handleSkip}
            className="flex items-center gap-2 px-6 py-3 bg-helm-surface hover:bg-helm-surface-elevated text-helm-text rounded-lg transition-colors"
          >
            <SkipForward size={20} />
            Skip for now
          </button>
          <button
            onClick={handleBreakDown}
            disabled={isBreakingDown}
            className="flex items-center gap-2 px-6 py-3 bg-helm-surface hover:bg-helm-surface-elevated text-helm-text rounded-lg transition-colors disabled:opacity-50"
          >
            {isBreakingDown ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Sparkles size={20} />
            )}
            Break it down
          </button>
        </div>

        {/* Jeeves help */}
        <div className="mt-12">
          <button
            onClick={() => openCopilot({ projectId: currentProject.id, taskId: currentTask.id })}
            className="text-sm text-helm-text-muted hover:text-helm-primary transition-colors"
          >
            Feeling stuck? Ask Jeeves for help
          </button>
        </div>
      </div>
    </div>
  )
}
