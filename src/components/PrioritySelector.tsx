import { useState, useRef, useEffect } from 'react'
import { Flag } from 'lucide-react'
import { PRIORITY_LEVELS, type Priority } from '../lib/priorityConstants'

interface PrioritySelectorProps {
  priority: Priority | null
  onPriorityChange: (priority: Priority | null) => void
  className?: string
}

export function PrioritySelector({ priority, onPriorityChange, className = '' }: PrioritySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (newPriority: Priority | null) => {
    onPriorityChange(newPriority)
    setIsOpen(false)
  }

  const currentColor = priority ? PRIORITY_LEVELS[priority].color : undefined

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-1 rounded hover:bg-helm-surface-elevated transition-colors"
        title="Set priority"
      >
        <Flag
          size={14}
          style={currentColor ? { color: currentColor } : undefined}
          className={currentColor ? '' : 'text-helm-text-muted'}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
          {/* No priority option */}
          <button
            onClick={() => handleSelect(null)}
            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
              priority === null ? 'text-helm-primary' : 'text-helm-text-muted'
            }`}
          >
            <span className="w-2 h-2 rounded-full border border-helm-border" />
            None
          </button>

          {/* Priority options */}
          {(Object.keys(PRIORITY_LEVELS) as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => handleSelect(p)}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
                priority === p ? 'text-helm-primary' : 'text-helm-text'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: PRIORITY_LEVELS[p].color }}
              />
              {PRIORITY_LEVELS[p].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
