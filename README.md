# 🌊 Tidal Wars

**PvP perpetual futures competitions on Pacifica DEX.** Create time-limited trading arenas, open long/short positions on real Pacifica prices, battle opponents, and win the tide.

- **Live:** https://perpwars.vercel.app
- **Built for:** Pacifica Hackathon 2026 — Social & Gamification track
- **Builder code:** `TIDALWARS` (provisioned on Pacifica mainnet, fee 0.05%)

---

## What it is

Tidal Wars is a real-time social trading game layered on top of Pacifica perpetuals. Players join arenas, pick direction (long/short), and the highest P&L when time runs out wins. Two modes:

| Mode | What happens | Wallet needed |
|------|-------------|---------------|
| **🌊 Virtual** (default) | $10k virtual USDC per arena. P&L computed from live Pacifica prices. Pure competition layer. | No |
| **⬡ Testnet** | Real Ed25519-signed order sent to Pacifica testnet `/orders/create_market` with `builder_code=TIDALWARS`. | Approved demo wallet |

Both modes use **live Pacifica prices** (REST `/info/prices` + WebSocket `wss://test-ws.pacifica.fi/ws`) so the competition outcome is always anchored to the real market.

---

## Core features

- ⚡ **Real-time PvP arenas** — Server-Sent Events push competition state, trade feed, chat, and prices to every connected client every 2 seconds
- 🏆 **Ocean-rank leaderboard** — Kraken / Whale / Shark / Dolphin / Fish / Crab / Shrimp / Reef based on ROI
- 🌊 **Tide Gauge** — replaces static chart with animated dual-layer waves whose amplitude, speed, and color track the session's price volatility
- 💬 **Live chat** per arena with 7 one-tap ocean emoji reactions (🌊 🦈 🐋 🔥 💀 🚀 🎣)
- 🔥 **Elfa AI signal** — symbol tabs show fire badge when the token is trending on social media (top-10 via `/aggregations/trending-tokens` v2)
- 📊 **Fuul Events API** — `trade_opened`, `trade_closed`, `competition_joined`, `competition_won` streamed to Fuul for rewards attribution
- 🌊 **Flash animation** on every new trade — impossible to miss when an opponent acts
- 🎯 **Real testnet balance check** — `/api/pacifica/balance?wallet=...` reads your actual Pacifica account, equity, margin, and builder approvals

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Client (Next.js 16 · App Router)             │
│  ── SSE client ─ subscribes /api/competitions/[id]/stream     │
│  ── usePacificaWs ─ direct wss://test-ws.pacifica.fi/ws       │
│  ── Privy embedded wallet (ethereum + solana)                 │
└──────────────────────────────────────────────────────────────┘
                 │                    ▲
                 ▼                    │ push every 2s
┌──────────────────────────────────────────────────────────────┐
│              Next.js API routes (Vercel serverless)           │
│  /api/competitions/[id]        create / join / open / close   │
│  /api/competitions/[id]/stream SSE comp + feed + chat + px    │
│  /api/competitions/[id]/chat   participant-only messaging     │
│  /api/prices                   Pacifica /info/prices proxy    │
│  /api/pacifica/balance         real account / approvals       │
│  /api/elfa/trending            Elfa v2 proxy + normalize      │
│  /api/admin                    diagnostics + builder check    │
└──────────────────────────────────────────────────────────────┘
                 │                    │
                 ▼                    ▼
┌─────────────────────────────┐  ┌────────────────────────────┐
│     Upstash Redis            │  │  Pacifica testnet API      │
│  comp:{id}  comp_ids         │  │  /info/prices (REST)       │
│  events:{id}  chat:{id}      │  │  /orders/create_market     │
│  (24h TTL, cross-Lambda)     │  │  /account/builder_codes/*  │
└─────────────────────────────┘  └────────────────────────────┘
```

**Why Redis?** Vercel serverless has no persistent in-memory state — different Lambda instances don't share `globalThis`. Upstash Redis gives us write-through persistence so "Competition not found" errors never happen when users join from different devices.

---

## Pacifica integration depth

### ✅ What's real (verifiable via `/api/admin`)

| Integration | Proof |
|-------------|-------|
| **Ed25519 signing** | Matches Python SDK byte-for-byte: `prepare_message(header + {data: payload})` → recursive alpha-sort → `json.dumps(separators=(',', ':'))` → `nacl.sign.detached` → bs58 encode |
| **Live prices** | `/api/v1/info/prices` polled every 5s server-side; results merged with client-side WebSocket for sub-second freshness |
| **Real orders** | In `testnet` mode, `/orders/create_market` accepts our signature. Response error confirms: `"Account CChS... has not approved builder code TIDALWARS"` — meaning Pacifica recognises the code and our payload is valid |
| **Builder code on-chain** | `TIDALWARS` provisioned on Pacifica **mainnet** for wallet `F39nN...` with fee_rate `0.0005` (0.05%). Queryable via `/api/v1/builder/overview?account=F39nN...` |
| **kBONK → BONK mapping** | Pacifica's memecoins use k-prefix (1k units); auto-remapped to base symbol ÷ 1000 for UI consistency |

### ⚠️ Honest limitations

- **Testnet orderbook is thin** — market orders often return `"No reasonable price found for X"`. Virtual mode is the primary gameplay path.
- **Privy → Pacifica agent-key delegation not wired** — currently login only; users would need to approve TIDALWARS from their own wallet + sign every trade separately. Session-key delegation is on the roadmap.
- **No Rhino.fi bridge** — USDC on-ramp to Pacifica is not integrated (users must deposit manually via test-app.pacifica.fi).

---

## Stack

- **Frontend:** Next.js 16.2.3 (App Router, Turbopack), React 19, Tailwind CSS 4
- **Backend:** Next.js API routes (serverless), Server-Sent Events for real-time
- **Persistence:** Upstash Redis (write-through hybrid with in-memory cache)
- **Signing:** `@solana/web3.js` + `tweetnacl` + `bs58`
- **Sponsors:** Privy (`@privy-io/react-auth`), Fuul Events API, Elfa AI v2 REST
- **Deploy:** Vercel (aliased `perpwars.vercel.app`)

---

## Environment variables

```bash
# Pacifica
NEXT_PUBLIC_PACIFICA_REST_URL=https://test-api.pacifica.fi/api/v1
NEXT_PUBLIC_PACIFICA_WS_URL=wss://test-ws.pacifica.fi/ws
PACIFICA_DEMO_PRIVATE_KEY=<base58 solana private key>
PACIFICA_DEMO_PUBLIC_KEY=<base58 public key>
PACIFICA_BUILDER_CODE=TIDALWARS

# Upstash Redis (serverless persistence)
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<rest token>

# Sponsors
NEXT_PUBLIC_PRIVY_APP_ID=<privy app id, e.g. cm...>
ELFA_API_KEY=elfak_<your key>
FUUL_API_KEY=<optional — silent no-op without it>
```

**Gotcha:** when adding env vars via `vercel env add`, avoid piping via `echo` — it appends `\n` which breaks Ed25519 decode and regex validation. Use `printf` or Vercel dashboard.

---

## Local dev

```bash
npm install
cp .env.local.example .env.local  # edit
npm run dev                        # localhost:3000
```

Without Upstash env, store falls back to in-memory (single-instance only). Without Pacifica demo key, testnet mode silently falls back to virtual.

---

## API endpoints

| Route | Purpose |
|-------|---------|
| `GET  /api/competitions` | list all arenas |
| `POST /api/competitions` | create arena |
| `GET  /api/competitions/[id]` | fetch arena state |
| `POST /api/competitions/[id]` | join / open / close / settle |
| `GET  /api/competitions/[id]/stream` | SSE — comp + feed + chat + prices |
| `GET/POST /api/competitions/[id]/chat` | chat messages (participant-only) |
| `POST /api/competitions/[id]/settle` | force-settle when timer expires |
| `GET  /api/leaderboard/[id]` | computed leaderboard with live unrealized P&L |
| `GET  /api/leaderboard/global` | Hall of Fame across all arenas |
| `GET  /api/feed/[id]` | trade events for arena |
| `GET  /api/prices` | Pacifica `/info/prices` proxy, cached 5s |
| `GET  /api/pacifica/balance?wallet=` | real account balance + approvals |
| `GET  /api/elfa/trending?timeWindow=4h` | Elfa v2 trending tokens |
| `GET  /api/admin` | diag: signing works, builder code status, etc |

---

## How to play

1. Open https://perpwars.vercel.app
2. Enter a display name + pick a duration → **⚡ LAUNCH & ENTER ARENA**, or join an existing arena
3. Inside the arena, pick **🌊 VIRTUAL** (default, no wallet) or **⬡ TESTNET** (real Pacifica orders)
4. Pick a symbol (top 10 by Elfa trending get a 🔥 badge), choose LONG or SHORT, set amount + leverage
5. Hit the trade button — full-screen flash confirms the trade
6. Watch live leaderboard, trade feed, and opponent chat update in real-time
7. Close positions anytime. When timer hits zero, settlement runs and winner is crowned with their ocean rank

---

## Contributing / roadmap

See [NEXT_LEVEL_IDEAS.md](./NEXT_LEVEL_IDEAS.md) for the post-hackathon roadmap.

---

## Credits

Built during Pacifica Hackathon 2026 by [@PugarHuda](https://github.com/PugarHuda).
Sponsor tooling: [Pacifica](https://docs.pacifica.fi), [Fuul](https://www.fuul.xyz), [Privy](https://www.privy.io), [Elfa AI](https://www.elfa.ai), [Upstash](https://upstash.com).
