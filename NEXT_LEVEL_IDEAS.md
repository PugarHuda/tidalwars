# 🌊 Tidal Wars — Post-Hackathon Roadmap

Where this goes next. Ordered by leverage ratio (impact ÷ effort).

---

## Tier 1 — Deep Pacifica integration (highest leverage)

### 1. Privy → Pacifica agent-key delegation
**The killer UX move.** Today users can't place real Pacifica orders from the arena — they'd need to export a private key. With Privy's programmatic signing API + Pacifica's `/account/api_agent_keys`:

1. User logs in via Privy (Solana embedded wallet auto-provisioned)
2. One-time prompt: "Authorize Tidal Wars to trade on your behalf for this arena"
3. Privy signs an `api_agent_keys` registration with a session-scoped key
4. Every trade for the rest of the arena is signed by the agent key — zero per-trade prompts

Result: competitions feel as fast as a meme-coin tracker but every order is real and on-chain.

### 2. Subaccount per competition
Pacifica's `/account/subaccounts` lets us create isolated trading accounts. Each arena could be its own subaccount:

- Automatic P&L isolation (no cross-arena margin bleed)
- Clean post-competition reporting
- Funds get released back to main account on settlement

Deep integration, judges love it, traders love it.

### 3. Builder revenue dashboard
We earn 0.05% on every order routed through `TIDALWARS`. Expose that data:

- `/dashboard` page for the builder — volume, users, fees, top symbols
- Reads from `/api/v1/builder/overview`, `/builder/trades`, `/leaderboard/builder_code`
- Could optionally share % of builder revenue with arena creators (affiliate model)

### 4. TP/SL on positions
Pacifica has `/positions/tpsl` that accepts `builder_code`. Add:

- "Set take-profit" / "Set stop-loss" inline on open positions
- Shows on the Tide Gauge as horizontal wave lines
- Auto-settles P&L when hit without needing manual close

### 5. Limit orders with tick_level UX
Currently we only do market orders. Pacifica's limit order endpoint takes `tick_level`. Add a tiny orderbook heatmap (from `/book?symbol=X`) so users can click a price level to set a limit.

---

## Tier 2 — Gameplay depth

### 6. Liquidation siren
When any participant's position drops below 25% health, trigger a full-screen red pulse + siren sound for all viewers. Turns near-liquidations into spectator events.

### 7. Battle cry overlays
Detect high-stakes moments and render full-screen themed overlays:

- Notional > $10k: "🦈 JAWS INCOMING" shark-fin animation sweeps across the screen
- 20x leverage used: "⚡ LIGHTNING STRIKE" bolt animation
- Position held ≥ 10min with >5% unrealized: "🐋 WHALE HUNT" outline animation

### 8. Submarine depth meter
Replace health bars with a submarine emoji that descends toward the seafloor (liquidation price). The deeper it goes, the closer to liquidation. Becomes a tense, visual moment-to-moment signal.

### 9. Tournament brackets
Chain multiple arenas into a bracket:

- Round 1: 16 players → 4 arenas of 4 → top of each advances
- Round 2: 4 players → 1 final arena
- Winner of final takes the whole prize pool

Prize pools could be real USDC staked on entry (multi-sig), with Pacifica trading determining the winner. Pure PvP at scale.

### 10. Spectator mode
Let non-participants watch an arena live — see every trade, chat, and leaderboard position. Creators could run "exhibition matches" with known traders, building audience.

### 11. Replay mode
After an arena settles, let anyone scrub through the tape: every trade event, price tick, chat message. Great for learning and for creators sharing highlights on socials.

### 12. Arena templates
Curated arena types:

- "BTC Only, 5x max" (focus)
- "Memecoin Madness" (WIF, BONK, FARTCOIN)
- "Funding Fight" (long on high-funding shorts, short on negative funding)
- "Sentiment Swing" (only Elfa's top-3 trending tokens)

Each template has distinct mechanics and appeals to different trader personas.

---

## Tier 3 — Social + growth

### 13. Token-gated arenas
Hold ≥1000 WIF? Unlock the WIF-community arena. Hold Pacifica points? VIP arenas. Private competitions for DAOs/communities. Builders pay to sponsor arenas with their branding + prize.

### 14. Twitter/X integration
- Share your arena link as a Twitter card with live preview
- Auto-post arena results to your timeline ("I just won +$247 on Tidal Wars 🏆")
- Elfa AI already knows Twitter sentiment — tie tweet volume to in-arena effects

### 15. Referral trees via Fuul
Fuul already has referral SDK. When Alice joins via Bob's link and wins, Bob gets a % of any builder fee Bob's sub-tree generates. Incentivises organic growth.

### 16. Ocean rank progression (persistent)
Today ocean ranks reset per arena. Make them persistent per wallet — total ROI across all arenas determines rank. Kraken rank unlocks private arenas, higher leverage caps, custom display colors.

### 17. Arena creator badges
Create 10 arenas → "Tide Summoner" badge. Host an arena that attracts 100+ participants → "Kraken Caller". Badges display next to name in all arenas.

### 18. Weekly leaderboard + leaderboard NFTs
Weekly global ROI leaderboard. Top 10 get a minted NFT (Solana) showing their rank + stats. Collectible proof of trading skill.

---

## Tier 4 — Advanced primitives

### 19. Real prize pools via Rhino.fi
Users bridge USDC from any chain → Rhino's Smart Deposit Address → Pacifica collateral. Arenas can have entry fees. Winner takes the pot minus builder + platform cut.

### 20. On-chain result attestation
Store arena final results as a Solana transaction (Memo program) so the outcome is permanently verifiable. Useful for external prize distribution or dispute resolution.

### 21. DAO-hosted arenas
A DAO votes to host a sponsored arena. Prize pool funded from treasury. DAO members get priority access. Builder code routes 50% of fees back to DAO treasury.

### 22. Cross-competition hedging
Detect when the same user has opposite positions in different arenas (long BTC in Arena A, short BTC in Arena B). Flag as hedging — optionally disallow to keep the game pure.

### 23. AI commentary (Elfa + LLM)
Every minute, a small AI commentary bubble: "BTC mentions spiked 340% on Twitter while Tidal Wars arena leader is long 10x — either a genius or a disaster." Purely observational but adds gameplay texture.

### 24. Market maker arenas
A special arena where participants place limit orders (not market) on a dedicated symbol. Pacifica's `/orders/create` + `tick_level` + `tif=gtc` powers this. Winners are determined by maker-side P&L + fills. Different from directional trading — tests a different skill.

---

## Tier 5 — Platform

### 25. Mobile-native version
Current UI is desktop-first. A React Native or PWA version with haptic feedback on trades, widgets for open positions, push notifications when you're near liquidation.

### 26. Creator economy
Let anyone become a "Captain" — sponsor arenas with their own branding, optional entry fee with their own builder sub-code. We take a % as platform fee.

### 27. Open API for external traders
Pacifica traders using their own bots could opt-in to broadcast trades to a Tidal Wars public arena. Bots vs humans leaderboard. Sparks the "can AI beat humans at perps" meme.

### 28. Discord / Telegram bots
`/arena create duration=30` in Discord spins up a new arena and posts the link. Trade feed pipes back to a channel. Native social competition in the platforms degens already live in.

---

## Non-goals (explicitly NOT doing)

- Custodial trading with user funds — always user-signed or explicitly agent-delegated
- Simulated prices or fake orderbook depth — every P&L calc uses real Pacifica marks
- Off-Pacifica markets — scope stays on Pacifica perps to deepen integration
- Gambling mechanics disconnected from trading outcomes (no random dice, no card draws)
- Ads. Ever.

---

## Tech debt to clean up

- [ ] Privy agent-key delegation (Tier 1.1) — requires Privy Pro tier + Pacifica SDK port
- [ ] Add `/account/builder_codes/approvals` UI flow for first-time users
- [ ] Migrate `usePacificaWs` to reconnect logic with backoff
- [ ] Unit tests for Ed25519 signing (round-trip test vs Python SDK output)
- [ ] E2E tests via Playwright (full flow: create → join → trade → settle)
- [ ] Error boundary around Privy (catch cold-load failures)
- [ ] Lighthouse audit — reduce initial JS bundle size
- [ ] Rate limit chat posts (currently only sanitize + cap length)
- [ ] Persist chat author identity (currently trusts client-sent `displayName`)

---

**If you're a Pacifica team member reading this:** the single highest-ROI improvement is enabling agent-key delegation via Privy. That single thing turns this from a "competition app" into a production-grade trading front-end, and it's the piece that would let builder-code volume scale 100x.
