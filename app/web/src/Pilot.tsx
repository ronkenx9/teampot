import { useCallback, useEffect, useRef, useState } from 'react'
import './pilot.css'

type Member = { id:string; userId:string; workspaceId:string; role:string; departmentId?:string; name?:string; active:boolean }
type Company = { workspace:{id:string;name:string}; membership:Member; people:Member[]; departments:{id:string;name:string}[] }
type Department = { id:string; name:string; address:string; balance:number; headMembershipId?:string; headRevoking?:boolean }
type Vendor = { id:string; name:string; address:string }
type Card = { id:string; departmentId:string; membershipId:string; name?:string; keyAddress:string; cap:number; allowedVendorIds:string[]; active:boolean; revokePending?:boolean; tx?:string }
type Held = { id:string; departmentId:string; membershipId:string; userId?:string; cardId:string; vendorId:string; amount:number; note:string; status:'held'|'paid'|'declined'; reason?:string; tx?:string }
type Receipt = { id:string; kind:string; departmentId?:string; membershipId?:string; amount?:number; tx:string; at:number }
type Operation = { id:string; action:string; status:string; error?:string; tx?:string }
type PilotState = { network:string; chainId:number; token:string; workspaceId:string; ready:boolean; treasury:{address:string;balance:number}|null; departments:Department[]; vendors:Vendor[]; cards:Card[]; requests:Held[]; receipts:Receipt[]; operations:Operation[] }
type Action = 'provision'|'fund'|'delegate'|'undelegate'|'issue'|'spend'|'approve'|'decline'|'revoke'
type Input = { action:Action; workspaceId:string; requestId:string; departmentId?:string; membershipId?:string; cardId?:string; heldId?:string; vendorId?:string; amount?:number; cap?:number; allowedVendorIds?:string[]; note?:string }
type Fields = Omit<Input,'workspaceId'|'requestId'>
type ActionResult = { status:'confirmed'|'held'|'pending'|'failed'; operationId:string; tx?:string; message?:string }
type Send = (fields:Fields)=>Promise<void>
const labels:Record<string,string> = { provision:'Company funded', fund:'Department funded', delegate:'Lead authorized', undelegate:'Lead authority revoked', issue:'Spending card issued', spend:'Payment', approve:'Request paid', decline:'Request declined', revoke:'Card revoked' }
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n)
const positive=(n:number)=>Number.isFinite(n)&&n>0
const short=(s:string)=>s?`${s.slice(0,6)}…${s.slice(-4)}`:''
const terminal=(s:string)=>['confirmed','held','failed'].includes(s)
const message=(e:unknown)=>e instanceof Error?e.message:'Please try again.'
class PilotError extends Error { constructor(message:string,public status:number){super(message)} }
async function request<T>(path:string,body?:unknown):Promise<T>{
 const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),90000)
 try{
  const response=await fetch('/api/accounts'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal})
  const data=await response.json().catch(()=>({error:'We could not read the response. Check the saved request before trying again.'}))
  if(!response.ok)throw new PilotError(data.error||'Please try again.',response.status)
  return data as T
 }finally{window.clearTimeout(timer)}
}
function readPending(key:string,workspaceId:string):Input|null{
 const text=localStorage.getItem(key);if(!text)return null
 let value:any;try{value=JSON.parse(text)}catch{throw new Error('The saved request could not be read. Use another device to check your activity before continuing.')}
 if(value?.workspaceId!==workspaceId||typeof value?.requestId!=='string'||typeof value?.action!=='string')throw new Error('The saved request could not be verified. Check your activity on another device before continuing.')
 return value
}
function RecordLink({tx,children='View record'}:{tx?:string;children?:React.ReactNode}){
 return tx&&/^0x[0-9a-f]{64}$/i.test(tx)?<a className="pilot-record" href={`https://explore.testnet.tempo.xyz/tx/${tx}`} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a>:null
}

export default function Pilot({company,userId,externalBusy=false,onBusyChange}:{company:Company;userId:string;externalBusy?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const storageKey=`teampot.pilot.request.v1:${userId}:${company.membership.id}:${company.workspace.id}`
 const [data,setData]=useState<PilotState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[fresh,setFresh]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState<Input|null>(null),[storageReady,setStorageReady]=useState(false)
 const flight=useRef(false),alive=useRef(true),pendingRef=useRef<Input|null>(null)
 const manage=['owner','finance'].includes(company.membership.role),lead=company.membership.role==='lead'
 const savePending=useCallback((value:Input|null)=>{
  if(value)localStorage.setItem(storageKey,JSON.stringify(value));else localStorage.removeItem(storageKey)
  pendingRef.current=value;if(alive.current)setPending(value)
 },[storageKey])
 const refresh=useCallback(async()=>{
  const next=await request<PilotState>('/pilot')
  if(next.workspaceId!==company.workspace.id)throw new Error('Your workspace changed. Refresh the page to continue in the correct company.')
  if(next.network!=='testnet')throw new Error('This beta only supports Tempo testnet. Payments are disabled.')
  if(!alive.current)return next
  setData(next);setFresh(true);setLoading(false)
  const current=pendingRef.current
  const op=current&&next.operations.find(o=>o.id===current.requestId)
  if(op&&terminal(op.status)){
   savePending(null)
   setNotice(op.status==='confirmed'?'Your saved request is confirmed.':op.status==='held'?'Your payment is waiting for approval.':op.error||'Your saved request was not completed.')
  }
  return next
 },[company.workspace.id,savePending])
 useEffect(()=>{
  alive.current=true
  try{const saved=readPending(storageKey,company.workspace.id);pendingRef.current=saved;setPending(saved);setStorageReady(true)}catch(e){setError(message(e))}
  void refresh().catch(e=>{if(alive.current){setError(message(e));setFresh(false);setLoading(false)}})
  const poll=()=>{if(!document.hidden&&!flight.current)void refresh().catch(e=>{if(alive.current){setFresh(false);setError(message(e))}})}
  const timer=window.setInterval(poll,15000)
  const changed=(event:StorageEvent)=>{if(event.key===storageKey){try{const saved=readPending(storageKey,company.workspace.id);pendingRef.current=saved;setPending(saved)}catch(e){setStorageReady(false);setError(message(e))}}}
  window.addEventListener('storage',changed);document.addEventListener('visibilitychange',poll)
  return()=>{alive.current=false;window.clearInterval(timer);window.removeEventListener('storage',changed);document.removeEventListener('visibilitychange',poll);onBusyChange?.(false)}
 },[refresh,storageKey,company.workspace.id])
 const execute=async(input:Input)=>{
  if(flight.current||externalBusy)return
  flight.current=true;setBusy(true);onBusyChange?.(true);setError('');setNotice('')
  let sent=false
  try{
   // Store before sending. The same signed transaction is reconciled on every retry.
   savePending(input);sent=true
   const result=await request<ActionResult>('/pilot/actions',input)
   if(result.operationId!==input.requestId)throw new Error('The response did not match this request. Check its status before continuing.')
   if(result.status!=='pending')savePending(null)
   if(alive.current)setNotice(result.message||(result.status==='confirmed'?'Confirmed on Tempo testnet.':result.status==='held'?'Sent to your approver. You will find the request below.':result.status==='pending'?'Still checking this request. You can safely retry the same request.':'This request was not completed.'))
   await refresh()
  }catch(e){
   if(alive.current){setError(message(e));setFresh(false)}
   // A completed HTTP validation refusal has not created a chain operation. A lost response remains saved.
   if(sent&&e instanceof PilotError&&[400,401,403,404,409,422].includes(e.status)){
    try{const next=await refresh();if(!next.operations.some(o=>o.id===input.requestId))savePending(null)}catch{}
   }
  }finally{flight.current=false;if(alive.current)setBusy(false);onBusyChange?.(false)}
 }
 const send:Send=async(fields)=>{
  if(!storageReady||!fresh||pendingRef.current||flight.current||externalBusy)return
  try{
   const saved=readPending(storageKey,company.workspace.id)
   if(saved){pendingRef.current=saved;setPending(saved);setNotice('Resolve your saved request before starting another.');return}
   await execute({...fields,workspaceId:company.workspace.id,requestId:crypto.randomUUID()})
  }catch(e){setError(message(e))}
 }
 const disabled=busy||externalBusy||!!pending||!fresh||!storageReady
 const person=(id:string)=>company.people.find(p=>p.id===id)?.name||'Team member'
 const departmentName=(id?:string)=>company.departments.find(d=>d.id===id)?.name||'Company'
 const vendorName=(id:string)=>data?.vendors.find(v=>v.id===id)?.name||'Test vendor'
 const visiblePending=data?.operations.filter(o=>!terminal(o.status))||[]
 const mine=data?.cards.filter(c=>c.membershipId===company.membership.id)||[]
 const waiting=data?.requests.filter(r=>r.status==='held')||[]
 return <section className="pilot" aria-labelledby="pilot-title" aria-busy={busy}>
  <div className="pilot-heading"><div><span className="pilot-eyebrow"><span/>TEMPO TESTNET · PRIVATE BETA</span><h2 id="pilot-title">Work money, together.</h2><p>Real team permissions. Test money only.</p></div><button className="pilot-refresh" disabled={busy||externalBusy} onClick={()=>{setError('');setLoading(true);void refresh().catch(e=>{setError(message(e));setFresh(false)}).finally(()=>setLoading(false))}}>{loading?'Refreshing…':'Refresh'}</button></div>
  {error&&<div className="pilot-alert pilot-alert-error" role="alert">{error}</div>}
  {notice&&<div className="pilot-alert" role="status">{notice}</div>}
  {pending&&<div className="pilot-pending" role="status"><div><b>One request needs a final answer.</b><p>Keep this request while we check the result. Retrying uses its original reference and cannot create another payment.</p><small>{labels[pending.action]||pending.action} · {pending.requestId.slice(0,8)}</small></div><button className="real-primary" disabled={busy||externalBusy} onClick={()=>void execute(pending)}>{busy?'Checking…':'Retry same request'}</button></div>}
  {!pending&&visiblePending.length>0&&<div className="pilot-alert">A company request is still being confirmed. Refresh shortly before starting another.</div>}
  {!data?<div className="pilot-empty">{loading?'Loading your company’s payment account…':'Your payment account is unavailable. Refresh to try again.'}</div>:<>
   {!data.ready?<div className="pilot-setup"><span className="pilot-step">01 / COMPANY ACCOUNT</span><h3>{manage?'Give your team room to try it.':'Your team’s spending starts here.'}</h3><p>{manage?'Create an isolated account for this company with $10,000 in test funds. Then add a department budget and authorize its lead.':'Your owner or Finance team needs to activate this company’s test account before you can use a spending card.'}</p>{manage&&<button className="real-primary" disabled={disabled} onClick={()=>void send({action:'provision'})}>{busy?'Setting up…':'Activate test account'}</button>}<small>Test funds have no cash value. No bank account or deposit is needed.</small></div>:
    <div className="pilot-overview"><div><span className="pilot-eyebrow">{manage?'COMPANY TEST BALANCE':'YOUR WORKSPACE'}</span><strong>{manage&&data.treasury?money(data.treasury.balance):company.workspace.name}</strong><p>{manage?'Ready to distribute into department budgets.':'Your access follows the role your company assigned.'}</p>{manage&&data.treasury&&<small className="pilot-address">{short(data.treasury.address)} · Tempo test account</small>}</div><ol className="pilot-steps"><li className="complete"><span>1</span>Company account</li><li className={data.departments.some(d=>d.balance>0)?'complete':''}><span>2</span>Department budget</li><li className={data.cards.some(c=>c.active)?'complete':''}><span>3</span>Team spending cards</li></ol></div>}
   {data.ready&&(manage||lead)&&<section className="pilot-section"><div className="pilot-section-title"><h3>{manage?'Department budgets':'Your department'}</h3><span>{data.departments.length} {data.departments.length===1?'department':'departments'}</span></div>{data.departments.length===0?<p className="pilot-empty">Add a department below, then invite someone as its lead.</p>:<div className="pilot-departments">{data.departments.map(d=><article className="pilot-department" key={d.id}><div className="pilot-between"><h4>{d.name}</h4><b>{money(d.balance)}</b></div><p>{d.headMembershipId?`${person(d.headMembershipId)} can manage this department’s spending cards.`:'Choose an invited department lead to manage spending.'}</p>{manage&&<><FundForm department={d} balance={data.treasury?.balance||0} disabled={disabled} send={send}/><DelegateForm department={d} people={company.people} disabled={disabled} send={send}/></>}{lead&&d.headMembershipId!==company.membership.id&&<div className="pilot-hint">Finance still needs to authorize your spending authority.</div>}{d.headMembershipId===company.membership.id&&<details className="pilot-details"><summary>Issue a spending card</summary><IssueForm department={d} people={company.people} cards={data.cards} vendors={data.vendors} disabled={disabled||!!d.headRevoking} send={send}/></details>}</article>)}</div>}</section>}
   {data.ready&&<section className="pilot-section"><div className="pilot-section-title"><h3>{manage||lead?'Spending cards':'Your spending cards'}</h3><span>Limits reset every 30 days</span></div>{data.cards.length===0?<p className="pilot-empty">{manage||lead?'Authorize a lead and issue your first card. Each card has its own limit and vendor list.':'Your lead will issue your spending card here. You’ll see its limit and approved vendors before paying.'}</p>:<div className="pilot-cards">{data.cards.map(card=><article className={`pilot-card ${card.active?'':'pilot-card-inactive'}`} key={card.id}><div className="pilot-between"><div><span className="pilot-eyebrow">{departmentName(card.departmentId)}</span><h4>{card.name||person(card.membershipId)}</h4></div><span className={`pilot-status ${card.active?'active':''}`}>{card.revokePending?'Stopping…':card.active?'Active':'Revoked'}</span></div><div className="pilot-card-limit"><strong>{money(card.cap)}</strong><span>30-day spending limit</span></div><p>Approved: {card.allowedVendorIds.map(vendorName).join(', ')}</p><div className="pilot-between"><RecordLink tx={card.tx}>Card record</RecordLink>{card.active&&(manage||lead)&&<button className="pilot-text-button" disabled={disabled||card.revokePending} onClick={()=>{if(confirm(`Stop ${card.name||person(card.membershipId)} from spending with this card?`))void send({action:'revoke',cardId:card.id})}}>Revoke card</button>}</div>{card.active&&card.membershipId===company.membership.id&&<SpendForm card={card} vendors={data.vendors} disabled={disabled||!!card.revokePending} send={send}/>}</article>)}</div>}{mine.some(c=>c.active)&&<p className="pilot-footnote">Network fees also count toward the limit. A payment outside the card’s rules can be held for approval.</p>}</section>}
   {data.ready&&<section className="pilot-section"><div className="pilot-section-title"><h3>{manage||lead?'Requests to review':'Your requests'}</h3><span>{waiting.length} waiting</span></div>{data.requests.length===0?<p className="pilot-empty">Requests appear here when a payment needs approval.</p>:<ul className="pilot-request-list">{data.requests.map(r=>{const self=r.userId===userId||company.people.some(p=>p.id===r.membershipId&&p.userId===userId);const canReview=(manage||lead)&&!self&&r.status==='held';return <li key={r.id}><div className="pilot-between"><div><h4>{vendorName(r.vendorId)}</h4><p>{person(r.membershipId)} · {departmentName(r.departmentId)}</p></div><b>{money(r.amount)}</b></div><p>{r.note}</p>{r.reason&&r.status==='held'&&<p className="pilot-hint">{r.reason}</p>}<div className="pilot-between"><span className={`pilot-status ${r.status==='paid'?'active':''}`}>{r.status==='held'?'Waiting for approval':r.status==='paid'?'Paid':'Declined'}</span><RecordLink tx={r.tx}/></div>{canReview&&<div className="pilot-actions"><button className="real-primary" disabled={disabled||!manage&&r.amount>1000} onClick={()=>void send({action:'approve',heldId:r.id})}>Approve & pay {money(r.amount)}</button><button disabled={disabled} onClick={()=>void send({action:'decline',heldId:r.id})}>Decline</button>{!manage&&r.amount>1000&&<small>Finance approves requests over $1,000.</small>}</div>}{self&&r.status==='held'&&<small>Your own request needs another authorized person to approve it.</small>}</li>})}</ul>}</section>}
   {data.receipts.length>0&&<section className="pilot-section"><div className="pilot-section-title"><h3>Confirmed activity</h3><span>Tempo testnet</span></div><ul className="pilot-activity">{data.receipts.slice().sort((a,b)=>b.at-a.at).map(r=><li key={r.id}><span className="pilot-activity-icon" aria-hidden="true">↗</span><div><b>{labels[r.kind]||r.kind}</b><small>{departmentName(r.departmentId)} · {new Date(r.at).toLocaleString()}</small></div><div className="pilot-activity-end">{r.amount!==undefined&&<b>{money(r.amount)}</b>}<RecordLink tx={r.tx}>Receipt</RecordLink></div></li>)}</ul></section>}
   <p className="pilot-footnote">This beta uses company-specific test accounts and server-held test signing keys. Transfers are visible on Tempo testnet. Your sign-in passkey identifies you; it does not custody these test funds.</p>
  </>}
 </section>
}

function FundForm({department,balance,disabled,send}:{department:Department;balance:number;disabled:boolean;send:Send}){
 const [amount,setAmount]=useState('')
 const n=Number(amount),valid=positive(n)&&n<balance
 return <form className="pilot-form pilot-fund" onSubmit={e=>{e.preventDefault();if(valid)void send({action:'fund',departmentId:department.id,amount:n})}}><label>Add test funds<input aria-label={`Amount for ${department.name}`} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="250.00" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><button disabled={disabled||!valid}>Add funds</button>{n>=balance&&amount&&<small>Leave a little in the company account for network fees.</small>}</form>
}
function DelegateForm({department,people,disabled,send}:{department:Department;people:Member[];disabled:boolean;send:Send}){
 const candidates=people.filter(p=>p.active&&p.departmentId===department.id&&p.role==='lead')
 const [id,setId]=useState('')
 if(department.headMembershipId)return <div className="pilot-delegation"><span>Spending authority is {department.headRevoking?'being revoked':'active'}.</span><button className="pilot-text-button" disabled={disabled||department.headRevoking} onClick={()=>{if(confirm('Revoke this lead’s authority to issue cards and approve payments? Revoke every active card in this department first. Once revoked, this lead authority cannot be reused.'))void send({action:'undelegate',departmentId:department.id})}}>Revoke lead authority</button></div>
 return <form className="pilot-form" onSubmit={e=>{e.preventDefault();if(id)void send({action:'delegate',departmentId:department.id,membershipId:id})}}><label>Department lead<select aria-label={`Lead for ${department.name}`} value={id} onChange={e=>setId(e.target.value)} required><option value="">Choose an invited lead</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={disabled||!id}>Authorize lead</button>{!candidates.length&&<small>Invite a department lead below. They need to accept before you can authorize them.</small>}</form>
}
function IssueForm({department,people,cards,vendors,disabled,send}:{department:Department;people:Member[];cards:Card[];vendors:Vendor[];disabled:boolean;send:Send}){
 const candidates=people.filter(p=>p.active&&p.departmentId===department.id&&['employee','contractor','lead'].includes(p.role)&&!cards.some(c=>c.membershipId===p.id&&c.active))
 const [id,setId]=useState(''),[cap,setCap]=useState(''),[selected,setSelected]=useState<string[]>([])
 const valid=candidates.some(p=>p.id===id)&&positive(Number(cap))&&selected.length>0
 return <form className="pilot-form pilot-issue" onSubmit={e=>{e.preventDefault();if(valid)void send({action:'issue',departmentId:department.id,membershipId:id,cap:Number(cap),allowedVendorIds:selected})}}><label>Cardholder<select value={id} onChange={e=>setId(e.target.value)} required><option value="">Choose a team member</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>30-day limit<input type="number" min="0.01" step="0.01" inputMode="decimal" required placeholder="100.00" value={cap} onChange={e=>setCap(e.target.value)}/></label><fieldset><legend>Approved test vendors</legend>{vendors.map(v=><label className="pilot-checkbox" key={v.id}><input type="checkbox" checked={selected.includes(v.id)} onChange={e=>setSelected(e.target.checked?[...selected,v.id]:selected.filter(x=>x!==v.id))}/><span>{v.name}</span></label>)}</fieldset><button className="real-primary" disabled={disabled||!valid}>Issue spending card</button>{!candidates.length&&<small>Invite a member, or revoke their existing card before issuing a new one.</small>}</form>
}
function SpendForm({card,vendors,disabled,send}:{card:Card;vendors:Vendor[];disabled:boolean;send:Send}){
 const [vendorId,setVendorId]=useState(''),[amount,setAmount]=useState(''),[note,setNote]=useState(''),[review,setReview]=useState(false)
 const vendor=vendors.find(v=>v.id===vendorId),valid=!!vendor&&positive(Number(amount))&&note.trim().length>0
 const mayNeedApproval=!!vendor&&!card.allowedVendorIds.includes(vendor.id)||Number(amount)>card.cap
 return <form className="pilot-form pilot-spend" onSubmit={e=>{e.preventDefault();if(valid){if(!review)setReview(true);else void send({action:'spend',cardId:card.id,vendorId,amount:Number(amount),note:note.trim()}).then(()=>{setReview(false);setAmount('');setNote('')})}}}>{review?<div className="pilot-review"><span className="pilot-eyebrow">REVIEW TEST PAYMENT</span><strong>{money(Number(amount))}</strong><p>To {vendor?.name}</p><p>{note}</p>{mayNeedApproval&&<small>This is outside the card’s rules and may need approval.</small>}<div className="pilot-actions"><button type="button" disabled={disabled} onClick={()=>setReview(false)}>Edit</button><button className="real-primary" disabled={disabled||!valid}>{mayNeedApproval?'Send for approval':'Confirm test payment'}</button></div></div>:<><label>Test vendor<select aria-label="Test vendor" value={vendorId} onChange={e=>setVendorId(e.target.value)} required><option value="">Choose where to pay</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}{card.allowedVendorIds.includes(v.id)?'':' · approval required'}</option>)}</select></label><label>Test amount<input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="12.00" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>What is it for?<input maxLength={200} value={note} onChange={e=>setNote(e.target.value)} placeholder="Design tools for this month" required/></label><button className="real-primary" disabled={disabled||!valid}>Review payment</button></>}</form>
}

export function DeviceApproval({userId,workspaceName,busy,approve,requestPair}:{userId?:string;workspaceName?:string;busy:boolean;approve:(deviceId:string,userCode:string)=>Promise<void>;requestPair:{deviceId:string;userCode:string}|null}){
 const [preview,setPreview]=useState<{expiresAt:number;userCode?:string;code?:string}|null>(null),[error,setError]=useState(''),[approved,setApproved]=useState(false),[now,setNow]=useState(Date.now())
 useEffect(()=>{setApproved(false);setPreview(null);setError('');let current=true;if(userId&&requestPair)void request<{expiresAt:number;userCode?:string;code?:string}>(`/mobile/preview?deviceId=${encodeURIComponent(requestPair.deviceId)}&code=${encodeURIComponent(requestPair.userCode)}`).then(data=>{if(current)setPreview(data)}).catch(e=>{if(current)setError(message(e))});return()=>{current=false}},[userId,requestPair?.deviceId,requestPair?.userCode])
 useEffect(()=>{if(!requestPair)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[requestPair?.deviceId])
 if(!requestPair)return null
 const expired=!!preview&&preview.expiresAt<=now
 return <aside className="pilot-pair" aria-labelledby="pair-title"><div><span className="pilot-eyebrow">IPHONE BETA</span><h2 id="pair-title">{approved?'Your iPhone is connected.':'Connect your Teampot app.'}</h2><p>{approved?'Return to Expo Go. Your company and assigned access will appear there.':userId?'Check that this code matches the one shown in your Teampot iPhone app.':'Sign in or create your account below, then approve the code shown on your iPhone.'}</p>{!approved&&<><output className="pilot-pair-code" aria-label="Device connection code">{requestPair.userCode}</output>{workspaceName&&<p>Connect to <b>{workspaceName}</b> with your assigned access.</p>}<small>Only approve a connection you started on your own device.</small></>}</div><div>{error&&<p className="pilot-pair-error" role="alert">{error}</p>}{expired&&<p role="status">This code expired. Start a new connection in the iPhone app.</p>}{userId&&!approved&&<button className="real-primary" disabled={busy||!preview||expired||!!error} onClick={()=>{setError('');void approve(requestPair.deviceId,requestPair.userCode).then(()=>setApproved(true)).catch(e=>setError(message(e)))}}>{busy?'Connecting…':'Approve this iPhone'}</button>}</div></aside>
}
