import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Home, Inbox, FolderKanban, Focus, Settings, Sparkles, Plus, ListTodo } from 'lucide-react'
import { useEffect } from 'react'
import { useProjectsStore, useUIStore } from '../store'

export function Layout() {
  const navigate = useNavigate()
  const { projects, fetchProjects } = useProjectsStore()
  const { openCopilot, openKickoffWizard } = useUIStore()

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Listen for keyboard shortcuts from Electron
  useEffect(() => {
    if (!window.api) return

    const unsubCopilot = window.api.onShortcut('shortcut:copilot', () => {
      openCopilot()
    })

    const unsubCapture = window.api.onShortcut('shortcut:quick-capture', () => {
      navigate('/inbox')
    })

    const unsubFocus = window.api.onShortcut('shortcut:focus-mode', () => {
      navigate('/focus')
    })

    return () => {
      unsubCopilot()
      unsubCapture()
      unsubFocus()
    }
  }, [navigate, openCopilot])

  // Filter active projects
  const activeProjects = projects.filter((p) => p.status !== 'abandoned' && !p.archived_at)

  return (
    <div className="flex h-screen bg-helm-bg">
      {/* Sidebar */}
      <aside className="w-60 border-r border-helm-border flex flex-col">
        {/* Drag region for window with logo before traffic lights */}
        <div className="h-12 drag-region flex items-center">
          <span className="text-lg font-semibold text-helm-text no-drag pl-4 pr-20">helm</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <NavItem to="/" icon={<Home size={18} />} label="Home" end />
          <NavItem to="/inbox" icon={<Inbox size={18} />} label="Inbox" />
          <NavItem to="/focus" icon={<Focus size={18} />} label="Focus" />
          <NavItem to="/todos" icon={<ListTodo size={18} />} label="Todos" />

          <div className="pt-4 pb-2 px-3 flex items-center justify-between">
            <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={openKickoffWizard}
              className="p-1 rounded hover:bg-helm-surface text-helm-text-muted hover:text-helm-text transition-colors"
              title="New Project"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Projects list */}
          {activeProjects.length > 0 ? (
            <div className="space-y-1">
              {activeProjects.map((project) => (
                <NavLink
                  key={project.id}
                  to={`/project/${project.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-helm-primary text-white'
                        : 'text-helm-text-muted hover:bg-helm-surface hover:text-helm-text'
                    }`
                  }
                >
                  <FolderKanban size={16} />
                  <span className="truncate">{project.name}</span>
                </NavLink>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-helm-text-muted">No projects yet</div>
          )}
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-helm-border">
          <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with drag region */}
        <div className="h-12 drag-region flex items-center justify-end px-4">
          <button
            className="no-drag flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-helm-surface text-sm text-helm-text-muted hover:text-helm-text transition-colors"
            onClick={() => openCopilot()}
          >
            <Sparkles size={16} />
            <span>Jeeves</span>
            <kbd className="text-xs text-helm-text-muted/60 px-1.5 py-0.5 rounded border border-helm-border">⌘K</kbd>
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
}

function NavItem({ to, icon, label, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-helm-primary text-white'
            : 'text-helm-text-muted hover:bg-helm-surface hover:text-helm-text'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
