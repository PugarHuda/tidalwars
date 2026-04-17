'use client'
import { X, Keyboard } from 'lucide-react'
import { SHORTCUTS } from '@/lib/useKeyboard'

export default function KeyboardHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}>
      <div className="nb-card max-w-sm w-full overflow-hidden"
        style={{ borderColor: 'var(--teal)', borderWidth: 3, boxShadow: '6px 6px 0px #000' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'var(--teal)', borderBottom: '2px solid #000' }}>
          <div className="flex items-center gap-2 font-black" style={{ color: '#000' }}>
            <Keyboard className="w-4 h-4" />
            <span className="tracking-widest text-sm">KEYBOARD SHORTCUTS</span>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-ghost py-1 px-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center gap-3 text-xs"
                style={{ padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <kbd className="font-mono px-2 py-1 font-black"
                  style={{
                    background: 'var(--surface-2)',
                    border: '2px solid #000',
                    color: 'var(--teal)',
                    minWidth: 64,
                    textAlign: 'center',
                    fontSize: '11px',
                    boxShadow: '2px 2px 0px #000',
                  }}>
                  {s.key}
                </kbd>
                <span style={{ color: 'var(--text-muted)' }}>{s.desc}</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-center mt-3 pt-2" style={{
            color: 'var(--text-dim)', borderTop: '1px solid var(--border-soft)', fontSize: '10px',
          }}>
            Shortcuts disabled while typing in a text field.
          </div>
        </div>
      </div>
    </div>
  )
}
