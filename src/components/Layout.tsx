import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Inbox, FolderKanban, Focus, Settings, Sparkles, Plus, ListTodo,
  Briefcase, Rocket, Target, Star, Heart, Code, Book, Music, Camera,
  Palette, Gamepad2, GraduationCap, Plane, ShoppingBag, type LucideIcon
} from 'lucide-react'
import { useEffect, useCallback } from 'react'
import { useProjectsStore, useUIStore } from '../store'
import { QuickSwitcher, useDoubleTapCmd } from './QuickSwitcher'

// Project color palette
export const PROJECT_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
}

// Project icon map
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  folder: FolderKanban,
  briefcase: Briefcase,
  rocket: Rocket,
  target: Target,
  star: Star,
  heart: Heart,
  code: Code,
  book: Book,
  music: Music,
  camera: Camera,
  palette: Palette,
  gamepad: Gamepad2,
  'graduation-cap': GraduationCap,
  home: Home,
  plane: Plane,
  'shopping-bag': ShoppingBag,
}

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projects, fetchProjects } = useProjectsStore()
  const { openCopilot, openKickoffWizard, openQuickSwitcher } = useUIStore()

  // Double-tap Cmd to open Quick Switcher
  const handleDoubleTapCmd = useCallback(() => {
    openQuickSwitcher()
  }, [openQuickSwitcher])
  useDoubleTapCmd(handleDoubleTapCmd)

  // Check if we're on a project page (for right panel border)
  const isProjectPage = location.pathname.startsWith('/project/')

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

    const unsubGlobalCapture = window.api.onShortcut('shortcut:global-capture', () => {
      navigate('/inbox')
    })

    return () => {
      unsubCopilot()
      unsubCapture()
      unsubFocus()
      unsubGlobalCapture()
    }
  }, [navigate, openCopilot])

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
                          ? 'bg-helm-surface-elevated text-helm-text'
                          : 'text-helm-text-muted hover:bg-helm-surface hover:text-helm-text'
                      }`
                    }
                  >
                    <IconComponent size={16} className="shrink-0" style={{ color: projectColor }} />
                    <span className="truncate">{project.name}</span>
                  </NavLink>
                )
              })}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-helm-text-muted">No projects yet</div>
          )}
        </nav>

        {/* Bottom section */}
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

        {/* Jeeves button - positioned at top right (hidden on project pages where it's in the right panel) */}
        {!isProjectPage && (
          <div className="absolute top-2 right-2 z-20">
            <button
              className="no-drag flex items-center gap-2 px-3 py-1.5 rounded-lg bg-helm-surface/80 hover:bg-helm-surface-elevated text-sm text-helm-text transition-colors backdrop-blur-sm"
              onClick={() => openCopilot()}
            >
              <Sparkles size={16} />
              <span>Jeeves</span>
              <kbd className="text-xs text-helm-text-muted px-1.5 py-0.5 rounded border border-helm-border">⌘</kbd>
              <kbd className="text-xs text-helm-text-muted px-1.5 py-0.5 rounded border border-helm-border">K</kbd>
            </button>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>

      {/* Quick Switcher modal */}
      <QuickSwitcher />
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
