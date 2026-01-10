// Priority type and constants for task prioritization

export type Priority = 'low' | 'medium' | 'high'

export const PRIORITY_LEVELS: Record<Priority, { label: string; color: string; order: number }> = {
  low: { label: 'Low', color: '#3b82f6', order: 1 },
  medium: { label: 'Medium', color: '#f59e0b', order: 2 },
  high: { label: 'High', color: '#ef4444', order: 3 }
}

export function getPriorityColor(priority: Priority | null): string | null {
  return priority ? PRIORITY_LEVELS[priority].color : null
}

export function getPriorityLabel(priority: Priority | null): string | null {
  return priority ? PRIORITY_LEVELS[priority].label : null
}
