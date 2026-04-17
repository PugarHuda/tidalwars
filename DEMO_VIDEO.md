# 🎥 Tidal Wars — Demo Video Production Guide

**Target:** 7–8 min final cut (hard max 10 min per hackathon rules)
**Format:** 1920×1080, voice narration required, screen recording strongly recommended

---

## PRE-PRODUCTION (one-time setup, do before recording)

### 1. Pre-seeded demo arena
URL already created with 4 participants, open positions, and seeded chat:
```
https://perpwars.vercel.app/arena/ebfe6400-d27d-4d83-a205-52a3db66ef83
```
(If expired after 24h, regenerate via the bash script at the bottom of this doc.)

### 2. Browser windows
- **Window A — PLAYER:** Chrome full screen 1920×1080. This is "me as trader Alice".
  - Pre-set `localStorage`: `userId=demo_alice`, `displayName=Alice`
  - (Do via DevTools → Application → Local Storage on perpwars.vercel.app)
- **Window B — SPECTATOR:** Chrome incognito, 1920×1080. "Me as watcher RichW".
  - Pre-set `localStorage`: `userId=richwatcher`, `displayName=RichW`
  - RichW has 170 Tidal Points pre-earned, enough for tipping demo

### 3. Recording setup
- **Screen recorder:** OBS Studio (free) or Loom. Set mic input, system audio ON
  (to capture ambient ocean + trade SFX)
- **Cursor highlighter:** Mouseposé (Mac) / KatMouse (Windows) — optional but helpful
- **Close:** notifications, other tabs, Slack/Discord dock badges
- **Volume:** speakers up loud enough to hear ambient sound in recording

### 4. Script-ready tabs
Pre-open these in Window A (hidden behind main arena, switch via Cmd+Tab when needed):
- Homepage: `https://perpwars.vercel.app`
- Admin diag: `https://perpwars.vercel.app/api/admin` (pretty-printed JSON)
- Mainnet builder proof: `https://api.pacifica.fi/api/v1/builder/overview?account=F39nNrR1Jw5cGGSndxKTeugbHErw5iz1Ev4864KJxcof`

---

## SHOT LIST — SCENE BY SCENE

Record each scene as a separate clip if easier, stitch in editor. Timing is
target; feel free to trim in post.

---

### Scene 1 — Hook (0:00–0:40) · Homepage entry

**Action:** Open homepage fresh. Pause on hero. Scroll slowly past stats, past
arenas, past Hall of Captains. Don't click anything.

**Narration:**

> *"Perpetual futures trading is a lonely sport. You open a position, you stare at your own P&L, you close, you repeat. There's no arena, no audience, no stakes beyond your own trade."*
>
> *"We built Tidal Wars to change that. It's real-time multiplayer tournaments on Pacifica. Traders compete in time-boxed arenas. Watchers back their favorites with skin in the game. Everyone climbs a points ladder across every match they play."*

**Camera cues:**
- 0:00–0:05 hero: "TIDAL WARS" logotype
- 0:05–0:15 scroll to stats
- 0:15–0:25 scroll past active arenas (shows LIVE + LOBBY badges)
- 0:25–0:40 scroll to Hall of Captains (persistent cross-arena leaderboard)

---

### Scene 2 — Solution overview (0:40–1:15)

**Action:** Still on homepage, scroll up to "How It Works" section. Pause on each step.

**Narration:**

> *"Tidal Wars runs on Pacifica's perpetuals infrastructure. Three steps: join an arena, trade on Pacifica with live on-chain prices, climb the ladder. Every order carries our builder code — real Pacifica fee revenue, real trader attribution."*
>
> *"What makes it social: every participant shows up as a ship on an ocean. The ship floats at their P&L height. Winners ride big waves. Losers sink. Watchers can tip their favorites and get a kickback if the backed trader wins."*

**Camera cues:**
- Linger on 3 "How It Works" tiles (01/02/03)
- Scroll to ended arenas briefly

---

### Scene 3 — Live product walkthrough (1:15–5:00) · THE MEAT

**Action:** Click into the pre-seeded arena. Let OceanBattle render. Pause.

#### 3a. OceanBattle introduction (1:15–1:45)

**Narration:**

> *"This is the arena. Four traders. You can see Alice at the top, she's up four percent on BTC. Bob at the bottom, he shorted and the price went against him, his ship is literally sinking. Carol mid-table, Dan trading ETH. The ships ride the same wave animation beneath them — the wave amplitude scales with session volatility. If BTC spikes three percent, storm mode kicks in. Six percent, tsunami. The audio soundtrack does the same thing."*

**Camera cues:**
- Full-screen OceanBattle view
- Hover over Alice's ship (shows tooltip or just trace with cursor)
- Hover over Bob's sinking ship — point out the bubble trail
- Wait for one wave cycle to visibly move ships

#### 3b. Trade interaction (1:45–2:30)

**Action:** Select ETH symbol. Click Virtual mode (already default). Click LONG. Show trade modal if applicable, otherwise trade fires immediately with flash + sound.

**Narration:**

> *"Let me open a position. I'll go long ETH, 0.1 at 5x. Size presets let me go 25, 50, 75, or max of my available margin. Keyboard shortcut L does the same thing. Watch the screen."*
>
> *[trade fires]*
>
> *"Green flash, bubble sound, my ship appears on ETH, balance deducted. Position impact preview showed exactly what my new equity ratio would be. No surprises."*

**Camera cues:**
- Click symbol tabs, select ETH (price shows live)
- Point at size preset buttons before clicking "50%"
- Click LONG green button — let the flash + sound land
- Point to new ship appearing in OceanBattle (switch to Battle view if on Candles)

#### 3c. Pacifica signing proof (2:30–3:15)

**Action:** Switch to TESTNET mode at the top of trade form. Click LONG again.
Signing modal opens. Pause.

**Narration:**

> *"This is the part where I prove Pacifica isn't a prop. Switch to testnet mode. Click long. This modal pops up — this is not a mockup. This JSON right here is the exact canonical message my wallet is about to sign. Alpha-sorted keys, compact serialization, builder code TIDALWARS in the payload. The signature section will be filled by my Privy Solana wallet via `useSignMessage` — the private key never leaves the Privy iframe. The server just relays the signed body to Pacifica's `/orders/create_market`."*
>
> *"Cancel for now — but this works end-to-end."*

**Camera cues:**
- Top of trade form: click TESTNET toggle (gold pill)
- Click LONG — SigningModal opens
- Hover over the canonical JSON block (block 1 — teal label "CANONICAL MESSAGE TO SIGN")
- Hover over HTTP body block (block 2 — gold label with builder_code=TIDALWARS)
- Click Cancel

#### 3d. Agent keys + fast trading (3:15–3:45)

**Action:** In header, click the gold "⚡ FAST TRADE" button. Privy modal pops (or
shows "Bind failed, session mode" fallback).

**Narration:**

> *"Even better: agent keys. I click Fast Trade, sign once with Privy, and the app generates an ephemeral session keypair that auto-signs every subsequent trade — no more modal per order. Pacifica endpoint `/agent/bind` registers it. If my account isn't whitelisted on Pacifica mainnet, we fall back gracefully to a local session mode so the UX still works for demos."*
>
> *"Badge turns green when bound. Now I can trade at keyboard speed."*

**Camera cues:**
- Highlight FAST TRADE button before click
- Show either AGENT (green) or SESSION (gold) badge after bind
- (Optional) press L to long-ETH via keyboard to show no-modal speed

#### 3e. Spectator mode + tipping (3:45–4:30)

**Action:** Switch to Window B (spectator browser). They're logged in as
RichW with 170 pts. Show spectator banner. Click a ship's 🎁.

**Narration:**

> *"Now I'm going to open a second window as a watcher. Not a trader — a spectator. I see the WATCHER MODE banner up top. I can chat, I can scrub replays, and I can tip any trader here."*
>
> *"Let me back Alice, she's winning. Click her 🎁 button."*
>
> *[TipModal opens]*
>
> *"Here's the interesting part: this is a bet. I put 50 Tidal Points on Alice. If she places first, I get 100 back — 2x kickback. Second place, 1.5x. Third, 1x. Fourth or worse, I lose the tip. It's asymmetric payoff — watching becomes gambling on your favorite trader, but with off-chain points, no smart contract, zero financial risk."*
>
> *[send tip — floating +50 🎁 appears over Alice's ship in real-time]*

**Camera cues:**
- Window B enters arena
- Orange/yellow WATCHER MODE banner with 👁
- Hover over Alice's ship, point out 🎁 button
- Click 🎁, modal opens
- Point at kickback tier table
- Click 50 preset, click GIFT
- (Switch back to Window A quickly to show the animation landed on Alice's ship there too — **real-time cross-client sync via SSE**)

#### 3f. Chart views + Elfa KOL heat (4:30–5:00)

**Action:** Back on Window A. Toggle between Battle / Candles / Tide views.

**Narration:**

> *"Three chart views. Battle I already showed you. Here's real Pacifica OHLC candles from the `/kline` endpoint — 1 min, 5 min, 15 min, 1 hour intervals. Each candle is a real on-chain trade aggregation. Entry prices overlaid as dashed lines. Current price pill on the right edge."*
>
> *"And here's where Elfa AI comes in — the bar at the top of each symbol shows KOL heat. That's the top-mentions endpoint from Elfa v2. BTC is trending on social, the bar goes green to gold to red as attention climbs. Traders can combine price action with sentiment signal."*

**Camera cues:**
- Click 📊 CANDLES tab
- Click interval switcher 1m→5m→15m
- Point at entry-price dashed overlay
- Scroll up to show Elfa KOL HEAT bar (if present for current symbol)

---

### Scene 4 — Pacifica integration proof (5:00–5:45)

**Action:** Open Admin diag tab. Show JSON output.

**Narration:**

> *"Let me show you the integration is not just talk. This is `/api/admin` — a diagnostic endpoint I built into the app."*
>
> *"Line 3 — signed public key derives to the expected address. Line 5 — builder code TIDALWARS. Line 7 — mainnet builder overview from Pacifica's actual API. My wallet `F39nN` at fee rate 0.0005, that's 0.05%. Every order routed through my code earns me a share of Pacifica fees on mainnet."*
>
> *"Six Pacifica endpoints wired: prices, kline, account, builder_codes/approve, agent/bind, orders/create_market. Plus WebSocket for mark prices. Ed25519 signing matches the Python SDK byte-for-byte, tested live."*

**Camera cues:**
- Switch to admin tab
- Highlight `pubkey`, `builderCode`, `mainnetBuilderOverview.address`, `mainnetBuilderOverview.fee_rate`
- (Optional) switch to mainnet builder overview tab showing same fee_rate directly from Pacifica

---

### Scene 5 — Settle flow + rewards (5:45–6:30)

**Action:** Back on arena, trigger manual end (or fast-forward to a pre-settled arena).

Easier: record this part using a 1-minute arena you've already settled, navigate to its winner URL.

**Narration:**

> *"When the timer hits zero, settlement runs. Winner crowned with their ocean rank — Alice here is a Kraken, top-tier. Tidal Points awarded: 115 to her for first place. Plus — if anyone backed her with tips, they get kickbacks. This is that card. Someone tipped Alice 50 points, got 100 back."*
>
> *"Twenty achievements unlockable per arena. First Blood, Whale Size, Comeback Kid, Shark Attack. Gallery view shows what you earned, what's locked."*
>
> *"Replay button. Scrub through every trade from minute zero to finish, leaderboard reconstructs at each timestamp, candle chart overlays the dominant symbol's price action. Pure event sourcing — no state stored per-tick."*

**Camera cues:**
- Winner card with 🐙 Kraken emoji + name
- YOUR REWARDS card showing +115 pts
- BACKING PAYOUT card showing tip kickback (if tipping was demoed in scene 3)
- Achievements gallery grid
- Click REPLAY ARENA button, modal opens
- Drag timeline scrubber left-to-right
- Candle chart with playhead moving

---

### Scene 6 — Value / Impact (6:30–7:00)

**Action:** Back on homepage or hero view.

**Narration:**

> *"Who uses this? Active traders who want a competition layer. Crypto communities — imagine a Solana Discord running weekly tournaments. And spectators — anyone can watch, tip, and back favorites without risking real money but still feeling invested."*
>
> *"For Pacifica: top-of-funnel for new users, volume driver via the builder code, social layer they don't have to build. Four sponsor tools integrated — Pacifica core, Privy wallets, Elfa AI for sentiment, Fuul for events. Upstash Redis for cross-instance state."*

**Camera cues:**
- Homepage hero
- Scroll through stats row
- Scroll to "POWERED BY" integration badges in settings menu (optional — open Arena Settings dropdown)

---

### Scene 7 — What's next + close (7:00–7:45)

**Narration:**

> *"Three things we'd ship next. One: real USDC tips via Solana SPL transfer — our tip system is asset-agnostic, swap one function, tips become real money, still no smart contract needed. Two: prize pool staking via Pacifica subaccount escrow — reuses Pacifica's existing primitives as natural escrow. Three: shareable arena result PNGs so winning becomes a Twitter moment."*
>
> *"Builder code is live on mainnet. The moment real USDC enters arenas, every trade becomes real Pacifica fee revenue."*
>
> *"Tidal Wars. Perpetual futures but as a multiplayer game. Try it at perpwars.vercel.app. Thanks."*

**Camera cues:**
- Simple hero shot, static
- Fade to URL

---

## POST-PRODUCTION CHECKLIST

- [ ] Trim dead air (pauses > 1.5s)
- [ ] Add text overlays for key URLs (perpwars.vercel.app at open + close)
- [ ] Add text overlay on scene 4 highlighting the mainnet fee_rate (`0.0005 = 0.05%`)
- [ ] Background music: OPTIONAL. The app has built-in ambient sound — turn it on
  before recording and let that be the soundtrack. Don't layer music on top.
- [ ] Export at 1080p H.264, target 100-200 MB
- [ ] Upload to Google Drive (per DoraHacks format requirement: Google Drive link)
- [ ] Set Drive permissions: "Anyone with the link can view"
- [ ] Test link in incognito before submitting

---

## COMMON PITFALLS

- **Dead-empty OceanBattle**: If you start from a brand-new arena, no ships.
  Always use the pre-seeded arena URL or re-seed via the script below.
- **Silent ambient**: Click anywhere once before recording — browsers gate
  audio until first user interaction.
- **Cache-busting**: If UI looks stale, Ctrl+Shift+R to hard refresh before recording.
- **Window cropping**: Verify recorded area in OBS preview before hitting Record.
- **Mic gain**: Test a 10-second clip first, make sure narration is audible
  over the ambient sound.

---

## RE-SEED DEMO ARENA (bash)

If the 24h TTL kills the current demo arena, regenerate:

```bash
BASE="https://perpwars.vercel.app/api"

COMP=$(curl -s -X POST "$BASE/competitions" -H "Content-Type: application/json" \
  -d '{"name":"Demo Showcase","creatorId":"demo_alice","durationMinutes":30}')
CID=$(echo $COMP | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

for n in "demo_alice:Alice" "demo_bob:Bob" "demo_carol:Carol" "demo_dan:Dan"; do
  curl -s -X POST "$BASE/competitions/$CID" -H "Content-Type: application/json" \
    -d "{\"userId\":\"${n%%:*}\",\"displayName\":\"${n##*:}\"}" > /dev/null
done

curl -s -X POST "$BASE/competitions/$CID" -H "Content-Type: application/json" \
  -d '{"action":"open","userId":"demo_alice","displayName":"Alice","symbol":"BTC","side":"bid","amount":0.01,"leverage":5,"currentPrice":75000,"mode":"virtual"}' > /dev/null
curl -s -X POST "$BASE/competitions/$CID" -H "Content-Type: application/json" \
  -d '{"action":"open","userId":"demo_bob","displayName":"Bob","symbol":"BTC","side":"ask","amount":0.005,"leverage":10,"currentPrice":75000,"mode":"virtual"}' > /dev/null
curl -s -X POST "$BASE/competitions/$CID" -H "Content-Type: application/json" \
  -d '{"action":"open","userId":"demo_carol","displayName":"Carol","symbol":"BTC","side":"bid","amount":0.02,"leverage":3,"currentPrice":75200,"mode":"virtual"}' > /dev/null
curl -s -X POST "$BASE/competitions/$CID" -H "Content-Type: application/json" \
  -d '{"action":"open","userId":"demo_dan","displayName":"Dan","symbol":"ETH","side":"bid","amount":0.1,"leverage":5,"currentPrice":2350,"mode":"virtual"}' > /dev/null

echo "Demo arena: https://perpwars.vercel.app/arena/$CID"
```

---

## DORAHACKS SUBMISSION FIELDS

When submitting, paste these answers:

- **Project name:** Tidal Wars
- **Track:** Social & Gamification
- **Short description (1 line):** Real-time PvP perpetual futures tournaments on Pacifica — traders compete, watchers back favorites with points kickback.
- **Live demo URL:** https://perpwars.vercel.app
- **GitHub:** https://github.com/PugarHuda/tidalwars
- **Demo video:** (Google Drive link after upload)
- **Pacifica integration:** Full list in README § "Pacifica integration depth"
