'use client'
import { useEffect, useRef, useState } from 'react'
import { Settings, Volume2, VolumeX, Keyboard, Sparkles } from 'lucide-react'

interface Props {
  soundOn: boolean
  onToggleSound: () => void
  onOpenHelp: () => void
  onOpenShop: () => void
  builderCode: string
}

/**
 * Condensed arena controls — single gear button replaces 4-6 header badges.
 * Opens a compact menu with sound toggle, ship shop, keyboard help, and
 * integration badges (builder / fuul / pacifica) as passive info rows.
 */
export default function ArenaSettings({
  soundOn, onToggleSound, onOpenHelp, onOpenShop, builderCode,
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="nb-btn nb-btn-ghost py-1 px-2"
        title="Settings · sound · shortcuts · shop">
        <Settings className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 nb-card overflow-hidden"
          style={{
            minWidth: 240, borderColor: 'var(--teal)', borderWidth: 2,
            boxShadow: '4px 4px 0px #000', zIndex: 120,
          }}>
          {/* Quick actions */}
          <button onClick={() => { onToggleSound() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left transition-colors"
            style={{ borderBottom: '1px solid var(--border-soft)', color: 'var(--text)' }}>
            {soundOn
              ? <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--teal)' }} />
              : <VolumeX className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
            <span className="flex-1">Sound effects</span>
            <span className="text-xs font-mono" style={{ color: soundOn ? 'var(--profit)' : 'var(--text-dim)' }}>
              {soundOn ? 'ON' : 'OFF'}
            </span>
          </button>

          <button onClick={() => { setOpen(false); onOpenShop() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left"
            style={{ borderBottom: '1px solid var(--border-soft)', color: 'var(--text)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            <span className="flex-1">Ship shop</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
          </button>

          <button onClick={() => { setOpen(false); onOpenHelp() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left"
            style={{ borderBottom: '2px solid #000', color: 'var(--text)' }}>
            <Keyboard className="w-3.5 h-3.5" />
            <span className="flex-1">Keyboard shortcuts</span>
            <kbd className="font-mono px-1 font-black" style={{
              background: 'var(--surface-2)', border: '1px solid var(--border-soft)',
              color: 'var(--text-muted)', fontSize: '9px',
            }}>?</kbd>
          </button>

          {/* Integration stack — passive info, not buttons */}
          <div className="px-3 pt-2 pb-3" style={{ background: 'var(--surface-2)' }}>
            <div className="text-xs font-black tracking-widest mb-1.5"
              style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
              POWERED BY
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-xs px-1.5 py-0.5 font-black" style={{
                border: '1px solid #000', background: 'var(--teal)', color: '#000', fontSize: '9px',
              }} title={`Pacifica builder_code=${builderCode}`}>
                ⬡ PACIFICA
              </span>
              <span className="text-xs px-1.5 py-0.5 font-black" style={{
                border: '1px solid #000', background: 'var(--surface-3)', color: 'var(--text-muted)', fontSize: '9px',
              }} title="Trade events streamed to Fuul Events API">
                FUUL
              </span>
              <span className="text-xs px-1.5 py-0.5 font-black" style={{
                border: '1px solid #000', background: 'var(--surface-3)', color: 'var(--text-muted)', fontSize: '9px',
              }} title="KOL mentions via Elfa AI v2">
                ELFA AI
              </span>
              <span className="text-xs px-1.5 py-0.5 font-black" style={{
                border: '1px solid #000', background: 'var(--surface-3)', color: 'var(--text-muted)', fontSize: '9px',
              }} title="Embedded Solana wallets via Privy">
                PRIVY
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
