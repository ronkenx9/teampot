import { Hono } from 'hono'
import { registerMobilePairing } from './mobile-pairing.js'
import { createPilotTempoAdapter } from './pilot-tempo.js'
import type { PilotAdapter } from './pilot-types.js'
import { registerPilotRoutes, assertMembershipChangeSafe } from './pilot.js'
import { bodyLimit } from 'hono/body-limit'
import { z, ZodError } from 'zod'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createDirectoryStore, type Directory, type DirectoryStore, type Membership, type Role } from './workspace-store.js'
const SESSION='tp_account', CHALLENGE='tp_account_challenge'
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const secret=()=>randomBytes(32).toString('base64url')
const fail=(status:number,message:string):never=>{throw Object.assign(new Error(message),{status})}
const cookie=(c:any,name:string)=>c.req.header('cookie')?.split(';').map((v:string)=>v.trim()).find((v:string)=>v.startsWith(name+'='))?.slice(name.length+1)||''
const setCookie=(c:any,name:string,value:string,age:number)=>c.header('set-cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${c.req.url.startsWith('https:')?'; Secure':''}`,{append:true})
const str=z.string().trim().min(1).max(100)
const grantRole=z.enum(['finance','lead','employee','contractor'])
function prune(s:Directory){const now=Date.now();s.challenges=s.challenges.filter(x=>x.expiresAt>now);s.sessions=s.sessions.filter(x=>x.expiresAt>now);for(const [k,v]of Object.entries(s.limits))if(v.until<now)delete s.limits[k]}
function throttle(s:Directory,key:string,max=30){const n=Date.now();const b=s.limits[key];if(b&&b.until>n){if(b.count>=max)fail(429,'Too many attempts. Please try again in a few minutes.');b.count++}else s.limits[key]={count:1,until:n+600000}}
function sessionToken(c:any){const authorization=c.req.header('authorization');if(authorization)return /^Bearer tpm_[A-Za-z0-9_-]{43}$/.test(authorization)?authorization.slice(7):'';return cookie(c,SESSION)}
function actor(s:Directory,c:any){const authorization=c.req.header('authorization');const session=s.sessions.find(x=>x.hash===hash(sessionToken(c))&&x.expiresAt>Date.now()&&(!authorization||x.kind==='mobile'));if(!session)return fail(401,'Sign in to your Teampot account.');const user=s.users.find(x=>x.id===session.userId);if(!user)return fail(401,'Sign in again.');return {user,session}}
function member(s:Directory,c:any,workspaceId?:string){const a=actor(s,c);const m=s.memberships.find(x=>x.id===a.session.membershipId&&x.userId===a.user.id&&x.active);if(!m||workspaceId&&workspaceId!==m.workspaceId)return fail(403,'You do not have access to this workspace.');return {...a,m}}
const manages=(m:Membership)=>m.role==='owner'||m.role==='finance'
function manager(s:Directory,c:any,w?:string){const a=member(s,c,w);if(!manages(a.m))fail(403,'Only the owner or Finance can manage this workspace.');return a}
function department(s:Directory,workspaceId:string,id?:string){if(!id||!s.departments.some(d=>d.id===id&&d.workspaceId===workspaceId))fail(400,'Choose a department in this workspace.')}
function audit(s:Directory,w:string,u:string,action:string){s.audit.push({id:randomUUID(),workspaceId:w,actorId:u,action,at:Date.now()})}
export function sessionView(s:Directory,c:any){const {user,session}=actor(s,c);const memberships=s.memberships.filter(m=>m.userId===user.id&&m.active).map(m=>({...m,workspaceName:s.workspaces.find(w=>w.id===m.workspaceId)?.name||'',departmentName:s.departments.find(d=>d.id===m.departmentId)?.name||''}));return {user:{id:user.id,name:user.name},memberships,activeMembershipId:memberships.find(m=>m.id===session.membershipId)?.id||null}}
function workspaceView(s:Directory,c:any){const {m}=member(s,c);const all=s.memberships.filter(x=>x.workspaceId===m.workspaceId&&x.active);const people=(manages(m)?all:m.role==='lead'?all.filter(x=>x.departmentId===m.departmentId):all.filter(x=>x.userId===m.userId)).map(x=>({...x,name:s.users.find(u=>u.id===x.userId)?.name||''}));return {workspace:s.workspaces.find(w=>w.id===m.workspaceId),membership:m,departments:s.departments.filter(d=>d.workspaceId===m.workspaceId&&(manages(m)||d.id===m.departmentId)),people,invites:s.invites.filter(i=>i.workspaceId===m.workspaceId&&(manages(m)||m.role==='lead'&&i.departmentId===m.departmentId)).map(({hash,...i})=>i),audit:manages(m)?s.audit.filter(a=>a.workspaceId===m.workspaceId).slice(-30).reverse():[],paymentsReady:!!s.pilot?.workspaces[m.workspaceId]?.ready}}
export function createWorkspaceApp(store:DirectoryStore=createDirectoryStore(),adapter:PilotAdapter=createPilotTempoAdapter()){
 const app=new Hono()
 app.use('*',bodyLimit({maxSize:32768,onError:c=>c.json({error:'Request too large.'},413)}))
 app.onError((e:any,c)=>c.json({error:e instanceof ZodError?'Please check the fields and try again.':e.status?e.message:'Unable to complete that request. Please try again.'},e instanceof ZodError?400:e.status||500))
 app.use('*',async(c,next)=>{c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer');if(c.req.method!=='GET'){const origin=c.req.header('origin');const path=new URL(c.req.url).pathname;const pairingPublic=/\/mobile\/(start|poll)$/.test(path);const nativeBearer=/^Bearer tpm_[A-Za-z0-9_-]{43}$/.test(c.req.header('authorization')||'')&&!/\/(register|login|mobile)\//.test(path);if(!pairingPublic&&!nativeBearer&&(!origin||origin!==new URL(c.req.url).origin))return c.json({error:'Open Teampot on this site to continue.'},403);if(!c.req.header('content-type')?.startsWith('application/json'))return c.json({error:'Expected JSON.'},415);const length=Number(c.req.header('content-length')||0);if(length>32768)return c.json({error:'Request too large.'},413)}await next()})
 app.get('/session',async c=>{const s=await store.read();try{return c.json(sessionView(s,c))}catch(e:any){if(e.status===401)return c.json({user:null,memberships:[],activeMembershipId:null});throw e}})
 app.post('/register/options',async c=>{
  const {name}=z.object({name:str}).parse(await c.req.json());const userId=randomUUID();const origin=new URL(c.req.url).origin,rpID=new URL(origin).hostname
  const options=await generateRegistrationOptions({rpName:'Teampot',rpID,userID:new TextEncoder().encode(userId),userName:name,userDisplayName:name,attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'}})
  const ticket=secret();await store.change(s=>{prune(s);throttle(s,'register:'+hash(c.req.header('x-forwarded-for')||'local'),15);s.challenges.push({hash:hash(ticket),kind:'register',userId,name,challenge:options.challenge,origin,expiresAt:Date.now()+300000})});setCookie(c,CHALLENGE,ticket,300);return c.json(options)
 })
 app.post('/login/options',async c=>{
  const origin=new URL(c.req.url).origin;const options=await generateAuthenticationOptions({rpID:new URL(origin).hostname,userVerification:'required'});const ticket=secret()
  await store.change(s=>{prune(s);throttle(s,'login:'+hash(c.req.header('x-forwarded-for')||'local'),50);s.challenges.push({hash:hash(ticket),kind:'login',origin,challenge:options.challenge,expiresAt:Date.now()+300000})});setCookie(c,CHALLENGE,ticket,300);return c.json(options)
 })
 for(const kind of ['register','login']as const)app.post(`/${kind}/verify`,async c=>{
  const response=await c.req.json();if(JSON.stringify(response).length>32768)fail(413,'Request too large.')
  // Consume before verifying: malformed/failed assertions cannot replay the challenge.
  const challenge=await store.change(s=>{const i=s.challenges.findIndex(x=>x.hash===hash(cookie(c,CHALLENGE))&&x.kind===kind&&x.expiresAt>Date.now());if(i<0)return fail(400,'This sign-in expired. Please try again.');return s.challenges.splice(i,1)[0]})
  const origin=new URL(c.req.url).origin;if(challenge.origin!==origin)fail(403,'Sign-in origin changed.')
  const token=secret();let uid='';let cred:any
  if(kind==='register'){
   let result;try{result=await verifyRegistrationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:new URL(origin).hostname,requireUserVerification:true})}catch{return fail(400,'Could not verify your passkey. Please try again.')}
   if(!result.verified||!result.registrationInfo)return fail(400,'Passkey verification failed.')
   uid=challenge.userId!;cred=result.registrationInfo.credential
   await store.change(s=>{if(s.users.some(u=>u.credentials.some(k=>k.id===cred.id)))fail(409,'That passkey is already registered. Sign in instead.');s.users.push({id:uid,name:challenge.name!,createdAt:Date.now(),credentials:[{id:cred.id,publicKey:Buffer.from(cred.publicKey).toString('base64url'),counter:cred.counter,transports:cred.transports}]});s.sessions.push({hash:hash(token),userId:uid,expiresAt:Date.now()+604800000})})
  }else{
   const s=await store.read();const u=s.users.find(u=>u.credentials.some(k=>k.id===response.id));cred=u?.credentials.find(k=>k.id===response.id);if(!u||!cred)return fail(401,'No Teampot account matches this passkey. Create an account first.')
   let result;try{result=await verifyAuthenticationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:new URL(origin).hostname,requireUserVerification:true,credential:{...cred,publicKey:new Uint8Array(Buffer.from(cred.publicKey,'base64url'))}})}catch{return fail(401,'Could not verify your passkey. Please try again.')}
   if(!result.verified)return fail(401,'Passkey verification failed.');uid=u.id
   await store.change(s=>{const k=s.users.find(x=>x.id===uid)?.credentials.find(k=>k.id===response.id);if(!k||k.counter!==cred.counter)fail(409,'Sign-in changed. Please try again.');k!.counter=result.authenticationInfo.newCounter;const membership=s.memberships.find(m=>m.userId===uid&&m.active);s.sessions.push({hash:hash(token),userId:uid,membershipId:membership?.id,expiresAt:Date.now()+604800000})})
  }
  setCookie(c,CHALLENGE,'',0);setCookie(c,SESSION,token,604800);return c.json({ok:true})
 })
 app.post('/logout',async c=>{await store.change(s=>{s.sessions=s.sessions.filter(x=>x.hash!==hash(sessionToken(c)))});setCookie(c,SESSION,'',0);return c.json({ok:true})})
 app.post('/switch',async c=>{const {membershipId}=z.object({membershipId:z.string().uuid()}).parse(await c.req.json());await store.change(s=>{const a=actor(s,c);if(!s.memberships.some(m=>m.id===membershipId&&m.userId===a.user.id&&m.active))fail(403,'That role has not been assigned to you.');a.session.membershipId=membershipId});return c.json({ok:true})})
 app.post('/workspaces',async c=>{const {name}=z.object({name:str}).parse(await c.req.json());const workspace=await store.change(s=>{const a=actor(s,c);throttle(s,'create:'+a.user.id,10);const w={id:randomUUID(),name,createdBy:a.user.id,createdAt:Date.now()};s.workspaces.push(w);const m:Membership={id:randomUUID(),userId:a.user.id,workspaceId:w.id,role:'owner',title:'Company owner',active:true};s.memberships.push(m);a.session.membershipId=m.id;audit(s,w.id,a.user.id,'Created the company');return w});return c.json(workspace,201)})
 app.get('/workspace',async c=>c.json(workspaceView(await store.read(),c)))
 app.post('/departments',async c=>{const body=z.object({workspaceId:z.string().uuid(),name:str}).parse(await c.req.json());return c.json(await store.change(s=>{const {user}=manager(s,c,body.workspaceId);if(s.departments.some(d=>d.workspaceId===body.workspaceId&&d.name.toLowerCase()===body.name.toLowerCase()))fail(409,'This department already exists.');const d={id:randomUUID(),...body};s.departments.push(d);audit(s,d.workspaceId,user.id,`Created ${d.name}`);return d}),201)})
 app.post('/invites',async c=>{
  const body=z.object({workspaceId:z.string().uuid(),role:grantRole,departmentId:z.string().uuid().optional(),title:str,name:str}).strict().parse(await c.req.json());const raw=secret()
  const result=await store.change(s=>{const {user,m}=member(s,c,body.workspaceId);throttle(s,'invite:'+user.id,40);if(!manages(m)&&!(m.role==='lead'&&body.departmentId===m.departmentId&&['employee','contractor'].includes(body.role)))fail(403,'You cannot grant that role or department.');if(body.role!=='finance')department(s,body.workspaceId,body.departmentId);else if(body.departmentId)department(s,body.workspaceId,body.departmentId);const invite={id:randomUUID(),hash:hash(raw),...body,createdBy:user.id,expiresAt:Date.now()+7*86400000};s.invites.push(invite);audit(s,m.workspaceId,user.id,`Invited ${body.name} as ${body.role}`);return {id:invite.id,expiresAt:invite.expiresAt}});return c.json({...result,inviteLink:`/join/${raw}`},201)
 })
 app.get('/invites/:token',async c=>{const s=await store.read();const i=s.invites.find(i=>i.hash===hash(c.req.param('token'))&&!i.revoked&&!i.usedBy&&i.expiresAt>Date.now());if(!i)return c.json({error:'This invite is expired, used, or revoked. Ask your company for a new link.'},404);return c.json({name:i.name,title:i.title,role:i.role,workspaceName:s.workspaces.find(w=>w.id===i.workspaceId)?.name,departmentName:s.departments.find(d=>d.id===i.departmentId)?.name,expiresAt:i.expiresAt})})
 app.post('/invites/:token/accept',async c=>{await store.change(s=>{const a=actor(s,c);const i=s.invites.find(i=>i.hash===hash(c.req.param('token'))&&!i.revoked&&!i.usedBy&&i.expiresAt>Date.now());if(!i)return fail(404,'This invite is expired, used, or revoked.');if(!s.memberships.some(m=>m.active&&m.userId===i.createdBy&&m.workspaceId===i.workspaceId&&(manages(m)||m.role==='lead'&&m.departmentId===i.departmentId&&['employee','contractor'].includes(i.role))))fail(403,'The inviter no longer has permission. Ask an administrator for a new invite.');if(s.memberships.some(m=>m.userId===a.user.id&&m.workspaceId===i.workspaceId&&m.role===i.role&&m.departmentId===i.departmentId&&m.active))fail(409,'You already have this role.');const m:Membership={id:randomUUID(),userId:a.user.id,workspaceId:i.workspaceId,departmentId:i.departmentId,role:i.role,title:i.title,active:true};s.memberships.push(m);i.usedBy=a.user.id;a.session.membershipId=m.id;audit(s,i.workspaceId,a.user.id,`Joined as ${m.role}`)});return c.json({ok:true})})
 app.post('/invites/:id/revoke',async c=>{await store.change(s=>{const {user,m}=member(s,c);const i=s.invites.find(i=>i.id===c.req.param('id')&&i.workspaceId===m.workspaceId);if(!i)return fail(404,'Invite not found.');if(!manages(m)&&!(m.role==='lead'&&m.departmentId===i.departmentId&&['employee','contractor'].includes(i.role)))fail(403,'You cannot revoke that invite.');i.revoked=true;audit(s,m.workspaceId,user.id,`Revoked invite for ${i.name}`)});return c.json({ok:true})})
 app.post('/members/:id',async c=>{
  const body=z.object({role:grantRole.optional(),departmentId:z.string().uuid().nullable().optional(),title:str.optional(),active:z.boolean().optional()}).strict().parse(await c.req.json())
  await store.change(s=>{const a=manager(s,c);const target=s.memberships.find(m=>m.id===c.req.param('id')&&m.workspaceId===a.m.workspaceId);if(!target)return fail(404,'Member not found.');if(target.role==='owner')fail(403,'The company owner cannot be changed or removed here.');if(target.userId===a.user.id)fail(403,'Ask another administrator to change your own access.');const role=body.role||target.role,dept=body.departmentId===undefined?target.departmentId:body.departmentId||undefined;if(role!=='finance')department(s,target.workspaceId,dept);else if(dept)department(s,target.workspaceId,dept);assertMembershipChangeSafe(s,target,{role,departmentId:dept,active:body.active??target.active});Object.assign(target,{role,departmentId:dept,title:body.title||target.title,active:body.active??target.active});audit(s,target.workspaceId,a.user.id,`${target.active?'Updated':'Removed'} access for ${s.users.find(u=>u.id===target.userId)?.name}`)});return c.json({ok:true})
 })
 registerMobilePairing(app,store,actor)
 registerPilotRoutes(app,store,adapter,member)
 return app
}
export const workspaceApp=createWorkspaceApp()
