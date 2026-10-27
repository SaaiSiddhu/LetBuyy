'use client'

import { useCallback,useRef,useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button,Input,Checkbox } from '@letbuyy/ui'
import TurnstileWidget,{type TurnstileHandle} from '@/components/TurnstileWidget'
import { BrandLogo } from '@/components/BrandLogo'
import { getAuthHeaders } from '@/lib/csrf-client'
import type { BuyerAuthorizationRequest } from '@/lib/auth/buyer-authorization'

export function MerchantBuyerConnection({request,destination,onCancel}:{request:BuyerAuthorizationRequest;destination:string;onCancel:()=>void}){
 const router=useRouter(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[mfaCode,setMfaCode]=useState('')
 const [mfaRequired,setMfaRequired]=useState(false),[step,setStep]=useState<'sign-in'|'proof'>('sign-in'),[code,setCode]=useState(''),[consent,setConsent]=useState(false)
 const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[token,setToken]=useState<string|null>(null)
 const widget=useRef<TurnstileHandle>(null),onVerify=useCallback((v:string)=>setToken(v),[])
 const protectedByTurnstile=Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
 const authorization={response_type:'code',client_id:request.clientId,redirect_uri:request.redirectUri,state:request.state,code_challenge:request.codeChallenge,code_challenge_method:request.codeChallengeMethod}
 async function submit(event:React.FormEvent){
  event.preventDefault();setLoading(true);setError(null)
  try{
   const result=await fetch('/api/auth/login',{method:'POST',headers:{...getAuthHeaders(),'X-LetBuyy-Account-Intent':step==='sign-in'?'connect-buyer-start':'connect-buyer-confirm'},body:JSON.stringify(step==='sign-in'?{authorization,email:email.trim(),password,mfaCode,turnstileToken:token||''}:{authorization,code,consent})})
   const body=await result.json() as {email?:string;error?:string;mfaRequired?:boolean}
   if(!result.ok){setError(body.error||'Unable to connect. Please try again.');if(body.mfaRequired)setMfaRequired(true);if(step==='sign-in'){widget.current?.reset();setToken(null)}return}
   setPassword('');setMfaCode('')
   if(step==='sign-in'){setEmail(body.email||email);setStep('proof')}else router.refresh()
  }catch{setError('Account connection is unavailable. Please try again later.')}
  finally{setLoading(false)}
 }
 async function cancel(){
  setLoading(true)
  try{
   {
    const result=await fetch('/api/auth/login',{method:'POST',headers:{...getAuthHeaders(),'X-LetBuyy-Account-Intent':'connect-buyer-cancel'},body:JSON.stringify({authorization})})
    if(!result.ok){setError('Unable to finish cancellation. Try again, or close this page; the connection expires in 10 minutes.');return}
   }
   setPassword('');setCode('');onCancel()
  }catch{setError('Please try again.')}finally{setLoading(false)}
 }
 return <main className="auth-container"><div className="auth-card">
  <div className="auth-logo"><BrandLogo/></div>
  <h1 className="auth-title">{step==='sign-in'?'Connect your LetBuyy account':'Connect your buyer profile'}</h1>
  <p className="auth-subtitle">{step==='sign-in'?`Sign in with your existing LetBuyy account to shop at ${destination}. Your work permissions stay separate.`:`Enter the code sent to ${email}. It expires in 10 minutes.`}</p>
  <form onSubmit={submit} className="auth-form">
   {step==='sign-in'?<>
    <Input id="connectionEmail" label="Account email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
    <Input id="connectionPassword" label="Account password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>
    {mfaRequired&&<Input id="connectionMfa" label="Authenticator code" autoComplete="one-time-code" required value={mfaCode} onChange={e=>setMfaCode(e.target.value)}/>}
    <a href="/forgot-password" target="_blank" rel="noreferrer">Forgot password?</a>
   </>:<>
    <Input id="connectionCode" label="Email verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/>
    <Checkbox id="buyerConnectionConsent" checked={consent} onCheckedChange={setConsent} required label={`Create or connect my LetBuyy buyer profile using this verified email address. I choose to continue to ${destination}.`}/>
    <p className="auth-subtitle">Your password and work permissions are never shared with the store. This code proves ownership of the email used for your buyer profile.</p>
   </>}
   {error&&<div className="auth-error" role="alert">{error}</div>}
   <Button unstyled type="submit" className="auth-btn-primary" disabled={loading||(step==='sign-in'?(!email.trim()||!password||(protectedByTurnstile&&!token)||(mfaRequired&&!mfaCode)):(!consent||code.length!==6))}>
    {loading?'Please wait…':step==='sign-in'?'Verify account':'Connect buyer profile'}
   </Button>
  </form>
  {step==='sign-in'&&<TurnstileWidget ref={widget} onVerify={onVerify}/>}
  <Button unstyled className="auth-btn-secondary" onClick={cancel} disabled={loading}>Cancel connection</Button>
 </div></main>
}
