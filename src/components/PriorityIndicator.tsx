import { getPriorityColor, type Priority } from '../lib/priorityConstants'

interface PriorityIndicatorProps {
  priority: Priority | null
  size?: 'sm' | 'md'
}

export function PriorityIndicator({ priority, size = 'sm' }: PriorityIndicatorProps) {
  if (!priority) return null

  const color = getPriorityColor(priority)
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  return (
    <span
      className={`${sizeClasses} rounded-full inline-block flex-shrink-0`}
      style={{ backgroundColor: color || undefined }}
      title={`${priority} priority`}
    />
  )
}
