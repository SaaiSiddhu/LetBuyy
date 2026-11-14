'use client'
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {Button,Input,Textarea} from '@letbuyy/ui'
import {BrandLogo} from '@/components/BrandLogo'
import TurnstileWidget,{type TurnstileHandle} from '@/components/TurnstileWidget'
import {getAuthHeaders} from '@/lib/csrf-client'
import styles from './privacy.module.css'

type Buyer={id:string;email:string}
type RequestRow={id:string;reference:string|null;type:'access'|'erasure';status:string;created_at:string}
type ExportRow={export_id:string;request_id:string;status:string;expires_at:string;released_at:string|null}
export function BuyerPrivacy({initialBuyer,expectedBuyer,unavailable}:{initialBuyer:Buyer|null;expectedBuyer:string|null;unavailable:boolean}){
 const [buyer,setBuyer]=useState(initialBuyer),[requests,setRequests]=useState<RequestRow[]>([]),[selected,setSelected]=useState(''),[exports,setExports]=useState<ExportRow[]>([])
 const [email,setEmail]=useState(''),[signInPassword,setSignInPassword]=useState(''),[password,setPassword]=useState(''),[notes,setNotes]=useState(''),[type,setType]=useState<'access'|'erasure'>('access')
 const [error,setError]=useState(unavailable?'Your account is temporarily unavailable. Refresh when service is restored.':''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[key,setKey]=useState('')
 const [accountReady,setAccountReady]=useState(true),[accountRevision,setAccountRevision]=useState(0)
 const generation=useRef(0),turnstile=useRef<TurnstileHandle>(null),[human,setHuman]=useState<string|null>(null)
 const onHuman=useCallback((value:string)=>setHuman(value),[]),humanEnabled=Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
 const headers=()=>({...getAuthHeaders(),'X-LetBuyy-Expected-Buyer':buyer?.id||''})
 async function failure(response:Response){const body=await response.json().catch(()=>null);return typeof body?.error==='string'?body.error:body?.error?.message||'This action could not be confirmed. Retry when service is restored.'}
 async function loadRequests(){if(!buyer)return;const current=++generation.current;setError('');setRequests([]);setExports([]);setSelected('');
  try{const r=await fetch('/api/buyer/privacy/requests',{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(await failure(r));const body=await r.json();if(!Array.isArray(body.data))throw new Error('Request data is unavailable. Try refreshing.');if(generation.current===current)setRequests(body.data)}catch(e){if(generation.current===current)setError(e instanceof Error?e.message:'Requests unavailable.')}
 }
 useEffect(()=>{if(accountReady)void loadRequests()},[buyer?.id,accountRevision,accountReady])
 useEffect(()=>()=>{generation.current++},[])
 async function recheckAccount(){const current=++generation.current;setAccountReady(false);setRequests([]);setExports([]);setSelected('');setPassword('');setSignInPassword('');setNotice('')
  try{const r=await fetch('/api/buyer/privacy/account',{headers:{...getAuthHeaders(),...(expectedBuyer?{'X-LetBuyy-Expected-Buyer':expectedBuyer}:{})},cache:'no-store'});if(current!==generation.current)return
   if(!r.ok){const message=await failure(r);if(current!==generation.current)return;if(r.status===401||r.status===409){setBuyer(null);setAccountReady(true)}throw new Error(message)}
   const body=await r.json();if(current!==generation.current)return;setBuyer(body.buyer);setError('');setBusy(false);setAccountReady(true);setAccountRevision(value=>value+1)
  }catch(e){if(current===generation.current){setBusy(false);setError(e instanceof Error?e.message:'Account verification unavailable.')}}
 }
 useEffect(()=>{const visibility=()=>{if(document.hidden){generation.current++;setAccountReady(false);setRequests([]);setExports([]);setSelected('');setPassword('');setSignInPassword('')}else void recheckAccount()}
  const focus=()=>{if(buyer&&!document.hidden)void recheckAccount()};document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',focus)
  return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',focus)}
 },[buyer?.id,expectedBuyer])
 async function loadExports(id:string,current=generation.current){const r=await fetch('/api/buyer/privacy/exports?request_id='+encodeURIComponent(id),{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(await failure(r));const body=await r.json();if(!Array.isArray(body.data?.items))throw new Error('Export data is unavailable. Try refreshing.');if(current===generation.current)setExports(body.data.items)}
 async function signIn(event:FormEvent){event.preventDefault();setBusy(true);setError('');const current=++generation.current
  try{const r=await fetch('/api/buyer/login',{method:'POST',headers:getAuthHeaders(),body:JSON.stringify({email,password:signInPassword,turnstileToken:human||''})});if(!r.ok)throw new Error(await failure(r));const body=await r.json();if(current!==generation.current)return
   if(expectedBuyer&&body.buyer?.id!==expectedBuyer)throw new Error('Sign in with the buyer account used to open this page. No data has been loaded for the other account.')
   window.location.reload()
  }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Sign-in unavailable.')}finally{setSignInPassword('');turnstile.current?.reset();setHuman(null);if(current===generation.current)setBusy(false)}
 }
 async function create(event:FormEvent){event.preventDefault();const current=generation.current;setBusy(true);setError('');setNotice('')
  try{const r=await fetch('/api/buyer/privacy/requests',{method:'POST',headers:headers(),body:JSON.stringify({type,notes})});if(!r.ok)throw new Error(await failure(r));if(current!==generation.current)return;setNotes('');setNotice(type==='access'?'Your access request is available below. Verify your password to prepare its restricted export.':'Your deletion request was received for review. No data was deleted.');await loadRequests()}
  catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Request unavailable.')}finally{setBusy(false)}
 }
 async function choose(id:string){const current=++generation.current;setSelected(id);setExports([]);setPassword('');setKey(crypto.randomUUID());setNotice('');setError('');try{await loadExports(id,current)}catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Exports unavailable.')}}
 async function prepare(event:FormEvent){event.preventDefault();const current=generation.current;setBusy(true);setError('');setNotice('')
  try{const r=await fetch('/api/buyer/privacy/prepare',{method:'POST',headers:headers(),body:JSON.stringify({request_id:selected,request_key:key,password})});if(!r.ok)throw new Error(await failure(r));if(current!==generation.current)return;setNotice('Export prepared. Download it once before the displayed expiry.');await loadExports(selected,current)}
  catch(e){if(current===generation.current)setError((e instanceof Error?e.message:'Preparation unavailable.')+' Re-enter your password to retry this same request, or refresh exports to recover a saved result.')}finally{setPassword('');if(current===generation.current)setBusy(false)}
 }
 async function download(row:ExportRow){const current=generation.current;setBusy(true);setError('');setNotice('')
  try{const r=await fetch('/api/buyer/privacy/download',{method:'POST',headers:headers(),body:JSON.stringify({request_id:selected,export_id:row.export_id})});if(!r.ok)throw new Error(await failure(r));const blob=await r.blob();if(current!==generation.current)return
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='letbuyy-data-'+row.export_id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Your browser was asked to save the export. This single-use permission is now used. If saving was interrupted, verify again to prepare a new export.');await loadExports(selected,current);setKey(crypto.randomUUID())
  }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Download unavailable.')}finally{if(current===generation.current)setBusy(false)}
 }
 async function signOut(){generation.current++;setBusy(true);setError('');setRequests([]);setExports([]);setPassword('');try{const r=await fetch('/api/buyer/logout',{method:'POST',headers:getAuthHeaders(),body:'{}'});if(!r.ok)throw new Error(await failure(r));setBuyer(null);setSelected('');setNotice('Signed out.')}catch(e){setError(e instanceof Error?e.message:'Sign-out unavailable.')}finally{setBusy(false)}}
 return <main className={styles.page}><BrandLogo/><h1 className="text-2xl font-semibold">Your data access</h1>
  <p>Manage requests for your LetBuyy buyer account. The restricted V1 export includes your profile, saved addresses, your own authored support content and linked order commerce fields. It excludes credentials and internal operational notes.</p>
  {error&&<p role="alert" className="rounded border border-red-500 p-4">{error}</p>}{notice&&<p role="status" className="rounded border p-4">{notice}</p>}
  {!accountReady?<section><p>Rechecking the current buyer account. Private request data is hidden.</p><Button onClick={()=>void recheckAccount()}>Retry account check</Button></section>:!buyer?<section className="space-y-4"><h2 className="text-xl font-semibold">Sign in to your buyer account</h2>{expectedBuyer&&<p>Use the same buyer account that opened this page. A different signed-in account will not load its requests here.</p>}
   <form onSubmit={signIn} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><div><label htmlFor="privacy-email">Email</label><Input id="privacy-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div><label htmlFor="privacy-sign-in-password">Password</label><Input id="privacy-sign-in-password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required value={signInPassword} onChange={e=>setSignInPassword(e.target.value)}/></div>
   {humanEnabled&&<TurnstileWidget ref={turnstile} onVerify={onHuman}/>}<Button type="submit" disabled={busy||(humanEnabled&&!human)}>Sign in</Button></fieldset></form>{expectedBuyer&&<a className="underline" href="/buyer/privacy">Manage a different buyer account</a>}</section>
   :<><section className="flex items-center justify-between gap-4 rounded border p-4"><p>Signed in as <strong>{buyer.email}</strong></p><Button disabled={busy} onClick={()=>void signOut()}>Sign out</Button></section>
    <section className="space-y-4 rounded border p-5"><h2 className="text-xl font-semibold">New data request</h2><p>Creating a deletion request does not delete data. Erasure and retained-record rules require separate review.</p><form onSubmit={create}><fieldset disabled={busy} className="space-y-4"><div><label htmlFor="privacy-type">Request type</label><select id="privacy-type" value={type} onChange={e=>setType(e.target.value as 'access'|'erasure')} className="block w-full rounded border bg-transparent p-3"><option value="access">Data access</option><option value="erasure">Account deletion review</option></select></div><div><label htmlFor="privacy-notes">Optional notes</label><Textarea id="privacy-notes" maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></div><Button type="submit">Submit request</Button></fieldset></form></section>
    <section className="space-y-4"><div className="flex justify-between gap-4"><h2 className="text-xl font-semibold">Recent requests</h2><Button disabled={busy} onClick={()=>void loadRequests()}>Refresh requests</Button></div><p>Up to 50 recent requests. Closing a request does not by itself prove fulfillment.</p>{!requests.length&&<p>No requests are loaded.</p>}<ul className="space-y-3">{requests.map(row=><li key={row.id} className="rounded border p-4"><p>{row.reference||row.id} · {row.type} · {row.status}</p>{row.type==='access'&&<Button disabled={busy} onClick={()=>void choose(row.id)}>Manage export</Button>}</li>)}</ul></section>
    {selected&&<section className="space-y-4 rounded border p-5"><h2 className="text-xl font-semibold">Restricted access export</h2><p>Verify your current password. A download is tied to this sign-in, expires within ten minutes and can be released once. Passwords are not saved here.</p><form onSubmit={prepare}><fieldset disabled={busy} className="space-y-4"><div><label htmlFor="privacy-export-password">Current password for export</label><Input id="privacy-export-password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></div><Input unstyled type="hidden" name="request_key" value={key}/><Button type="submit">Verify and prepare export</Button></fieldset></form>
     <Button disabled={busy} onClick={()=>void loadExports(selected).catch(e=>setError(e instanceof Error?e.message:'Exports unavailable.'))}>Refresh exports</Button><p>Up to 20 recent exports for this request.</p><ul className="space-y-3">{exports.map(row=><li key={row.export_id} className="rounded border p-4"><p>{row.status==='delivered'?'Released once':row.status} · Expires {new Date(row.expires_at).toLocaleString()}</p>{row.status==='ready'&&<Button disabled={busy} onClick={()=>void download(row)}>Download once</Button>}{row.status!=='ready'&&<Button disabled={busy} onClick={()=>{setKey(crypto.randomUUID());setPassword('');setNotice('Enter your password to prepare a new export.')}}>Prepare a new export</Button>}</li>)}</ul>
    </section>}
   </>}
 </main>
}
