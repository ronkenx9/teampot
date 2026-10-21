import { Redis } from '@upstash/redis'
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PilotLedger } from './pilot-types.js'
export type Role = 'owner' | 'finance' | 'lead' | 'employee' | 'contractor'
export type Membership = { id: string; userId: string; workspaceId: string; role: Role; departmentId?: string; title: string; active: boolean }
export type Directory = {
 version: number
 users: { id: string; name: string; createdAt: number; credentials: { id: string; publicKey: string; counter: number; transports?: string[] }[] }[]
 workspaces: { id: string; name: string; createdAt: number; createdBy: string }[]
 departments: { id: string; workspaceId: string; name: string }[]
 memberships: Membership[]
 invites: { id: string; hash: string; workspaceId: string; departmentId?: string; role: Exclude<Role,'owner'>; title: string; name: string; createdBy: string; expiresAt: number; usedBy?: string; revoked?: boolean }[]
 sessions: { hash: string; userId: string; membershipId?: string; expiresAt: number; kind?: 'mobile' }[]
 mobilePairings?: { id: string; secretHash: string; userCode: string; expiresAt: number; userId?: string; membershipId?: string; tokenHash?: string; sessionExpiresAt?: number }[]
 pilot?: PilotLedger
 challenges: { hash: string; challenge: string; kind: 'register' | 'login'; userId?: string; name?: string; origin: string; expiresAt: number }[]
 audit: { id: string; workspaceId: string; actorId: string; action: string; at: number }[]
 limits: Record<string,{ count: number; until: number }>
}
export const emptyDirectory = (): Directory => ({ version:0,users:[],workspaces:[],departments:[],memberships:[],invites:[],sessions:[],challenges:[],audit:[],limits:{} })
export interface DirectoryStore { read(): Promise<Directory>; change<T>(fn:(data:Directory)=>T|Promise<T>):Promise<T> }
const unavailable = () => Object.assign(new Error('Account storage is temporarily unavailable. Please try again.'),{status:503})
export function createDirectoryStore(): DirectoryStore {
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL, token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN
 const redis=url&&token?new Redis({url,token}):null
 const key=`${process.env.TEAMPOT_STORAGE_NAMESPACE||'teampot'}:real-accounts:v1`
 const file=process.env.TEAMPOT_ACCOUNTS_FILE||'data/real-accounts.json'
 let queue:Promise<unknown>=Promise.resolve()
 const read=async()=>{
  if(redis){try{return await redis.get<Directory>(key)||emptyDirectory()}catch{throw unavailable()}}
  if(process.env.VERCEL||process.env.NODE_ENV==='production')throw unavailable()
  try{return JSON.parse(readFileSync(file,'utf8')) as Directory}catch(e:any){if(e.code==='ENOENT')return emptyDirectory();throw unavailable()}
 }
 return {read,change:async<T>(fn:(s:Directory)=>T|Promise<T>)=>{
  const run=async()=>{
   for(let attempt=0;attempt<8;attempt++){
    const state=await read(),version=state.version;const result=await fn(state);state.version=version+1
    if(redis){let ok;try{ok=await redis.eval(`local x=redis.call('GET',KEYS[1]); local v=0; if x then v=cjson.decode(x).version end; if v~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1`,[key],[version,JSON.stringify(state)])}catch{throw unavailable()}if(Number(ok)!==1)continue}
    else{mkdirSync(dirname(file),{recursive:true});const temp=`${file}.${randomUUID()}.tmp`;writeFileSync(temp,JSON.stringify(state),{mode:0o600});renameSync(temp,file)}
    return result
   }
   throw Object.assign(new Error('Your workspace changed. Please try again.'),{status:409})
  }
  const pending=queue.then(run);queue=pending.catch(()=>{});return pending
 }}
}
