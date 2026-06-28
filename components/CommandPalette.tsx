'use client'

import { Command } from 'cmdk'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const ACTIONS = [
  { id: 'dashboard', label: 'Go to Dashboard', shortcut: 'G D', href: '/app' },
  { id: 'create', label: 'Create New Stream', shortcut: 'G C', href: '/app/create' },
  { id: 'streams', label: 'View All Streams', shortcut: '', href: '/app/streams' },
  { id: 'analytics', label: 'Analytics', shortcut: '', href: '/app/analytics' },
  { id: 'help', label: 'Keyboard Shortcut Help', shortcut: 'Ctrl+/', href: '#help' },
]

function FocusTrap({
  children,
  onEscape,
}: {
  children: React.ReactNode
  onEscape: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const focusable = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = focusable()
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [onEscape])

  return <div ref={ref}>{children}</div>
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const router = useRouter()
  const triggerRef = useRef<HTMLElement | null>(null)

  function closeAll() {
    setOpen(false)
    setShowHelp(false)
    ;(triggerRef.current as HTMLElement | null)?.focus()
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        triggerRef.current = document.activeElement as HTMLElement
        setOpen((o) => !o)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        triggerRef.current = document.activeElement as HTMLElement
        setShowHelp((o) => !o)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        router.push('/app/create')
      }
    }

    let gPressed = false
    const chord = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'g') {
        gPressed = true
        setTimeout(() => {
          gPressed = false
        }, 1000)
        return
      }
      if (gPressed) {
        if (e.key === 'd') router.push('/app')
        if (e.key === 'c') router.push('/app/create')
        gPressed = false
      }
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keydown', chord)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keydown', chord)
    }
  }, [router])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24"
          aria-hidden="true"
          onClick={closeAll}
        >
          <FocusTrap onEscape={closeAll}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <Command>
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search..."
                  className="w-full px-4 py-3 text-sm outline-none border-b bg-transparent"
                />
                <Command.List className="max-h-72 overflow-y-auto p-2">
                  <Command.Empty className="p-4 text-sm text-gray-400">
                    No results found.
                  </Command.Empty>
                  {ACTIONS.map((action) => (
                    <Command.Item
                      key={action.id}
                      onSelect={() => {
                        if (action.href !== '#help') {
                          router.push(action.href)
                        } else {
                          setOpen(false)
                          setShowHelp(true)
                          return
                        }
                        closeAll()
                      }}
                      className="flex justify-between items-center px-3 py-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
                    >
                      {action.label}
                      {action.shortcut && (
                        <kbd className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">
                          {action.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.List>
              </Command>
            </div>
          </FocusTrap>
        </div>
      )}

      {showHelp && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          aria-hidden="true"
          onClick={closeAll}
        >
          <FocusTrap onEscape={closeAll}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="shortcut-help-title"
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="shortcut-help-title" className="font-semibold text-lg">
                  Keyboard Shortcuts
                </h2>
                <button
                  autoFocus
                  onClick={closeAll}
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ✕
                </button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {[
                    ['Cmd/Ctrl + K', 'Open command palette'],
                    ['Cmd/Ctrl + N', 'Create new stream'],
                    ['Cmd/Ctrl + /', 'Toggle this help'],
                    ['G then D', 'Go to dashboard'],
                    ['G then C', 'Go to create stream'],
                    ['Esc', 'Close dialogs'],
                  ].map(([key, desc]) => (
                    <tr key={key}>
                      <td className="py-2 pr-4">
                        <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                          {key}
                        </kbd>
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FocusTrap>
        </div>
      )}
    </>
  )
}
