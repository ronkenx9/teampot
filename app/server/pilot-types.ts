import type { Context, Hono } from 'hono'
import type { Directory, DirectoryStore, Membership } from './workspace-store.js'

export type PilotAction = 'provision' | 'fund' | 'delegate' | 'undelegate' | 'issue' | 'spend' | 'approve' | 'decline' | 'revoke'
export type PilotInput = { workspaceId: string; requestId: string; action: PilotAction; departmentId?: string; membershipId?: string; cardId?: string; heldId?: string; amount?: number; cap?: number; allowedVendorIds?: string[]; vendorId?: string; note?: string }
export type PilotCommand = {
  workspaceId: string; operationId: string; action: PilotAction; departmentId?: string;
  membershipId?: string; headMembershipId?: string; cardId?: string; amount?: number;
  cap?: number; vendorAddresses?: string[]; to?: string; note?: string
}
export type PreparedPilotTransaction = { raw: string; hash: string }
export type PilotChainResult = { status: 'confirmed' | 'reverted' | 'pending'; tx: string; error?: string }
export type PilotVendor = { id: string; name: string; address: string }
export interface PilotAdapter {
  network: 'testnet'; chainId: number; token: string;
  addresses(workspaceId: string, departmentId?: string, membershipId?: string, cardId?: string): { treasury: string; department?: string; headKey?: string; cardKey?: string };
  vendors(workspaceId: string): PilotVendor[];
  balances(addresses: string[]): Promise<Record<string, number>>;
  prepare(command: PilotCommand): Promise<PreparedPilotTransaction>;
  submit(prepared: PreparedPilotTransaction): Promise<PilotChainResult>;
  status(prepared: PreparedPilotTransaction): Promise<PilotChainResult>;
}
export type PilotCard = { id: string; departmentId: string; membershipId: string; keyAddress: string; cap: number; allowedVendorIds: string[]; active: boolean; tx?: string; issuedBy: string; createdAt: number; revokePending?: boolean }
export type PilotHeld = { id: string; departmentId: string; membershipId: string; userId: string; cardId: string; vendorId: string; amount: number; note: string; status: 'held' | 'paid' | 'declined'; reason?: string; tx?: string; at: number }
export type PilotReceipt = { id: string; kind: PilotAction; departmentId?: string; membershipId?: string; amount?: number; tx: string; at: number }
export type PilotOperation = {
  id: string; action: PilotAction; fingerprint: string; input: PilotInput; actorUserId: string; actorMembershipId: string;
  status: 'preparing' | 'prepared' | 'pending' | 'confirmed' | 'held' | 'failed'; command: PilotCommand;
  prepared?: PreparedPilotTransaction; tx?: string; error?: string; createdAt: number; updatedAt: number;
  lease?: { token: string; until: number };
}
export type PilotDepartment = { id: string; headMembershipId?: string; headKey?: string; headTx?: string; headRevoking?: boolean; retiredHeads?: string[] }
export type PilotWorkspace = { ready: boolean; departments: Record<string, PilotDepartment>; cards: PilotCard[]; requests: PilotHeld[]; receipts: PilotReceipt[]; operations: PilotOperation[] }
export type PilotLedger = { workspaces: Record<string, PilotWorkspace> }
export type PilotActor = { user: Directory['users'][number]; session: Directory['sessions'][number]; m: Membership }
export type PilotAuth = (directory: Directory, context: Context, workspaceId?: string) => PilotActor
export type PilotActionResult = { status: 'confirmed' | 'held' | 'pending' | 'failed'; operationId: string; tx?: string; message?: string }
export type PilotRegister = (app: Hono, store: DirectoryStore, adapter: PilotAdapter, auth: PilotAuth) => void
