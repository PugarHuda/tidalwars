# 🌊 Tidal Wars

**Real-time PvP perpetual futures tournaments built on Pacifica.**
Traders battle in time-boxed arenas with live on-chain prices. Watchers
back favorites with skin in the game. Everyone climbs a points ladder.

- **Live:** [perpwars.vercel.app](https://perpwars.vercel.app)
- **Track:** Social & Gamification
- **Builder code:** `TIDALWARS` · Pacifica mainnet · 0.05% fee · wallet `F39nNrR1Jw5cGGSndxKTeugbHErw5iz1Ev4864KJxcof`

---

## What it is

Tidal Wars is a social-trading game layer on top of Pacifica's perpetuals
infrastructure. Create an arena, invite traders, the best P&L when the
timer hits zero wins. Along the way:

- Every participant shows up as a **ship on an animated ocean**, floating at
  their P&L height. Sinking losers leak bubbles. Winners ride big waves.
- Watchers **chat, react, and tip Tidal Points** to their favorite trader.
  If that trader places top-3, the tipper gets a **2.0×/1.5×/1.0× kickback**.
- Arena settle awards **Tidal Points** that persist across every match.
  Climb the Captain tiers: Rookie → Sailor → Navigator → Captain → Commodore
  → Admiral → Legend.
- 20 per-arena achievements, ambient ocean soundtrack that intensifies with
  volatility, liquidation broadcasts, replay mode, and more.

Two modes:

| Mode | What happens | Wallet needed |
|------|-------------|---------------|
| **🌊 Virtual** (default) | Every arena gives you $10k virtual USDC. P&L tracks real Pacifica prices. | No |
| **⬡ Testnet** | Real Ed25519-signed orders sent to Pacifica `/orders/create_market` with `builder_code=TIDALWARS`. | Privy Solana wallet |

Both modes use **real Pacifica live prices** (REST + WebSocket) so the
competition outcome is always anchored to the actual market.

---

## Core features

### Trading
- **Real Pacifica orders** — Ed25519-signed with `tweetnacl`, matches the
  Python SDK byte-for-byte (recursive alpha-sort + compact JSON + bs58)
- **Agent keys** — bind ephemeral Solana keypair once via Privy; all
  subsequent trades auto-sign without modal. Graceful `local` fallback for
  non-whitelisted accounts
- **Builder code `TIDALWARS`** included in every order's `builder_code` field
- **Market, amount, slippage, reduce_only** all wired
- **Live balance + approvals** check against real Pacifica account
- **Copy Trade** — click any opponent's trade to replicate symbol/side/leverage

### Social / Gamification
- **OceanBattle view** — ships per user, wave-ride fluid motion, sink on
  big losses, speech bubbles on chat, gift buttons on every ship
- **Tipping with Tidal Points** — spectators (or participants) can gift
  any trader their accumulated points
- **Kickback economics** — back a winner, get 2×; runner-up, 1.5×; 3rd,
  1.0× refund; 4+, tip forfeit
- **Tidal Points** persistent across arenas, stored in Upstash Redis
- **7 Captain tiers** unlocked by cumulative points (Rookie 0+ → Legend 10k+)
- **Ship shop** — 13 emoji ships gated by captain tier (no spending, pure
  progression)
- **20 achievements** per arena: First Blood, Whale Size, Diamond Hands,
  Scalper, Comeback Kid, Shark Attack, Copycat, etc.
- **Live leaderboard with rank deltas** — ▲2 / ▼3 animations when rank changes
- **Liquidation broadcast** — full-screen red flash + 🦈 banner when any
  participant closes at ≥50% margin loss
- **Lobby countdown** — scheduled arenas, pre-join window before trading opens
- **Watcher mode** — spectate without joining, chat with 👁 tag, gift points
- **Replay modal** — scrub through settled arenas, leaderboard + candle
  chart reconstruct from trade event log (event sourcing)
- **Arena result share** — auto-composed Twitter intent with rank + PnL

### Sponsors integrated
- **Pacifica** — REST + WebSocket + builder program + agent keys
- **Privy** — embedded Solana wallets + `useSignMessage` for Pacifica signing
- **Elfa AI v2** — `/aggregations/trending-tokens` drives 🔥 badges on symbol
  tabs · `/data/top-mentions` powers per-symbol KOL heat bar
- **Fuul** — Events API (`trade_opened`, `trade_closed`, `competition_joined`,
  `competition_won`) fired on every state transition

### UX / polish
- **3 chart views**: 🚢 Battle (ships) · 📊 Candles (real Pacifica OHLC) ·
  🌊 Tide (ocean gauge)
- **Ambient soundtrack** — Web Audio API synthesized rumble + filtered noise,
  intensity scales with session volatility. Off by default.
- **Trade SFX** — bubble pop on open, chime on profit, whale on big win, thud on loss
- **Keyboard shortcuts** — L/S/C for long/short/close, 1-9 leverage,
  Shift+1-5 symbol, Enter submit, ? help, Esc close
- **Neobrutalism × ocean blue** aesthetic — 2px black borders, hard
  shadows, animated waves as background texture
- **Confetti + whale sound** on winner reveal
- **Signing modal** shows exact Ed25519 payload + HTTP body before submit
- **Position impact preview** — margin utilization bar, "available: $X → $Y"
  diff, insufficient-margin warning

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            Client (Next.js 16 App Router · Turbopack)        │
│                                                              │
│  OceanBattle SVG  ·  CandleChart  ·  TideGauge               │
│  ReplayModal  ·  TipModal  ·  ShipShop  ·  SigningModal     │
│  LiquidationBroadcast  ·  Confetti  ·  Achievement toasts   │
│                                                              │
│  Hooks:                                                      │
│   · useCompetitionStream (SSE → comp/feed/chat/tips/prices) │
│   · usePacificaWs (WebSocket mark prices)                   │
│   · usePrivySolanaSign (@privy-io/react-auth/solana)         │
│   · useAgentKey (ephemeral Ed25519 session)                 │
│   · useKeyboard  ·  useElfaHeat  ·  usePriceHistory         │
└─────────────────────────────────────────────────────────────┘
                 │                                  ▲
                 ▼                                  │ push every 2s
┌─────────────────────────────────────────────────────────────┐
│               Next.js API routes (serverless)                │
│                                                              │
│  /api/competitions                  create, list             │
│  /api/competitions/[id]             get, join, open, close, settle │
│  /api/competitions/[id]/stream      SSE: comp+feed+chat+tips+prices │
│  /api/competitions/[id]/chat        post/list (spectator+trader) │
│  /api/competitions/[id]/tip         send, list tip state     │
│  /api/competitions/[id]/settle      force-settle on timer end │
│  /api/leaderboard/[id]              computed w/ unrealized P&L │
│  /api/leaderboard/global            Hall of Fame             │
│  /api/points/[userId]               user's Tidal Points      │
│  /api/points/top                    cross-arena captain ladder │
│  /api/feed/[id]                     trade event log          │
│  /api/prices                        /info/prices proxy       │
│  /api/pacifica/kline                OHLC for charts          │
│  /api/pacifica/balance              real account balance     │
│  /api/pacifica/instruments          testnet instrument list  │
│  /api/pacifica/relay                client-signed forwarder  │
│  /api/elfa/trending                 v2 trending-tokens       │
│  /api/elfa/mentions                 v2 top-mentions per symbol │
│  /api/admin                         diagnostics              │
└─────────────────────────────────────────────────────────────┘
                 │                    │
                 ▼                    ▼
┌─────────────────────────────┐  ┌────────────────────────────┐
│     Upstash Redis            │  │  Pacifica                  │
│                              │  │                            │
│  comp:{id}   comp_ids        │  │  REST: /info/prices        │
│  events:{id} chat:{id}       │  │        /info               │
│  tips:{id}   tips state      │  │        /kline              │
│  tidal_points:{userId}       │  │        /account            │
│  tidal_points_leaderboard    │  │        /book               │
│  (24h-30d TTL, cross-Lambda) │  │        /orders/create_market │
│                              │  │        /account/builder_codes/approve │
│                              │  │        /agent/bind         │
│                              │  │        /builder/overview   │
│                              │  │                            │
│                              │  │  WS:   /ws (mark prices)   │
└─────────────────────────────┘  └────────────────────────────┘
```

**Why Redis?** Vercel serverless has no persistent in-memory state —
different Lambda instances don't share `globalThis`. Upstash gives
write-through persistence so cross-device joins, spectator views, and
multi-user arenas all work correctly.

---

## Pacifica integration depth

### What's real (verifiable via `/api/admin`)

| # | Integration | Proof |
|---|-------------|-------|
| 1 | **Ed25519 signing** | Matches Python SDK byte-for-byte: `prepare_message({header, data}) → recursive-sort → JSON.stringify (compact) → UTF-8 → nacl.sign.detached → bs58 encode` |
| 2 | **Builder code on mainnet** | `TIDALWARS` provisioned for wallet `F39nN...xcof` with fee rate `0.0005`. Queryable via `/builder/overview?account=F39nN...` |
| 3 | **Real orders** | `POST /orders/create_market` accepts our signed payload — error `"Account ... has not approved builder code TIDALWARS"` proves Pacifica recognizes both signature and code |
| 4 | **Live prices REST** | `GET /info/prices` polled server-side every 5s, streamed to all clients via SSE |
| 5 | **Historical candles** | `GET /kline?symbol=X&interval=1m&start_time=...&end_time=...` returns OHLCV. Visible in CandleChart + ReplayModal |
| 6 | **WebSocket mark prices** | `wss://test-ws.pacifica.fi/ws` subscribed for every symbol tab. Drives OceanBattle wave animation |
| 7 | **Agent key flow** | `POST /agent/bind` with ephemeral keypair signed via Privy. Graceful `local` fallback when account not whitelisted |
| 8 | **Account balance** | `GET /account?account=...` for real equity / margin / approvals in WalletButton dropdown |
| 9 | **kBONK → BONK mapping** | Pacifica lists memecoins with `k` prefix for 1k units. Auto-remapped for UI consistency |

### Honest limitations

- **Testnet orderbook is thin** — market orders often return `"No reasonable
  price found"`. Pacifica-side state, not our integration. Virtual mode is
  therefore the primary demo path; TESTNET mode proves the submission
  plumbing for when accounts get whitelisted.
- **Agent key bind** usually fails on fresh Privy wallets (Pacifica requires
  account deposit + beta whitelist). We fall back to `local` session mode
  which still eliminates the per-trade Privy modal for virtual trades.
- **Fuul dashboard campaigns** not configured (we fire events correctly, but
  Fuul admin config is a post-hackathon ops task).
- **Rhino.fi** not integrated — missed fourth sponsor tool.

---

## Stack

- **Frontend:** Next.js 16.2.3 (App Router, Turbopack), React 19, Tailwind 4
- **Backend:** Next.js serverless API routes + Server-Sent Events
- **Persistence:** Upstash Redis (hybrid in-memory + REST, write-through)
- **Signing:** `@solana/web3.js` + `tweetnacl` + `bs58`
- **Wallet:** `@privy-io/react-auth` v3.21.2 (Solana embedded wallets)
- **Sponsors:** Pacifica core, Elfa AI v2, Fuul Events API, Privy
- **Deploy:** Vercel → `perpwars.vercel.app`

---

## Economics (no smart contract needed)

| Who | What they do | What they get |
|-----|-------------|----------------|
| **Trader** | Enters arena, opens/closes positions | Tidal Points by final rank + ROI bonus + tips received |
| **Watcher** | Joins as spectator, tips traders | Kickback if their backed trader places top-3 (2×/1.5×/1×) |
| **Creator** | Starts arena with optional lobby | Recognition (future: builder sub-code fee share) |

**Upgrade path to real USDC** (no smart contract either):
1. Swap `deductPoints(user, amount)` → `SPL.transfer(from, to, amountUSDC)`
2. Uses Pacifica subaccounts as natural escrow (no custom contract)
3. Fuul `Claim Checks` for reward payouts (merkle proof → on-chain claim)

---

## Environment variables

```bash
# Pacifica (required)
NEXT_PUBLIC_PACIFICA_REST_URL=https://test-api.pacifica.fi/api/v1
NEXT_PUBLIC_PACIFICA_WS_URL=wss://test-ws.pacifica.fi/ws
PACIFICA_DEMO_PRIVATE_KEY=<base58 solana key — server-side signing fallback>
PACIFICA_DEMO_PUBLIC_KEY=<base58 pubkey>
PACIFICA_BUILDER_CODE=TIDALWARS

# Upstash Redis (required for multi-instance persistence)
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<rest token>

# Sponsors
NEXT_PUBLIC_PRIVY_APP_ID=<privy app id, format cm...>
ELFA_API_KEY=elfak_<your key>
FUUL_API_KEY=<bearer key — silent no-op without it>
```

**Gotcha:** When adding env vars via `vercel env add`, avoid `echo` — it
appends `\n` which breaks Ed25519 decode AND regex validation on `NEXT_PUBLIC_*`
vars. Use `printf` or the Vercel dashboard. Codebase defensively trims all
critical env vars.

---

## Local development

```bash
npm install --legacy-peer-deps    # Privy Solana pulls @solana-program/memo
cp .env.local.example .env.local  # fill in keys
npm run dev                        # localhost:3000
```

Without Upstash configured, store falls back to in-memory (single Lambda
only). Without Pacifica demo key, TESTNET mode degrades to virtual.

---

## How to play

1. Open [perpwars.vercel.app](https://perpwars.vercel.app)
2. Pick a display name, create an arena (duration 1min–4h, optional lobby),
   or hit **👁 WATCH** on any live arena to spectate
3. In arena: pick a symbol (BTC/ETH/SOL/WIF/BONK), choose LONG or SHORT,
   set amount + leverage, click to trade
4. Toggle **📊 CANDLES / 🌊 TIDE / 🚢 BATTLE** chart views
5. Open **⚙ Settings → Ship Shop** to pick a ship based on your Captain tier
6. Close positions anytime. Timer hits zero → settle → winner crowned.
7. Achievements unlock throughout. Tidal Points persist across arenas.
8. As a watcher: click any ship's 🎁 button to back them. Top-3 finish = kickback.

---

## Full feature roadmap

See [NEXT_LEVEL_IDEAS.md](./NEXT_LEVEL_IDEAS.md) for the post-hackathon roadmap.

Highlights: real USDC tips via SPL transfer · prize pool staking via
Pacifica subaccount escrow · guild arenas · NFT ship skins · Fuul USDC
claim payouts · arena snapshot PNG for social sharing.

---

## Credits

Solo submission by **Huda** ([@PugarHuda](https://github.com/PugarHuda)) ·
Pacifica Hackathon 2026 · Social & Gamification track.

Builder code `TIDALWARS` provisioned on Pacifica mainnet with thanks to the
Pacifica team. Sponsor tools: [Fuul](https://www.fuul.xyz), [Privy](https://www.privy.io),
[Elfa AI](https://www.elfa.ai), [Upstash](https://upstash.com).

---

## Links

- **Live demo:** https://perpwars.vercel.app
- **Repository:** https://github.com/PugarHuda/tidalwars
- **Builder on mainnet:** `https://api.pacifica.fi/api/v1/builder/overview?account=F39nNrR1Jw5cGGSndxKTeugbHErw5iz1Ev4864KJxcof`
- **Pacifica docs:** https://docs.pacifica.fi/api-documentation/api
