'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Waves, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'

/**
 * Slides presentation — keyboard-driven, neobrutalism × ocean, designed
 * to pair with the live demo. Match the main app's design system so
 * context never breaks when we cut between "slide" and "app".
 *
 * Navigation:
 *   → / Space / Enter → next
 *   ← / Backspace     → prev
 *   Home/End          → first/last
 *   N                 → toggle presenter notes
 *   F                 → fullscreen
 *   Esc               → back to homepage
 */
export default function SlidesPage() {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [notesOn, setNotesOn] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const next = useCallback(() => setI(v => Math.min(v + 1, SLIDES.length - 1)), [])
  const prev = useCallback(() => setI(v => Math.max(v - 1, 0)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          e.preventDefault(); next(); break
        case 'ArrowLeft':
        case 'Backspace':
          e.preventDefault(); prev(); break
        case 'Home':
          setI(0); break
        case 'End':
          setI(SLIDES.length - 1); break
        case 'n':
        case 'N':
          setNotesOn(v => !v); break
        case 'f':
        case 'F':
          containerRef.current?.requestFullscreen?.().catch(() => {}); break
        case 'Escape':
          router.push('/'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, router])

  const slide = SLIDES[i]

  return (
    <div ref={containerRef}
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>

      {/* Animated wave stripes across bottom (subtle) */}
      <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none" style={{
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,216,245,0.04) 100%)',
      }} />

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{
        borderBottom: '2px solid #000', background: 'var(--surface)',
      }}>
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4" style={{ color: 'var(--teal)' }} />
          <span className="text-sm font-black tracking-tight" style={{ color: 'var(--teal)' }}>TIDAL WARS</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· Pacifica Hackathon 2026</span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="hidden md:inline">Arrow keys · N for notes · F fullscreen · Esc exit</span>
          <span className="font-mono tabular-nums" style={{ color: 'var(--teal)' }}>
            {String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>
        </div>
      </header>

      {/* Slide body */}
      <main className="flex-1 flex items-center justify-center p-8 relative">
        <div className="max-w-5xl w-full">{slide.content}</div>
      </main>

      {/* Presenter notes overlay */}
      {notesOn && slide.notes && (
        <div className="fixed bottom-16 left-4 right-4 md:left-auto md:right-4 md:max-w-md p-4 z-10"
          style={{
            background: 'var(--surface)', border: '2px solid var(--gold)',
            boxShadow: '4px 4px 0px #000',
          }}>
          <div className="text-xs font-black tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
            PRESENTER NOTES
          </div>
          <div className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {slide.notes}
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <footer className="flex items-center justify-between px-6 py-3 shrink-0" style={{
        borderTop: '2px solid #000', background: 'var(--surface)',
      }}>
        <button onClick={prev} disabled={i === 0}
          className="nb-btn nb-btn-ghost py-1.5 px-3 text-xs">
          <ChevronLeft className="w-3.5 h-3.5" /> PREV
        </button>
        <div className="flex items-center gap-1 flex-1 justify-center max-w-md">
          {SLIDES.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)}
              className="h-1 transition-all"
              style={{
                flex: idx === i ? '3 1 0' : '1 1 0',
                background: idx <= i ? 'var(--teal)' : 'var(--border-soft)',
                border: '1px solid #000',
              }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => containerRef.current?.requestFullscreen?.().catch(() => {})}
            className="nb-btn nb-btn-ghost py-1.5 px-2 text-xs hidden md:flex">
            <Maximize2 className="w-3 h-3" />
          </button>
          <button onClick={next} disabled={i === SLIDES.length - 1}
            className="nb-btn nb-btn-primary py-1.5 px-3 text-xs">
            NEXT <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  )
}

// ─── Slide definitions ───────────────────────────────────────────────────────

interface Slide { content: React.ReactNode; notes?: string }

const SLIDES: Slide[] = [

  // 01 — Title
  { notes: `10-min demo. Keep this on screen while you introduce yourself.
"Hi, I'm Huda. This is Tidal Wars — Pacifica perpetuals, but as a multiplayer game."`,
    content: (
      <div className="text-center relative">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-black tracking-[0.3em]"
            style={{ background: 'var(--teal-bg)', border: '2px solid var(--teal)', color: 'var(--teal)' }}>
            PACIFICA HACKATHON 2026 · SOCIAL &amp; GAMIFICATION
          </div>
        </div>
        <h1 className="font-black tracking-tight leading-none mb-4"
          style={{ fontSize: 'clamp(64px, 12vw, 160px)', textShadow: '6px 6px 0px #000' }}>
          <span style={{ color: 'var(--teal)' }}>TIDAL</span>
          <span style={{ color: 'var(--text)' }}>WARS</span>
        </h1>
        <div className="text-xl md:text-2xl mb-8" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
          PvP perpetual futures tournaments on Pacifica
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 font-mono text-sm"
          style={{ background: 'var(--surface-2)', border: '2px solid var(--border-soft)', color: 'var(--text-muted)' }}>
          perpwars.vercel.app
        </div>
      </div>
    ),
  },

  // 02 — Problem
  { notes: `30 sec. Set up pain clearly. Don't dwell.`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--loss)' }}>
          PROBLEM
        </div>
        <h2 className="font-black text-4xl md:text-6xl leading-tight mb-6" style={{ color: 'var(--text)' }}>
          Perpetual futures trading is<br/>
          <span style={{ color: 'var(--loss)' }}>a lonely sport.</span>
        </h2>
        <div className="space-y-4 mt-10 text-xl md:text-2xl" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">·</span>
            <span>You open a position alone.</span>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-3xl">·</span>
            <span>You watch your own P&amp;L tick alone.</span>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-3xl">·</span>
            <span>You close alone. <span style={{ color: 'var(--text-dim)' }}>Rinse. Repeat.</span></span>
          </div>
          <div className="flex items-start gap-4 mt-8 text-lg" style={{ color: 'var(--text-dim)' }}>
            <span>Existing "social" tools — copy trading, mirror accounts — are <em>extractive</em>. They monetise your attention without giving you an arena.</span>
          </div>
        </div>
      </div>
    ),
  },

  // 03 — Solution
  { notes: `30-45 sec. Frame as multiplayer game that fits Pacifica ecosystem.`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--teal)' }}>
          OUR SOLUTION
        </div>
        <h2 className="font-black text-4xl md:text-6xl leading-tight mb-10" style={{ color: 'var(--text)' }}>
          Real-time trading<br/>
          <span style={{ color: 'var(--teal)' }}>tournaments.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: '01', title: 'JOIN AN ARENA', desc: 'Time-boxed rooms, 1min → 4h. Pre-join lobby so friends gather before the match.', color: 'var(--teal)' },
            { n: '02', title: 'TRADE ON PACIFICA', desc: 'Long/short five perps with live on-chain prices. Every order carries our builder code.', color: 'var(--profit)' },
            { n: '03', title: 'CLIMB THE LADDER', desc: 'Tidal Points persist across arenas. Watchers back favorites with skin in the game.', color: 'var(--gold)' },
          ].map(step => (
            <div key={step.n} className="nb-card p-5" style={{ borderTopColor: step.color, borderTopWidth: 3 }}>
              <div className="text-5xl font-black mb-3" style={{ color: step.color, opacity: 0.25 }}>
                {step.n}
              </div>
              <div className="text-sm font-black tracking-widest mb-2" style={{ color: step.color }}>
                {step.title}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // 04 — Hero visual → cut to live demo
  { notes: `SWITCH TO LIVE DEMO after this slide. This is your "hand-off to the app" moment.
Say: "Let me show you" then Cmd+Tab to arena.`,
    content: (
      <div className="text-center">
        <div className="text-xs font-black tracking-[0.3em] mb-4" style={{ color: 'var(--gold)' }}>
          LIVE WALKTHROUGH
        </div>
        <div className="text-6xl mb-4">🚢</div>
        <h2 className="font-black text-3xl md:text-5xl leading-tight mb-8" style={{ color: 'var(--text)' }}>
          Let me show you<br/>the <span style={{ color: 'var(--teal)' }}>arena.</span>
        </h2>
        <div className="inline-flex items-center gap-3 px-4 py-3 font-mono text-sm"
          style={{ background: 'var(--surface-2)', border: '2px solid var(--teal)', color: 'var(--teal)' }}>
          perpwars.vercel.app/arena/demo
        </div>
        <div className="mt-12 text-xs" style={{ color: 'var(--text-dim)' }}>
          (Switch screens now — back to slides after demo)
        </div>
      </div>
    ),
  },

  // 05 — OceanBattle highlight
  { notes: `After demo walkthrough. Re-enter slides to summarise what they saw.
"The core visual innovation is OceanBattle. Let me break down what you saw."`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--teal)' }}>
          SIGNATURE FEATURE
        </div>
        <h2 className="font-black text-4xl md:text-5xl leading-tight mb-8" style={{ color: 'var(--text)' }}>
          OceanBattle — <span style={{ color: 'var(--teal)' }}>ships per trader,</span><br/>riding live price volatility.
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="nb-card p-5">
            <div className="text-2xl mb-2">🐋 🛥️ ⛵ 🚣 🚢 ⚓</div>
            <div className="text-sm font-black tracking-widest mb-2" style={{ color: 'var(--teal)' }}>
              SHIP TIER BY P&amp;L
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Emoji changes with PnL%. Whale at +15%, anchor below -5%.
              Losers literally sink. Bubble trails. Rotation.
            </div>
          </div>
          <div className="nb-card p-5">
            <div className="text-2xl mb-2">🌊 ⚡ ⚡⚡</div>
            <div className="text-sm font-black tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
              WAVES REACT TO VOLATILITY
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {'Session |Δ| ≥ 3% → storm mode. ≥ 6% → tsunami with lightning. Audio intensity scales identically.'}
            </div>
          </div>
          <div className="nb-card p-5">
            <div className="text-2xl mb-2">💬</div>
            <div className="text-sm font-black tracking-widest mb-2" style={{ color: 'var(--profit)' }}>
              CHAT BUBBLES ON SHIPS
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Chat appears as speech above trader's ship for 5s. Watchers see
              who's saying what in real time.
            </div>
          </div>
          <div className="nb-card p-5">
            <div className="text-2xl mb-2">🎁</div>
            <div className="text-sm font-black tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
              GIFT BUTTON ON EVERY SHIP
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Watchers tip points. Kickback if pick places top-3. Bet
              on traders, not against them.
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 06 — Economics
  { notes: `Explain the kickback mechanic clearly. This is the unique SOCIAL contribution
we bring to Pacifica. No other hackathon submission will have this.`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>
          ECONOMICS · NO SMART CONTRACT NEEDED
        </div>
        <h2 className="font-black text-4xl md:text-5xl leading-tight mb-8" style={{ color: 'var(--text)' }}>
          Watchers back traders.<br/>
          <span style={{ color: 'var(--gold)' }}>Pick a winner. Get 2x back.</span>
        </h2>

        <div className="grid md:grid-cols-4 gap-3 mb-6">
          {[
            { rank: '#1', mult: '2.0×', color: 'var(--gold)', label: 'WINNER' },
            { rank: '#2', mult: '1.5×', color: 'var(--profit)', label: 'RUNNER-UP' },
            { rank: '#3', mult: '1.0×', color: 'var(--teal)', label: 'REFUND' },
            { rank: '4+', mult: '0×', color: 'var(--loss)', label: 'FORFEIT' },
          ].map(t => (
            <div key={t.rank} className="nb-card p-4 text-center" style={{ borderTopColor: t.color, borderTopWidth: 3 }}>
              <div className="text-3xl font-black font-mono" style={{ color: t.color }}>{t.rank}</div>
              <div className="text-2xl font-black font-mono mt-1" style={{ color: 'var(--text)' }}>{t.mult}</div>
              <div className="text-xs font-black tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>

        <div className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Tip 100 points on your favorite. They win? You get <span className="font-black" style={{ color: 'var(--gold)' }}>200</span> back.
          They flop? The 100 is gone. <span style={{ color: 'var(--text)' }}>Asymmetric payoff. Real stakes. Zero contract.</span>
        </div>

        <div className="mt-6 p-3 text-xs" style={{
          background: 'var(--surface-2)', border: '1px dashed var(--border-soft)', color: 'var(--text-dim)',
        }}>
          <span className="font-black" style={{ color: 'var(--teal)' }}>Upgrade path:</span>
          {' '}swap point-deduct for Solana SPL USDC transfer → same UI, real money. Still no smart contract.
          Pacifica subaccounts become natural escrow. Fuul Claim Checks for final payouts.
        </div>
      </div>
    ),
  },

  // 07 — Pacifica integration depth
  { notes: `THE PROOF section. Be specific. Judges wary of "we sprinkle Pacifica" claims.
Read off the endpoints quickly, emphasis on "live on mainnet".`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--teal)' }}>
          PACIFICA INTEGRATION · VERIFIABLE
        </div>
        <h2 className="font-black text-3xl md:text-5xl leading-tight mb-6" style={{ color: 'var(--text)' }}>
          <span style={{ color: 'var(--teal)' }}>9 integration points.</span><br/>
          Builder code live on mainnet.
        </h2>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-xs md:text-sm font-mono">
          {[
            ['Ed25519 signing', 'matches Python SDK byte-for-byte'],
            ['/info/prices', 'live prices, polled 5s'],
            ['/kline', 'real OHLC for CandleChart + Replay'],
            ['WebSocket /ws', 'mark prices → wave animation'],
            ['/orders/create_market', 'real signed orders with builder_code'],
            ['/agent/bind', 'session key, no-modal trading'],
            ['/account', 'real balance + approvals'],
            ['/builder/overview', 'mainnet fee tracking'],
            ['kBONK → BONK', 'auto-remapped for UI consistency'],
          ].map(([ep, desc]) => (
            <div key={ep} className="flex items-center justify-between py-2"
              style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <code style={{ color: 'var(--teal)' }}>{ep}</code>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{desc}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 font-mono text-xs" style={{
          background: 'var(--bg)', border: '2px solid var(--gold)',
        }}>
          <div className="mb-1" style={{ color: 'var(--gold)', fontSize: '10px', letterSpacing: '0.2em', fontWeight: 900 }}>
            MAINNET PROOF · /api/v1/builder/overview
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            {`{ builder_code: "`}<span style={{ color: 'var(--teal)' }}>TIDALWARS</span>{`", address: "`}<span style={{ color: 'var(--text)' }}>F39nN…xcof</span>{`", fee_rate: "0.000500000000" }`}
          </div>
        </div>
      </div>
    ),
  },

  // 08 — Full tech stack
  { notes: `Quick skim. Don't dwell. Audience wants to know this isn't duct tape.`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--profit)' }}>
          TECH STACK · PRODUCTION-GRADE
        </div>
        <h2 className="font-black text-3xl md:text-5xl leading-tight mb-8" style={{ color: 'var(--text)' }}>
          Built to ship, <span style={{ color: 'var(--profit)' }}>not to demo.</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: 'var(--teal)' }}>
              FRONTEND
            </div>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>· Next.js 16.2.3 App Router + Turbopack</li>
              <li>· React 19 + Tailwind 4</li>
              <li>· SSE for real-time sync (2s push)</li>
              <li>· Pure SVG animations, no chart library</li>
              <li>· Web Audio synthesis for ambient + SFX</li>
              <li>· Dynamic imports to shrink bundle</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: 'var(--gold)' }}>
              BACKEND
            </div>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>· Next.js serverless API routes (Vercel)</li>
              <li>· Upstash Redis (write-through hybrid)</li>
              <li>· Ed25519 via tweetnacl</li>
              <li>· Event-sourced leaderboard replay</li>
              <li>· Endpoint whitelist on client-signed relay</li>
              <li>· Atomic operations for tip economics</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: 'var(--profit)' }}>
              SPONSORS WIRED
            </div>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>· <span style={{ color: 'var(--text)' }}>Pacifica</span> — REST + WS + builder + agent</li>
              <li>· <span style={{ color: 'var(--text)' }}>Privy</span> — Solana embedded wallets + signMessage</li>
              <li>· <span style={{ color: 'var(--text)' }}>Elfa AI v2</span> — trending + top-mentions</li>
              <li>· <span style={{ color: 'var(--text)' }}>Fuul</span> — Events API 4 event types</li>
              <li>· <span style={{ color: 'var(--text)' }}>Upstash</span> — serverless Redis</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: 'var(--loss)' }}>
              CHECK THE CODE
            </div>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>· 40+ routes &amp; components</li>
              <li>· 100% TypeScript, strict</li>
              <li>· 15 API endpoints, all 200 on QA</li>
              <li>· Real-time multi-Lambda consistency</li>
              <li>· github.com/PugarHuda/tidalwars</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  // 09 — Who uses it / impact
  { notes: `20-40 sec. Named personas stronger than "users".`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>
          VALUE &amp; IMPACT
        </div>
        <h2 className="font-black text-3xl md:text-5xl leading-tight mb-10" style={{ color: 'var(--text)' }}>
          Who shows up <span style={{ color: 'var(--gold)' }}>on day one.</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              who: 'ACTIVE TRADER',
              emoji: '🦈',
              why: 'Wants a competition layer on an existing Pacifica habit. Already signing orders — now they have an arena.',
              color: 'var(--teal)',
            },
            {
              who: 'DISCORD COMMUNITY',
              emoji: '🐋',
              why: 'Hosts weekly arena. Winner gets server role. Losers memed in #trades. Social proof for the Pacifica brand.',
              color: 'var(--gold)',
            },
            {
              who: 'SPECTATOR',
              emoji: '👁',
              why: 'No skin in trading game, but has Tidal Points to gamble. Backs favorites, watches chaos, tips winners.',
              color: 'var(--profit)',
            },
          ].map(p => (
            <div key={p.who} className="nb-card p-5" style={{ borderTopColor: p.color, borderTopWidth: 3 }}>
              <div className="text-4xl mb-3">{p.emoji}</div>
              <div className="text-sm font-black tracking-widest mb-3" style={{ color: p.color }}>
                {p.who}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {p.why}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-4" style={{ background: 'var(--surface-2)', border: '2px solid var(--teal)' }}>
          <div className="text-xs font-black tracking-widest mb-2" style={{ color: 'var(--teal)' }}>
            FOR PACIFICA
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Top-of-funnel for new traders · Volume driver via builder code · Social layer they don't have to build · Every arena = future fee revenue on mainnet.
          </div>
        </div>
      </div>
    ),
  },

  // 10 — What's next
  { notes: `20-30 sec. Three moves. Keep bullets short.`,
    content: (
      <div>
        <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--teal)' }}>
          WHAT'S NEXT
        </div>
        <h2 className="font-black text-4xl md:text-6xl leading-tight mb-10" style={{ color: 'var(--text)' }}>
          Three moves after<br/>the hackathon.
        </h2>

        <div className="space-y-5 text-lg md:text-xl">
          <div className="flex items-start gap-5">
            <div className="shrink-0 text-4xl font-black" style={{ color: 'var(--gold)' }}>01</div>
            <div>
              <div className="font-black mb-1" style={{ color: 'var(--text)' }}>Real USDC tips</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Swap <code>deductPoints</code> → Solana SPL transfer. Same UI. Still no smart contract.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-5">
            <div className="shrink-0 text-4xl font-black" style={{ color: 'var(--profit)' }}>02</div>
            <div>
              <div className="font-black mb-1" style={{ color: 'var(--text)' }}>Prize pool staking via subaccount escrow</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Pacifica subaccounts already isolate balance — use them as natural escrow. Zero custom contract.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-5">
            <div className="shrink-0 text-4xl font-black" style={{ color: 'var(--teal)' }}>03</div>
            <div>
              <div className="font-black mb-1" style={{ color: 'var(--text)' }}>Shareable arena result PNGs</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Winning an arena becomes a Twitter moment. Viral loop back to Pacifica.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-sm" style={{ color: 'var(--text-dim)' }}>
          Builder code <span style={{ color: 'var(--teal)' }} className="font-mono font-black">TIDALWARS</span> is live on mainnet. The moment real USDC enters arenas, every trade becomes real Pacifica fee revenue.
        </div>
      </div>
    ),
  },

  // 11 — Close
  { notes: `"Tidal Wars. Pacifica perpetuals but as a multiplayer game. Thanks."
Stay on this slide through Q&A.`,
    content: (
      <div className="text-center">
        <div className="text-6xl md:text-8xl mb-6">🌊</div>
        <h1 className="font-black mb-6 leading-none"
          style={{ fontSize: 'clamp(48px, 8vw, 110px)', textShadow: '4px 4px 0px #000' }}>
          <span style={{ color: 'var(--teal)' }}>TIDAL</span>
          <span style={{ color: 'var(--text)' }}>WARS</span>
        </h1>
        <div className="text-xl md:text-2xl mb-10" style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
          Pacifica perpetuals — as a multiplayer game.
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <a href="https://perpwars.vercel.app" target="_blank" rel="noopener noreferrer"
            className="nb-btn nb-btn-primary py-3 px-6">
            🌊 perpwars.vercel.app
          </a>
          <a href="https://github.com/PugarHuda/tidalwars" target="_blank" rel="noopener noreferrer"
            className="nb-btn nb-btn-ghost py-3 px-6">
            github.com/PugarHuda/tidalwars
          </a>
        </div>

        <div className="inline-flex items-center gap-6 px-6 py-3" style={{
          background: 'var(--surface-2)', border: '2px solid var(--border-soft)',
        }}>
          <span className="text-xs tracking-widest font-black" style={{ color: 'var(--text-muted)' }}>
            BUILDER CODE
          </span>
          <code className="font-mono font-black text-lg" style={{ color: 'var(--teal)' }}>
            TIDALWARS
          </code>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            · Pacifica mainnet · 0.05% fee
          </span>
        </div>

        <div className="mt-10 text-xs" style={{ color: 'var(--text-dim)' }}>
          Thanks to Pacifica team · Sponsor tools · Thanks for watching 🙏
        </div>
      </div>
    ),
  },
]
