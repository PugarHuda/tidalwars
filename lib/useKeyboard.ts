'use client'
import { useEffect } from 'react'

export interface KeyboardHandlers {
  onLong?: () => void
  onShort?: () => void
  onClose?: () => void
  onSubmit?: () => void
  onLeverage?: (level: number) => void
  onSymbol?: (index: number) => void
  onShowHelp?: () => void
  onEscape?: () => void
  enabled?: boolean
}

/**
 * Global keyboard shortcuts for speed-trading.
 *
 * Standard shortcuts (fires when no text input is focused):
 *   L          → long
 *   S          → short
 *   C          → close most-recent position
 *   Enter      → submit pending trade
 *   1-9        → set leverage
 *   Shift+1-5  → select symbol (BTC/ETH/SOL/WIF/BONK)
 *   ?          → show help
 *   Esc        → close modal
 *
 * Inputs/textareas never intercepted so chat typing stays intact.
 */
export function useKeyboard(handlers: KeyboardHandlers) {
  useEffect(() => {
    if (handlers.enabled === false) return

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      // Don't fire when typing in an input/textarea/contenteditable
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        if (e.key === 'Escape') handlers.onEscape?.()
        return
      }

      // Ignore if modifier (except Shift) is held
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const k = e.key.toLowerCase()

      // Shift+1..5 → symbol index 0..4
      if (e.shiftKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        handlers.onSymbol?.(Number(e.key) - 1)
        return
      }

      // 1..9 → leverage
      if (!e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        handlers.onLeverage?.(Number(e.key))
        return
      }

      switch (k) {
        case 'l': e.preventDefault(); handlers.onLong?.(); break
        case 's': e.preventDefault(); handlers.onShort?.(); break
        case 'c': e.preventDefault(); handlers.onClose?.(); break
        case 'enter': handlers.onSubmit?.(); break
        case '?':
        case '/': // same key as ? on US layouts
          if (e.shiftKey || k === '?') { e.preventDefault(); handlers.onShowHelp?.() }
          break
        case 'escape': handlers.onEscape?.(); break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}

export const SHORTCUTS = [
  { key: 'L',          desc: 'Open LONG' },
  { key: 'S',          desc: 'Open SHORT' },
  { key: 'C',          desc: 'Close most-recent position' },
  { key: 'Enter',      desc: 'Submit pending action' },
  { key: '1-9',        desc: 'Set leverage (e.g. 5 = 5×)' },
  { key: 'Shift+1-5',  desc: 'Select symbol (BTC/ETH/SOL/WIF/BONK)' },
  { key: '?',          desc: 'Toggle this help' },
  { key: 'Esc',        desc: 'Close modal / cancel' },
]
