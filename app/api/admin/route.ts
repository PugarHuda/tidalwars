import { NextRequest, NextResponse } from 'next/server'
import { getDemoKeypair, approveBuilderCode, getAccountInfo } from '@/lib/pacifica'

// One-time setup endpoint — approve builder code and check account status
export async function GET(req: NextRequest) {
  const keypair = getDemoKeypair()
  if (!keypair) return NextResponse.json({ error: 'No demo keypair configured' }, { status: 500 })

  const pubkey = keypair.publicKey.toBase58()
  const [accountInfo, builderResult] = await Promise.all([
    getAccountInfo(pubkey),
    approveBuilderCode(keypair, process.env.PACIFICA_BUILDER_CODE ?? 'tidalwars'),
  ])

  return NextResponse.json({
    pubkey,
    account: accountInfo,
    builderCodeApproval: builderResult,
  })
}
