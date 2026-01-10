import { useEffect, useState } from 'react'
import { BarChart3, Flame, Trophy, TrendingUp, CheckCircle2, ListTodo, FolderKanban, User, Briefcase, Wrench, Calendar, Zap } from 'lucide-react'
import type { CompletionStats } from '../types/global'

export function Stats() {
  const [stats, setStats] = useState<CompletionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      try {
        const data = await window.api.stats.getCompletionStats()
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="h-full bg-helm-surface rounded-2xl flex items-center justify-center">
        <div className="text-helm-text-muted">Loading stats...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="h-full bg-helm-surface rounded-2xl flex items-center justify-center">
        <div className="text-helm-text-muted">Failed to load stats</div>
      </div>
    )
  }

  const totalToday = stats.tasks.today + stats.todos.today
  const totalWeek = stats.tasks.week + stats.todos.week
  const totalMonth = stats.tasks.month + stats.todos.month
  const totalAllTime = stats.tasks.allTime + stats.todos.allTime

  // Find max value for the weekly chart
  const maxDayValue = Math.max(...stats.weeklyTrend.map(d => d.tasks + d.todos), 1)

  return (
    <div className="h-full overflow-auto p-6 bg-helm-surface rounded-2xl">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BarChart3 size={28} className="text-helm-primary" />
          <h1 className="text-2xl font-semibold text-helm-text">Stats</h1>
        </div>

        {/* Today's Hero Section */}
        <div className="bg-gradient-to-br from-helm-primary/20 to-helm-primary/5 border border-helm-primary/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-helm-primary" />
            <span className="text-sm font-medium text-helm-primary uppercase tracking-wider">Today</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-6xl font-bold text-helm-text">{totalToday}</span>
            <span className="text-xl text-helm-text-muted">items completed</span>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-helm-success" />
              <span className="text-helm-text-muted">{stats.tasks.today} tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <ListTodo size={14} className="text-helm-primary" />
              <span className="text-helm-text-muted">{stats.todos.today} todos</span>
            </div>
          </div>
        </div>

        {/* Streak & Best Day */}
        <div className="grid grid-cols-2 gap-4">
          {/* Current Streak */}
          <div className="bg-helm-surface-elevated border border-helm-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={18} className={stats.streak.current > 0 ? 'text-orange-500' : 'text-helm-text-muted'} />
              <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">Current Streak</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${stats.streak.current > 0 ? 'text-orange-500' : 'text-helm-text-muted'}`}>
                {stats.streak.current}
              </span>
              <span className="text-helm-text-muted">days</span>
            </div>
            {stats.streak.longest > 0 && (
              <p className="text-xs text-helm-text-muted mt-2">
                Best: {stats.streak.longest} days
              </p>
            )}
          </div>

          {/* Best Day */}
          <div className="bg-helm-surface-elevated border border-helm-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-yellow-500" />
              <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">Best Day Ever</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-yellow-500">{stats.bestDay.count}</span>
              <span className="text-helm-text-muted">items</span>
            </div>
            {stats.bestDay.date && (
              <p className="text-xs text-helm-text-muted mt-2">
                {new Date(stats.bestDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Weekly Trend Chart */}
        <div className="bg-helm-surface-elevated border border-helm-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-helm-primary" />
            <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">This Week</span>
            <span className="ml-auto text-2xl font-bold text-helm-text">{totalWeek}</span>
          </div>
          <div className="flex items-end justify-between gap-2 h-32">
            {stats.weeklyTrend.map((day, i) => {
              const dayTotal = day.tasks + day.todos
              const height = maxDayValue > 0 ? (dayTotal / maxDayValue) * 100 : 0
              const isToday = i === stats.weeklyTrend.length - 1

              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-24 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        isToday ? 'bg-helm-primary' : 'bg-helm-primary/40'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${dayTotal} items`}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? 'text-helm-primary font-medium' : 'text-helm-text-muted'}`}>
                    {day.day}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Time Period Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<Calendar size={16} />}
            label="This Week"
            value={totalWeek}
            breakdown={`${stats.tasks.week} tasks, ${stats.todos.week} todos`}
          />
          <StatCard
            icon={<Calendar size={16} />}
            label="This Month"
            value={totalMonth}
            breakdown={`${stats.tasks.month} tasks, ${stats.todos.month} todos`}
          />
          <StatCard
            icon={<Trophy size={16} />}
            label="All Time"
            value={totalAllTime}
            breakdown={`${stats.tasks.allTime} tasks, ${stats.todos.allTime} todos`}
            highlight
          />
        </div>

        {/* Breakdown by Type */}
        <div className="grid grid-cols-2 gap-4">
          {/* Tasks Breakdown */}
          <div className="bg-helm-surface-elevated border border-helm-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban size={18} className="text-helm-success" />
              <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">Project Tasks</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-helm-text-muted">Completed</span>
                <span className="text-2xl font-bold text-helm-text">{stats.tasks.allTime}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-helm-text-muted">Projects done</span>
                <span className="text-2xl font-bold text-helm-text">{stats.projects.completed}</span>
              </div>
            </div>
          </div>

          {/* Todos Breakdown */}
          <div className="bg-helm-surface-elevated border border-helm-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListTodo size={18} className="text-helm-primary" />
              <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">Quick Todos</span>
            </div>
            <div className="space-y-2">
              <TodoListStat icon={<User size={14} />} label="Personal" count={stats.todos.byList.personal} />
              <TodoListStat icon={<Briefcase size={14} />} label="Work" count={stats.todos.byList.work} />
              <TodoListStat icon={<Wrench size={14} />} label="Tweaks" count={stats.todos.byList.tweaks} />
            </div>
          </div>
        </div>

        {/* Motivational Footer */}
        {totalToday > 0 && (
          <div className="text-center py-4">
            <p className="text-lg text-helm-text">
              {totalToday >= 10 ? "You're on fire today!" :
               totalToday >= 5 ? "Great progress today!" :
               "Keep the momentum going!"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  breakdown: string
  highlight?: boolean
}

function StatCard({ icon, label, value, breakdown, highlight }: StatCardProps) {
  return (
    <div className={`rounded-xl p-4 ${
      highlight
        ? 'bg-gradient-to-br from-helm-primary/10 to-helm-primary/5 border border-helm-primary/30'
        : 'bg-helm-surface-elevated border border-helm-border'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={highlight ? 'text-helm-primary' : 'text-helm-text-muted'}>{icon}</span>
        <span className="text-xs font-medium text-helm-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${highlight ? 'text-helm-primary' : 'text-helm-text'}`}>{value}</p>
      <p className="text-xs text-helm-text-muted mt-1">{breakdown}</p>
    </div>
  )
}

interface TodoListStatProps {
  icon: React.ReactNode
  label: string
  count: number
}

function TodoListStat({ icon, label, count }: TodoListStatProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-helm-text-muted">{icon}</span>
        <span className="text-sm text-helm-text-muted">{label}</span>
      </div>
      <span className="text-lg font-semibold text-helm-text">{count}</span>
    </div>
  )
}
