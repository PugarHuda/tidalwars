'use client'
import { X, FileKey, Zap, AlertCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePrivySolanaSign } from '@/lib/usePrivySolanaSign'
import { sortJsonKeys, assemblePacificaBody } from '@/lib/pacifica-canonical'

interface TradeIntent {
  action: 'open' | 'close'
  symbol: string
  side: 'bid' | 'ask'
  amount: number
  leverage: number
  currentPrice: number
  clientOrderId: string
}

interface SigningModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called when user hits Sign & Submit AND Privy isn't available (→ server falls back to demo keypair) */
  onConfirmServerSign: () => void
  /** Called with the Pacifica API response after a successful Privy-signed relay */
  onPrivySubmitted?: (response: unknown) => void
  trade: TradeIntent | null
  /** Demo keypair pubkey — used when Privy not connected */
  demoPubkey: string
  builderCode: string
  loading?: boolean
}

/**
 * Transparent signing preview for TESTNET mode.
 *
 * When a Privy Solana wallet is connected → pops Privy's sign modal,
 *   encodes the signature, relays to Pacifica via /api/pacifica/relay.
 * Otherwise → "Sign & Submit" falls back to server signing with the demo
 *   keypair (current behavior) so demos without wallet still work.
 */
export default function SigningModal({
  isOpen, onClose, onConfirmServerSign, onPrivySubmitted,
  trade, demoPubkey, builderCode, loading: parentLoading,
}: SigningModalProps) {
  const [mounted, setMounted] = useState(false)
  const [privyLoading, setPrivyLoading] = useState(false)
  const [privyError, setPrivyError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!isOpen) { setPrivyError(null); setPrivyLoading(false) }
  }, [isOpen])

  const { ready: privyReady, walletAddress: privyAddress, signPacifica } = usePrivySolanaSign()

  // Signer pubkey shown in modal — prefer Privy wallet if connected
  const signerPubkey = privyAddress ?? demoPubkey
  const signerSource: 'privy' | 'demo' = privyReady ? 'privy' : 'demo'

  // Build the canonical payload that would be signed (for display + signing)
  const canonicalAndPayload = useMemo(() => {
    if (!trade) return null
    const sidePayload = trade.action === 'close' ? (trade.side === 'bid' ? 'ask' : 'bid') : trade.side
    const payload: Record<string, unknown> = {
      amount: String(trade.amount),
      builder_code: builderCode,
      client_order_id: trade.clientOrderId,
      reduce_only: trade.action === 'close',
      side: sidePayload,
      slippage_percent: '1',
      symbol: trade.symbol,
    }
    const timestamp = Date.now()
    const canonical = sortJsonKeys({
      data: payload,
      expiry_window: 5000,
      timestamp,
      type: 'create_market_order',
    })
    return { payload, canonical, timestamp }
  }, [trade, builderCode])

  if (!mounted || !isOpen || !trade || !canonicalAndPayload) return null

  const notional = trade.currentPrice * trade.amount * trade.leverage
  const margin = (trade.currentPrice * trade.amount) / trade.leverage
  const loading = parentLoading || privyLoading

  async function handleSignSubmit() {
    setPrivyError(null)
    if (!privyReady) {
      // Fall back to server demo keypair path
      onConfirmServerSign()
      return
    }
    // Real Privy signing flow
    setPrivyLoading(true)
    try {
      const signed = await signPacifica({
        type: 'create_market_order',
        payload: canonicalAndPayload!.payload,
        timestamp: canonicalAndPayload!.timestamp,
      })

      const body = assemblePacificaBody({
        account: signed.account,
        signature: signed.signature,
        timestamp: signed.timestamp,
        expiryWindow: signed.expiryWindow,
        payload: canonicalAndPayload!.payload,
      })

      const res = await fetch('/api/pacifica/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'orders/create_market', body }),
      })
      const json = await res.json()
      onPrivySubmitted?.(json)
      onClose()
    } catch (e) {
      setPrivyError(e instanceof Error ? e.message : String(e))
    } finally {
      setPrivyLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}>
      <div className="nb-card max-w-2xl w-full overflow-hidden"
        style={{ borderColor: 'var(--gold)', borderWidth: 3, boxShadow: '8px 8px 0px #000' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ background: 'var(--gold)', borderBottom: '2px solid #000' }}>
          <div className="flex items-center gap-2 font-black" style={{ color: '#000' }}>
            <FileKey className="w-4 h-4" />
            <span className="tracking-widest">SIGN PACIFICA ORDER</span>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-ghost py-1 px-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          {/* Action summary */}
          <div className="mb-4 p-3" style={{
            background: trade.action === 'close' ? 'rgba(255,215,0,0.08)'
              : trade.side === 'bid' ? 'rgba(0,232,122,0.08)' : 'rgba(255,68,102,0.08)',
            border: `2px solid ${trade.action === 'close' ? 'var(--gold)'
              : trade.side === 'bid' ? 'var(--profit)' : 'var(--loss)'}`,
          }}>
            <div className="text-xs font-black tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
              YOU ARE ABOUT TO
            </div>
            <div className="text-lg font-black" style={{ color: 'var(--text)' }}>
              {trade.action === 'close' ? '⚓ CLOSE'
                : trade.side === 'bid' ? '🌊 LONG' : '🔻 SHORT'}
              {' '}{trade.amount} {trade.symbol}
              {' @ '}${trade.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              {' · '}{trade.leverage}x
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Notional: </span>
                <span className="font-mono font-black" style={{ color: 'var(--text)' }}>${notional.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Margin: </span>
                <span className="font-mono font-black" style={{ color: 'var(--gold)' }}>${margin.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Canonical signed message */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-black tracking-widest" style={{ color: 'var(--teal)' }}>
                1. CANONICAL MESSAGE TO SIGN
              </span>
              <span className="text-xs px-1.5" style={{
                background: 'var(--teal)', color: '#000', border: '1px solid #000', fontSize: '9px', fontWeight: 800,
              }}>
                ED25519
              </span>
            </div>
            <pre className="text-xs font-mono p-2.5 overflow-x-auto" style={{
              background: 'var(--bg)', border: '2px solid #000', color: 'var(--text)',
              lineHeight: 1.4, fontSize: '11px',
            }}>
{JSON.stringify(canonicalAndPayload.canonical, null, 2)}
            </pre>
            <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              Alpha-sorted keys · compact JSON · UTF-8 bytes → nacl.sign.detached → bs58 encode
            </div>
          </div>

          {/* HTTP body preview */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-black tracking-widest" style={{ color: 'var(--gold)' }}>
                2. HTTP POST /orders/create_market
              </span>
              <span className="text-xs px-1.5" style={{
                background: 'var(--gold)', color: '#000', border: '1px solid #000', fontSize: '9px', fontWeight: 800,
              }}>
                builder_code={builderCode}
              </span>
            </div>
            <pre className="text-xs font-mono p-2.5 overflow-x-auto" style={{
              background: 'var(--bg)', border: '2px solid #000', color: 'var(--text)',
              lineHeight: 1.4, fontSize: '11px',
            }}>
{JSON.stringify({
  account: signerPubkey,
  signature: '<ED25519_SIGNATURE_BS58>',
  timestamp: canonicalAndPayload.timestamp,
  expiry_window: 5000,
  ...canonicalAndPayload.payload,
}, null, 2)}
            </pre>
          </div>

          {/* Signer disclosure */}
          <div className="mb-4 p-2.5 text-xs" style={{
            background: 'var(--surface-2)',
            border: `1px solid ${signerSource === 'privy' ? 'var(--profit)' : 'var(--border-soft)'}`,
            color: 'var(--text-muted)',
          }}>
            <div className="font-black mb-1 tracking-wider flex items-center gap-1.5"
              style={{ color: 'var(--text)', fontSize: '11px' }}>
              🔑 SIGNING IDENTITY
              {signerSource === 'privy' ? (
                <span className="px-1.5 text-xs" style={{
                  background: 'var(--profit)', color: '#000', border: '1px solid #000', fontSize: '9px',
                }}>
                  PRIVY WALLET
                </span>
              ) : (
                <span className="px-1.5 text-xs" style={{
                  background: 'var(--gold)', color: '#000', border: '1px solid #000', fontSize: '9px',
                }}>
                  DEMO KEYPAIR
                </span>
              )}
            </div>
            <div className="font-mono" style={{ fontSize: '10px', wordBreak: 'break-all' }}>
              {signerPubkey}
            </div>
            <div className="mt-1" style={{ fontSize: '10px', lineHeight: 1.4 }}>
              {signerSource === 'privy' ? (
                <>
                  <span style={{ color: 'var(--profit)' }}>Your Privy embedded Solana wallet</span>
                  {' will sign this order client-side — private key never leaves your browser.'}
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--gold)' }}>Hackathon demo keypair (server-side)</span>
                  {' · Connect a Privy wallet to sign orders from your own address.'}
                </>
              )}
            </div>
          </div>

          {/* Privy error */}
          {privyError && (
            <div className="mb-3 p-2.5 flex items-start gap-2 text-xs"
              style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid var(--loss)', color: 'var(--loss)' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div style={{ wordBreak: 'break-word' }}>
                <div className="font-black">Signing failed</div>
                <div style={{ fontSize: '10px', opacity: 0.9 }}>{privyError}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
              className="nb-btn nb-btn-ghost flex-1 py-2.5 text-sm">
              CANCEL
            </button>
            <button onClick={handleSignSubmit} disabled={loading}
              className="nb-btn nb-btn-gold flex-[2] py-2.5 text-sm"
              style={{ background: 'var(--gold)', color: '#000', fontWeight: 900 }}>
              {loading ? (
                <>
                  <span className="animate-spin inline-block">◌</span>{' '}
                  {privyLoading ? 'AWAITING PRIVY SIGNATURE...' : 'SIGNING & SUBMITTING...'}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> {signerSource === 'privy' ? 'SIGN WITH PRIVY' : 'SIGN & SUBMIT'}
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-center mt-3" style={{ color: 'var(--text-dim)' }}>
            Virtual competition P&L is computed regardless of on-chain fill outcome.
          </div>
        </div>
      </div>
    </div>
  )
}
