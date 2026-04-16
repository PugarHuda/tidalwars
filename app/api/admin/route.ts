import { NextRequest, NextResponse } from 'next/server'
import { getDemoKeypair, approveBuilderCode, getAccountInfo, keypairFromBase58 } from '@/lib/pacifica'

const BUILDER_OWNER = 'F39nNrR1Jw5cGGSndxKTeugbHErw5iz1Ev4864KJxcof'
const MAINNET_API = 'https://api.pacifica.fi/api/v1'

async function getBuilderOverview(): Promise<unknown> {
  try {
    const res = await fetch(`${MAINNET_API}/builder/overview?account=${BUILDER_OWNER}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// Diagnostic endpoint — checks demo keypair + builder code + account status
export async function GET(_req: NextRequest) {
  const rawKey = process.env.PACIFICA_DEMO_PRIVATE_KEY
  const diag = {
    envVarPresent: Boolean(rawKey),
    envVarLength: rawKey?.length ?? 0,
    envVarPreview: rawKey ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}` : null,
    envVarTrimmedLen: rawKey?.trim().length ?? 0,
    decodeError: null as string | null,
    derivedPubkey: null as string | null,
  }

  if (rawKey) {
    try {
      const kp = keypairFromBase58(rawKey.trim())
      diag.derivedPubkey = kp.publicKey.toBase58()
    } catch (e) {
      diag.decodeError = String(e)
    }
  }

  const keypair = getDemoKeypair()
  if (!keypair) {
    return NextResponse.json({ error: 'getDemoKeypair returned null', diag })
  }

  const pubkey = keypair.publicKey.toBase58()
  const builderCode = (process.env.PACIFICA_BUILDER_CODE ?? 'TIDALWARS').trim()
  const [accountInfo, builderResult, mainnetBuilderOverview] = await Promise.all([
    getAccountInfo(pubkey),
    approveBuilderCode(keypair, builderCode, '0.001'),
    getBuilderOverview(),
  ])

  return NextResponse.json({
    pubkey,
    expectedPubkey: process.env.PACIFICA_DEMO_PUBLIC_KEY?.trim(),
    account: accountInfo,
    builderCode,
    builderOwnerWallet: BUILDER_OWNER,
    mainnetBuilderOverview,
    builderCodeApprovalTestnet: builderResult,
    diag,
    note: 'TIDALWARS is provisioned on Pacifica MAINNET. Testnet is used only for virtual competition prices.',
  })
}
