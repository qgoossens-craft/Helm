import { useState, useRef, useEffect } from 'react'
import { Tag, X } from 'lucide-react'

interface CategorySelectorProps {
  category: string | null
  projectCategories: string[]
  onCategoryChange: (category: string | null) => void
  className?: string
}

export function CategorySelector({
  category,
  projectCategories,
  onCategoryChange,
  className = ''
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter categories based on input
  const filteredCategories = projectCategories.filter((cat) =>
    cat.toLowerCase().includes(inputValue.toLowerCase())
  )

  // Check if input matches an existing category exactly
  const exactMatch = projectCategories.some(
    (cat) => cat.toLowerCase() === inputValue.toLowerCase()
  )

  // Show "create new" option if input has value and doesn't match exactly
  const showCreateOption = inputValue.trim() && !exactMatch

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setInputValue('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus input when dropdown opens
      setTimeout(() => inputRef.current?.focus(), 0)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (newCategory: string | null) => {
    onCategoryChange(newCategory)
    setIsOpen(false)
    setInputValue('')
  }

  const handleCreateNew = () => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue) {
      onCategoryChange(trimmedValue)
      setIsOpen(false)
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showCreateOption) {
        handleCreateNew()
      } else if (filteredCategories.length > 0) {
        handleSelect(filteredCategories[0])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setInputValue('')
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-1 rounded hover:bg-helm-surface-elevated transition-colors flex items-center justify-center"
        title={category ? `Category: ${category}` : 'Set category'}
      >
        <span className="pointer-events-none">
          <Tag size={14} className="text-helm-primary" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg z-50 min-w-[180px] overflow-hidden">
          {/* Search/Create input */}
          <div className="p-2 border-b border-helm-border">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create..."
              className="w-full px-2 py-1 text-sm bg-helm-bg border border-helm-border rounded text-helm-text placeholder-helm-text-muted focus:outline-none focus:border-helm-primary"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto py-1">
            {/* Clear/None option */}
            <button
              onClick={() => handleSelect(null)}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
                category === null ? 'text-helm-primary' : 'text-helm-text-muted'
              }`}
            >
              <X size={12} />
              None
            </button>

            {/* Create new category option */}
            {showCreateOption && (
              <button
                onClick={handleCreateNew}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 text-helm-primary"
              >
                <Tag size={12} />
                Create "{inputValue.trim()}"
              </button>
            )}

            {/* Existing categories */}
            {filteredCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleSelect(cat)}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
                  category === cat ? 'text-helm-primary' : 'text-helm-text'
                }`}
              >
                <Tag size={12} className="text-helm-text-muted" />
                {cat}
              </button>
            ))}

            {/* Empty state */}
            {filteredCategories.length === 0 && !showCreateOption && (
              <div className="px-3 py-2 text-sm text-helm-text-muted text-center">
                No categories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
