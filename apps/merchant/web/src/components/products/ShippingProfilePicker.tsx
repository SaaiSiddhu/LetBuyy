'use client'
import {useEffect,useState} from 'react'
import {Button,Select} from '@letbuyy/ui'
import {ShippingProfileSchema,type ShippingProfile} from '@letbuyy/shared-types'

export function ShippingProfilePicker({store,value,onChange}:{store:string;value:string|undefined;onChange:(value:string)=>void}) {
 const [state,setState]=useState<{store:string;profiles:ShippingProfile[];loading:boolean;error:string|null}>({store,profiles:[],loading:true,error:null})
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  const abort=new AbortController();let current=true
  setState({store,profiles:[],loading:true,error:null})
  fetch(`/api/stores/${encodeURIComponent(store)}/shipping/profiles`,{cache:'no-store',signal:abort.signal})
   .then(async response=>{const payload=await response.json();const parsed=ShippingProfileSchema.array().safeParse(payload?.data);if(!response.ok || !parsed.success)throw new Error('Profiles could not be loaded. Your saved selection is preserved.');return parsed.data})
   .then(profiles=>{if(current)setState({store,profiles,loading:false,error:null})})
   .catch(error=>{if(current)setState({store,profiles:[],loading:false,error:error instanceof Error?error.message:'Profiles are unavailable.'})})
  return()=>{current=false;abort.abort()}
 },[store,retry])
 const profiles=state.store===store?state.profiles:[],loading=state.store!==store || state.loading
 const options=[{value:'',label:'Use store default profile'},...profiles.map(profile=>({value:profile.id,label:profile.name}))]
 if(value && !profiles.some(profile=>profile.id===value))options.push({value,label:'Saved shipping profile'})
 return <div><Select label="Shipping profile" value={value || ''} options={options} disabled={loading} onChange={event=>onChange(event.target.value)}/>
  <p className="mt-[var(--lb-space-2)] text-sm text-[var(--lb-color-text-subdued)]">{loading?'Loading delivery profiles…':state.error || 'Manage matching delivery zones and handling charges in Shipping and delivery.'}</p>
  {state.store===store && state.error && <Button variant="secondary" size="sm" onClick={()=>setRetry(n=>n+1)}>Reload profiles</Button>}
 </div>
}
