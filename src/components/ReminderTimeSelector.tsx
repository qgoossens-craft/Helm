import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface ReminderTimeSelectorProps {
  value: string | null  // "HH:MM" format in 24-hour time
  onChange: (time: string | null) => void
  disabled?: boolean
  className?: string
}

// Preset time options with 24-hour storage format and 12-hour display
const PRESET_TIMES: { value: string; label: string }[] = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' }
]

/**
 * Format 24-hour time to 12-hour format for display
 */
function formatTime12Hour(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function ReminderTimeSelector({
  value,
  onChange,
  disabled = false,
  className = ''
}: ReminderTimeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCustomInput(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectTime = (time: string | null) => {
    onChange(time)
    if (time === null) {
      setShowCustomInput(false)
    }
    setIsOpen(false)
  }

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    if (newTime) {
      onChange(newTime)
    }
  }

  // Check if current value matches a preset
  const isPresetTime = value && PRESET_TIMES.some(pt => pt.value === value)
  const displayValue = value ? formatTime12Hour(value) : null

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) {
            setIsOpen(!isOpen)
          }
        }}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          disabled
            ? 'bg-helm-surface-elevated/50 text-helm-text-muted cursor-not-allowed'
            : value
              ? 'bg-helm-primary/10 text-helm-primary border border-helm-primary/30 hover:bg-helm-primary/20'
              : 'bg-helm-surface-elevated text-helm-text-muted border border-helm-border hover:text-helm-text hover:border-helm-text-muted'
        }`}
        title={value ? `Reminder at ${displayValue}` : 'Set reminder time'}
      >
        <Clock size={14} />
        {value ? displayValue : 'Set reminder'}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
          {/* No reminder option */}
          <button
            onClick={() => handleSelectTime(null)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
              value === null ? 'text-helm-primary' : 'text-helm-text-muted'
            }`}
          >
            <span className="w-2 h-2 rounded-full border border-helm-border" />
            No reminder
          </button>

          <div className="border-t border-helm-border my-1" />

          {/* Preset time options */}
          <div className="max-h-[200px] overflow-y-auto">
            {PRESET_TIMES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => handleSelectTime(pt.value)}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
                  value === pt.value ? 'text-helm-primary' : 'text-helm-text'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    value === pt.value ? 'bg-helm-primary' : 'border border-helm-border'
                  }`}
                />
                {pt.label}
              </button>
            ))}
          </div>

          <div className="border-t border-helm-border my-1" />

          {/* Custom time option */}
          <div className="px-3 py-2">
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`w-full text-left text-sm flex items-center gap-2 ${
                !isPresetTime && value ? 'text-helm-primary' : 'text-helm-text-muted'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isPresetTime && value ? 'bg-helm-primary' : 'border border-helm-border'
                }`}
              />
              Custom time
            </button>
            {showCustomInput && (
              <input
                type="time"
                value={value || ''}
                onChange={handleCustomTimeChange}
                className="mt-2 w-full bg-helm-bg border border-helm-border rounded px-2 py-1 text-sm text-helm-text"
                autoFocus
              />
            )}
          </div>

          {/* Current reminder summary */}
          {value && (
            <div className="border-t border-helm-border mt-1 px-3 py-2">
              <p className="text-xs text-helm-text-muted">
                Reminder: {displayValue}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
