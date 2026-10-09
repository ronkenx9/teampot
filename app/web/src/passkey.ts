// Face ID / Touch ID spending: the device passkey is the person's spending key on the company account.
// The private key never leaves the device; the company only ever sees the public key.
import { http, pad, parseUnits, stringToHex } from 'viem'
import { Account, createClient, WebAuthnP256 } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
import { PublicKey } from 'ox'
import { Signature } from 'ox'
import { SignatureEnvelope } from 'ox/tempo'
import * as OxWebAuthn from 'ox/WebAuthnP256'

export const passkeysSupported = () => typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'

export async function enrollPasskey(personId: string, name: string) {
  const cred = await WebAuthnP256.createCredential({ label: `Teampot · ${name}` } as any)
  const r = await fetch('/api/passkey/enroll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, id: cred.id, publicKey: cred.publicKey }) })
  if (!r.ok) throw new Error((await r.json()).error || 'Could not turn on Face ID')
}

export async function createInvitePasskey(name: string) {
  return WebAuthnP256.createCredential({ label: `Teampot · ${name}` } as any)
}

export async function signInPasskey(personId: string, challenge: `0x${string}`, credentialId: string) {
  const { metadata, signature } = await OxWebAuthn.sign({ challenge, credentialId })
  return { personId, metadata, signature: Signature.toHex(signature as any) as `0x${string}` }
}

type PayInfo = { company: `0x${string}`; token: `0x${string}`; credentialId: string; publicKey: `0x${string}`; vendors: Record<string, `0x${string}`> }

/** Sign and send the payment on this device. Returns the tx hash, or { rejected } if the chain refused it. */
export async function payWithPasskey(personId: string, vendorId: string, amount: number, note: string) {
  const info: PayInfo = await fetch(`/api/passkey/pay-info/${personId}`).then((r) => r.json())
  const publicKey = PublicKey.fromHex(info.publicKey)
  const account = Account.from({
    access: info.company,
    keyType: 'webAuthn',
    publicKey,
    async sign({ hash }: { hash: `0x${string}` }) {
      const { metadata, signature } = await OxWebAuthn.sign({ challenge: hash, credentialId: info.credentialId })
      return SignatureEnvelope.serialize({ publicKey, metadata, signature, type: 'webAuthn' } as any)
    },
  } as any)
  const chain: any = (tempoModerato as any).extend({ feeToken: info.token })
  const client: any = createClient({ account, chain, transport: http(), testnet: true } as any)
  try {
    const { receipt } = await client.token.transferSync({
      token: info.token, to: info.vendors[vendorId], amount: parseUnits(String(amount), 6),
      memo: pad(stringToHex(note.slice(0, 31)), { size: 32, dir: 'right' }),
    })
    return { tx: receipt.transactionHash as string }
  } catch (e: any) {
    const msg = String(e?.shortMessage || e?.message || '')
    // A user cancelling Face ID is not a chain rejection.
    if (/NotAllowedError|cancel|abort/i.test(msg) || e?.name === 'NotAllowedError') throw new Error('Face ID was cancelled')
    return { rejected: true as const, reason: msg.split('\n')[0] }
  }
}
