import 'dotenv/config'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createWorkspaceApp } from '../server/workspaces.js'
import { createDirectoryStore } from '../server/workspace-store.js'
import { createPilotTempoAdapter } from '../server/pilot-tempo.js'
import { createClient, http, erc20Abi, parseEventLogs } from 'viem'
import { tempoModerato } from 'viem/tempo/chains'

assert.notEqual(process.env.TEMPO_NETWORK, 'mainnet', 'Refusing mainnet')
assert(!process.env.VERCEL, 'This verification is a local isolated fixture')
for (const name of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN']) delete process.env[name]
process.env.TEAMPOT_ACCOUNTS_FILE = 'data/company-pilot-live.json'
const adapter = createPilotTempoAdapter(), store = createDirectoryStore(), app = createWorkspaceApp(store, adapter)
const evidenceFile = '../work/company-pilot/evidence.json', fixtureFile = 'data/company-pilot-fixture.json'
const client = createClient({ chain: tempoModerato, transport: http(undefined, { retryCount: 3, retryDelay: 500 }) })
const hash = (s:string) => createHash('sha256').update(s).digest('hex')
const save = (path:string,value:unknown) => writeFileSync(path,JSON.stringify(value,null,2),{mode:0o600})
if (process.argv.includes('--verify')) {
 assert(existsSync(evidenceFile), 'Run pilot-live.ts --run before verification')
 const evidence = JSON.parse(readFileSync(evidenceFile,'utf8'))
 assert.equal(Number(await client.request({method:'eth_chainId'})),42431)
 assert.equal(evidence.companies.length,2)
 assert.notEqual(evidence.companies[0].treasury,evidence.companies[1].treasury)
 assert.notEqual(evidence.companies[0].department,evidence.companies[1].department)
 for (const company of evidence.companies) {
  assert(company.isolationChecked && company.retryChecked && company.revocationChecked && company.heldChecked)
  for (const op of company.receipts) {
   const receipt:any=await client.request({method:'eth_getTransactionReceipt',params:[op.tx]})
   assert.equal(receipt?.status,'0x1',`Receipt ${op.kind} failed`)
   assert.equal(receipt.transactionHash.toLowerCase(),op.tx.toLowerCase())
   if (op.kind==='spend'||op.kind==='approve') {
    const logs=receipt.logs.map((l:any)=>({...l,blockNumber:BigInt(l.blockNumber),logIndex:Number(l.logIndex),transactionIndex:Number(l.transactionIndex)}))
    const transfers=parseEventLogs({abi:erc20Abi,eventName:'Transfer',logs})
    assert(transfers.some(l=>l.address.toLowerCase()===adapter.token&&l.args.from.toLowerCase()===company.department.toLowerCase()&&l.args.to.toLowerCase()===op.to.toLowerCase()&&l.args.value===BigInt(Math.round(op.amount*1e6))))
   }
  }
 }
 console.log('two-company testnet evidence verified');process.exit(0)
}
assert(process.argv.includes('--run'),'Use --run or --verify')
mkdirSync('data',{recursive:true});mkdirSync('../work/company-pilot',{recursive:true})
const fixture:any=existsSync(fixtureFile)?JSON.parse(readFileSync(fixtureFile,'utf8')):{companies:[],steps:{}}
const persist=()=>save(fixtureFile,fixture)
const request=async(path:string,token:string,body?:unknown)=>{
 const r=await app.request('https://pilot.test'+path,{method:body===undefined?'GET':'POST',headers:{cookie:`tp_account=${token}`,origin:'https://pilot.test','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
 const data=await r.json();return {status:r.status,data}
}
const ok=async(path:string,token:string,body?:unknown)=>{const r=await request(path,token,body);assert(r.status<300,`${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data}
for(let index=0;index<2;index++) {
 if(fixture.companies[index])continue
 const group:any={name:`Pilot verification ${index?'B':'A'}`,users:{}}
 for(const role of ['owner','lead','employee']) {
  const token=randomUUID(),id=randomUUID();group.users[role]={id,token}
  await store.change(s=>{s.users.push({id,name:`${group.name} ${role}`,createdAt:Date.now(),credentials:[]});s.sessions.push({hash:hash(token),userId:id,expiresAt:Date.now()+7*86400000})})
 }
 const company=await ok('/workspaces',group.users.owner.token,{name:group.name});group.id=company.id
 const dept=await ok('/departments',group.users.owner.token,{workspaceId:company.id,name:'Design'});group.departmentId=dept.id
 for(const role of ['lead','employee']) {
  const inv=await ok('/invites',group.users.owner.token,{workspaceId:company.id,departmentId:dept.id,role,title:role,name:`${group.name} ${role}`})
  await ok('/invites/'+inv.inviteLink.split('/').pop()+'/accept',group.users[role].token,{})
  const session=await ok('/session',group.users[role].token);group.users[role].membershipId=session.activeMembershipId
 }
 fixture.companies.push(group);persist()
}
async function act(group:any,key:string,role:string,fields:any) {
 const step=`${group.id}:${key}`
 const body=fixture.steps[step] ||= {workspaceId:group.id,requestId:randomUUID(),...fields};persist()
 let result:any
 for(let attempt=0;attempt<5;attempt++) {
  result=await ok('/pilot/actions',group.users[role].token,body)
  if(result.status!=='pending')break
  console.log(`${group.name}: ${key} awaiting confirmation`)
  await new Promise(r=>setTimeout(r,1500))
 }
 console.log(`${group.name}: ${key} ${result.status}${result.tx?' '+result.tx:''}`)
 if(fields.action==='spend'&&key==='held')assert.equal(result.status,'held',JSON.stringify(result))
 else assert.equal(result.status,'confirmed',JSON.stringify(result))
 return {body,result}
}
const evidence:any={network:'testnet',chainId:42431,at:new Date().toISOString(),companies:[]}
for(const group of fixture.companies) {
 const other=fixture.companies.find((c:any)=>c.id!==group.id)
 await act(group,'provision','owner',{action:'provision'})
 await act(group,'fund','owner',{action:'fund',departmentId:group.departmentId,amount:500})
 await act(group,'delegate','owner',{action:'delegate',departmentId:group.departmentId,membershipId:group.users.lead.membershipId})
 const issued=await act(group,'issue','lead',{action:'issue',departmentId:group.departmentId,membershipId:group.users.employee.membershipId,cap:50,allowedVendorIds:['vendor-1']})
 const cardId=issued.body.requestId
 const spent=await act(group,'spend','employee',{action:'spend',cardId,vendorId:'vendor-1',amount:3,note:'Company isolation test'})
 const retry=await ok('/pilot/actions',group.users.employee.token,spent.body);assert.equal(retry.tx,spent.result.tx)
 const stolen=await request('/pilot/actions',other.users.employee.token,{workspaceId:other.id,requestId:randomUUID(),action:'spend',cardId,vendorId:'vendor-1',amount:1,note:'Isolation check'})
 assert([404,409].includes(stolen.status),JSON.stringify(stolen))
 assert.equal((await request('/pilot/actions',group.users.owner.token,{workspaceId:other.id,requestId:randomUUID(),action:'fund',departmentId:other.departmentId,amount:1})).status,403)
 const held=await act(group,'held','employee',{action:'spend',cardId,vendorId:'vendor-2',amount:2,note:'Needs lead approval'})
 await act(group,'approve','lead',{action:'approve',heldId:held.body.requestId})
 await act(group,'revoke','lead',{action:'revoke',cardId})
 const denied=await request('/pilot/actions',group.users.employee.token,{workspaceId:group.id,requestId:randomUUID(),action:'spend',cardId,vendorId:'vendor-1',amount:1,note:'Revocation check'})
 assert.equal(denied.status,403)
 // Also bypass the HTTP layer to prove the revoked key is refused by Tempo.
 let chainRevoked=false
 try { const prepared=await adapter.prepare({workspaceId:group.id,operationId:randomUUID(),action:'spend',departmentId:group.departmentId,cardId,to:adapter.vendors(group.id)[0].address,amount:1,note:'Revoked key check'});const result=await adapter.submit(prepared);chainRevoked=result.status==='reverted' }
 catch(e:any){const cause=String(e.cause?.details||e.cause?.message||e.message);chainRevoked=/revoked|unauthorized|not authorized|KeyNotFound|AccessKey/i.test(cause)}
 assert(chainRevoked,'Revoked card must be refused by Tempo')
 await act(group,'undelegate','owner',{action:'undelegate',departmentId:group.departmentId})
 const view=await ok('/pilot',group.users.owner.token),employeeView=await ok('/pilot',group.users.employee.token)
 assert(employeeView.cards.every((c:any)=>c.membershipId===group.users.employee.membershipId));assert.equal(employeeView.treasury,null)
 assert.equal(view.receipts.filter((r:any)=>r.kind==='spend').length,1)
 const addresses=adapter.addresses(group.id,group.departmentId)
 evidence.companies.push({id:group.id,treasury:addresses.treasury,department:addresses.department,isolationChecked:true,retryChecked:true,revocationChecked:true,heldChecked:true,receipts:view.receipts.map((r:any)=>({...r,...(r.kind==='spend'?{to:adapter.vendors(group.id)[0].address}:r.kind==='approve'?{to:adapter.vendors(group.id)[1].address}:{})}))})
 save(evidenceFile,evidence)
}
console.log('two-company live flow complete; run --verify for independent receipt checks')
