import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, Inbox, FolderKanban, Focus, Settings, Plus, ListTodo, BarChart3 } from 'lucide-react'
import { useEffect, useCallback } from 'react'
import { useProjectsStore, useUIStore, useSettingsStore } from '../store'
import { QuickSwitcher } from './QuickSwitcher'
import { useDoubleTapCmd } from '../hooks/useDoubleTapCmd'
import { ObsidianBrowserModal } from './ObsidianBrowserModal'
import { CalendarWidget } from './CalendarWidget'
import { PROJECT_COLORS, PROJECT_ICONS } from '../lib/projectConstants'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projects, fetchProjects } = useProjectsStore()
  const { openCopilot, openKickoffWizard, openQuickSwitcher } = useUIStore()
  const { settings, fetchSettings } = useSettingsStore()

  // Get nav colors from settings
  const getNavColor = (navId: string) => {
    const colorKey = settings[`nav_${navId}_color` as keyof typeof settings] as string
    return colorKey ? PROJECT_COLORS[colorKey] : undefined
  }

  // Double-tap Cmd to open Quick Switcher
  const handleDoubleTapCmd = useCallback(() => {
    openQuickSwitcher()
  }, [openQuickSwitcher])
  useDoubleTapCmd(handleDoubleTapCmd)


  // Fetch projects and settings on mount
  useEffect(() => {
    fetchProjects()
    fetchSettings()
  }, [fetchProjects, fetchSettings])

  // Listen for keyboard shortcuts from Electron
  useEffect(() => {
    if (!window.api) return

    const unsubCopilot = window.api.onShortcut('shortcut:copilot', () => {
      // Check if we're on a project page and pass context
      const projectMatch = location.pathname.match(/^\/project\/([^/]+)/)
      if (projectMatch) {
        openCopilot({ projectId: projectMatch[1] })
      } else {
        openCopilot()
      }
    })

    const unsubCapture = window.api.onShortcut('shortcut:quick-capture', () => {
      navigate('/inbox')
    })

    const unsubFocus = window.api.onShortcut('shortcut:focus-mode', () => {
      navigate('/focus')
    })

    const unsubGlobalCapture = window.api.onShortcut('shortcut:global-capture', () => {
      navigate('/inbox')
    })

    return () => {
      unsubCopilot()
      unsubCapture()
      unsubFocus()
      unsubGlobalCapture()
    }
  }, [navigate, openCopilot, location.pathname])

  // Filter active projects
  const activeProjects = projects.filter((p) => p.status !== 'abandoned' && !p.archived_at)

  return (
    <div className="relative flex h-screen pt-10 pb-3 px-3 gap-3">
      {/* Top drag region for traffic lights area */}
      <div className="absolute top-0 left-0 right-0 h-10 drag-region" />
      {/* Sidebar */}
      <aside className="w-60 bg-helm-surface rounded-2xl flex flex-col overflow-hidden">
        {/* Header with branding */}
        <div className="h-12 drag-region flex items-center px-3">
          <span className="text-lg font-semibold text-helm-text">helm</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <NavItem to="/" icon={<Home size={18} />} label="Home" iconColor={getNavColor('home')} end />
          <NavItem to="/inbox" icon={<Inbox size={18} />} label="Inbox" iconColor={getNavColor('inbox')} />
          <NavItem to="/focus" icon={<Focus size={18} />} label="Focus" iconColor={getNavColor('focus')} />
          <NavItem to="/todos" icon={<ListTodo size={18} />} label="Todos" iconColor={getNavColor('todos')} />
          <NavItem to="/stats" icon={<BarChart3 size={18} />} label="Stats" iconColor={getNavColor('stats')} />

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
              {activeProjects.map((project) => {
                const IconComponent = PROJECT_ICONS[project.icon || 'folder'] || FolderKanban
                const projectColor = PROJECT_COLORS[project.color || 'orange'] || PROJECT_COLORS.orange
                return (
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
                    {({ isActive }) => (
                      <>
                        <IconComponent size={16} className="shrink-0" style={!isActive ? { color: projectColor } : undefined} />
                        <span className="truncate">{project.name}</span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-helm-text-muted">No projects yet</div>
          )}
        </nav>

        {/* Calendar Widget - Fixed at bottom */}
        <div className="border-t border-helm-border">
          <CalendarWidget />
        </div>

        {/* Settings link */}
        <div className="p-2 border-t border-helm-border">
          <NavLink
            to="/settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-helm-surface-elevated text-sm text-helm-text transition-colors"
          >
            <Settings size={16} />
            <span>Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Drag region overlay at top */}
        <div className="absolute top-0 left-0 right-0 h-10 drag-region z-10" />


        {/* Page content */}
        <div className="flex-1 overflow-hidden relative z-20">
          <Outlet />
        </div>
      </main>

      {/* Quick Switcher modal */}
      <QuickSwitcher />

      {/* Obsidian Browser modal */}
      <ObsidianBrowserModal />
    </div>
  )
}

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  iconColor?: string
  end?: boolean
}

function NavItem({ to, icon, label, iconColor, end }: NavItemProps) {
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
      {({ isActive }) => (
        <>
          <span style={!isActive && iconColor ? { color: iconColor } : undefined}>
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}
