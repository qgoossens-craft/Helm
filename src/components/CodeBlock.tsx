import { useState, useRef, useEffect } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light'
import { Copy, Check } from 'lucide-react'

// Import only needed languages to minimize bundle
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'

// Register languages
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('py', python)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('md', markdown)

// Custom theme using Helm CSS variables
const helmCodeTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: 'var(--color-helm-text)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.8125rem',
    lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    color: 'var(--color-helm-text)',
    background: 'var(--color-helm-bg)',
    margin: 0,
    padding: '0.75rem 1rem',
    overflow: 'auto',
    borderRadius: '0.375rem',
  },
  comment: { color: 'var(--color-helm-text-muted)' },
  prolog: { color: 'var(--color-helm-text-muted)' },
  doctype: { color: 'var(--color-helm-text-muted)' },
  cdata: { color: 'var(--color-helm-text-muted)' },
  punctuation: { color: 'var(--color-helm-text-muted)' },
  property: { color: 'var(--color-helm-primary)' },
  tag: { color: 'var(--color-helm-primary)' },
  boolean: { color: 'var(--color-helm-warning)' },
  number: { color: 'var(--color-helm-warning)' },
  constant: { color: 'var(--color-helm-warning)' },
  symbol: { color: 'var(--color-helm-warning)' },
  deleted: { color: 'var(--color-helm-error)' },
  selector: { color: 'var(--color-helm-success)' },
  'attr-name': { color: 'var(--color-helm-success)' },
  string: { color: 'var(--color-helm-success)' },
  char: { color: 'var(--color-helm-success)' },
  builtin: { color: 'var(--color-helm-success)' },
  inserted: { color: 'var(--color-helm-success)' },
  operator: { color: 'var(--color-helm-text)' },
  entity: { color: 'var(--color-helm-text)' },
  url: { color: 'var(--color-helm-primary)' },
  '.language-css .token.string': { color: 'var(--color-helm-warning)' },
  '.style .token.string': { color: 'var(--color-helm-warning)' },
  atrule: { color: 'var(--color-helm-primary)' },
  'attr-value': { color: 'var(--color-helm-success)' },
  keyword: { color: 'var(--color-helm-primary)' },
  function: { color: 'var(--color-helm-primary)' },
  'class-name': { color: 'var(--color-helm-warning)' },
  regex: { color: 'var(--color-helm-warning)' },
  important: { color: 'var(--color-helm-error)', fontWeight: 'bold' },
  variable: { color: 'var(--color-helm-text)' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
}

interface CodeBlockProps {
  language: string | undefined
  children: string
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const displayLanguage = language || 'text'

  return (
    <div className="relative group my-2">
      {/* Language badge + Copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-helm-surface-elevated border border-helm-border border-b-0 rounded-t-md">
        <span className="text-xs text-helm-text-muted font-mono">{displayLanguage}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-helm-text-muted hover:text-helm-text transition-colors"
          title={copied ? 'Copied!' : 'Copy code'}
          aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check size={12} className="text-helm-success" />
              <span className="text-helm-success">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="border border-helm-border border-t-0 rounded-b-md overflow-hidden">
        <SyntaxHighlighter
          language={displayLanguage}
          style={helmCodeTheme}
          customStyle={{
            margin: 0,
            borderRadius: 0,
          }}
          showLineNumbers={children.split('\n').length > 5}
          lineNumberStyle={{
            color: 'var(--color-helm-text-muted)',
            opacity: 0.5,
            paddingRight: '1rem',
            minWidth: '2rem',
          }}
        >
          {children.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
