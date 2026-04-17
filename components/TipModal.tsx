'use client'
import { useEffect, useState } from 'react'
import { X, Gift, AlertCircle, Check } from 'lucide-react'
import { captainFor } from '@/lib/points'

interface Props {
  isOpen: boolean
  onClose: () => void
  competitionId: string
  fromUserId: string
  fromDisplayName: string
  toUserId: string
  toDisplayName: string
  onSent?: () => void
}

const PRESETS = [10, 50, 100, 500]

export default function TipModal({
  isOpen, onClose, competitionId, fromUserId, fromDisplayName, toUserId, toDisplayName, onSent,
}: Props) {
  const [balance, setBalance] = useState<number | null>(null)
  const [amount, setAmount] = useState<number>(50)
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!isOpen || !fromUserId) return
    setSent(false); setError(null); setCustom(''); setAmount(50)
    fetch(`/api/points/${fromUserId}`).then(r => r.json())
      .then(d => setBalance(d.totalPoints ?? 0))
      .catch(() => setBalance(0))
  }, [isOpen, fromUserId])

  if (!isOpen) return null

  const finalAmount = custom ? Math.floor(Number(custom)) || 0 : amount
  const canAfford = balance !== null && balance >= finalAmount && finalAmount > 0
  const cap = captainFor(balance ?? 0)

  async function send() {
    if (!canAfford || sending) return
    setError(null); setSending(true)
    try {
      const res = await fetch(`/api/competitions/${competitionId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId, fromDisplayName, toUserId, toDisplayName, amount: finalAmount,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Tip failed')
      } else {
        setSent(true)
        setBalance(data.newFromBalance ?? balance)
        onSent?.()
        setTimeout(() => onClose(), 1200)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[195] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="nb-card w-full overflow-hidden" style={{
        maxWidth: 380, borderColor: 'var(--gold)', borderWidth: 3, boxShadow: '6px 6px 0px #000',
      }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'var(--gold)', borderBottom: '2px solid #000' }}>
          <div className="flex items-center gap-2 font-black text-sm" style={{ color: '#000' }}>
            <Gift className="w-4 h-4" /> GIFT TIDAL POINTS
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-ghost py-1 px-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4">
          <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Gift points to <span className="font-black" style={{ color: 'var(--text)' }}>{toDisplayName}</span> to boost
            their arena score. Winner gets more points to climb the captain ladder.
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between p-2.5 mb-3" style={{
            background: 'var(--surface-2)', border: '2px solid #000',
          }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{cap.emoji}</span>
              <div>
                <div className="text-xs font-black tracking-wider" style={{ color: 'var(--text)' }}>
                  YOUR BALANCE
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {cap.title} tier
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black font-mono text-lg tabular-nums" style={{
                color: balance === null ? 'var(--text-dim)' : 'var(--teal)',
              }}>
                {balance === null ? '...' : balance.toLocaleString()}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                Tidal Points
              </div>
            </div>
          </div>

          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {PRESETS.map(p => {
              const affordable = balance !== null && balance >= p
              const selected = !custom && amount === p
              return (
                <button key={p}
                  onClick={() => { setCustom(''); setAmount(p) }}
                  disabled={!affordable}
                  className="py-2 text-xs font-black tracking-wider"
                  style={{
                    background: selected ? 'var(--gold)' : 'var(--surface-2)',
                    color: selected ? '#000' : affordable ? 'var(--text)' : 'var(--text-dim)',
                    border: '2px solid #000',
                    boxShadow: selected ? '2px 2px 0px #000' : '1px 1px 0px #000',
                    cursor: affordable ? 'pointer' : 'not-allowed',
                    opacity: affordable ? 1 : 0.5,
                  }}>
                  {p}
                </button>
              )
            })}
          </div>

          {/* Custom amount */}
          <input type="number" min="1" placeholder="Custom amount..."
            className="nb-input text-xs mb-3"
            value={custom}
            onChange={e => { setCustom(e.target.value); setAmount(0) }} />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-1.5 p-2 mb-3 text-xs"
              style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid var(--loss)', color: 'var(--loss)' }}>
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span style={{ fontSize: '11px' }}>{error}</span>
            </div>
          )}

          {/* Send button */}
          <button onClick={send} disabled={!canAfford || sending || sent}
            className="nb-btn w-full py-2.5 text-sm font-black"
            style={{
              background: sent ? 'var(--profit)' : canAfford ? 'var(--gold)' : 'var(--surface-2)',
              color: sent ? '#000' : canAfford ? '#000' : 'var(--text-dim)',
              border: '2px solid #000',
              cursor: !canAfford || sending ? 'not-allowed' : 'pointer',
            }}>
            {sent ? (
              <><Check className="w-4 h-4" /> GIFTED!</>
            ) : sending ? (
              <><span className="animate-spin inline-block">◌</span> SENDING...</>
            ) : !canAfford ? (
              'NOT ENOUGH POINTS'
            ) : (
              <><Gift className="w-4 h-4" /> GIFT {finalAmount} POINTS</>
            )}
          </button>

          <div className="text-xs text-center mt-2" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
            Earn more points by placing in arenas · top 3 ranks get a bonus
          </div>
        </div>
      </div>
    </div>
  )
}
