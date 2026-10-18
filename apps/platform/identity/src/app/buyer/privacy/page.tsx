import {LETBUYY_BUYER_SESSION_HEADER} from '@letbuyy/auth-core'
import {identityApiRequest} from '@/lib/api/client'
import {getBuyerSessionCookie} from '@/lib/auth/buyer-session'
import {BuyerPrivacy} from './privacy-client'

export const dynamic='force-dynamic'
export const metadata={title:'Your data access | LetBuyy'}
export default async function BuyerPrivacyPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,raw=typeof params.buyer_hint==='string'?params.buyer_hint:null
 const expected=raw&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)?raw:null
 let buyer:{id:string;email:string}|null=null,unavailable=false
 const token=await getBuyerSessionCookie()
 if(token)try{
  const me=await identityApiRequest<{data?:{buyer?:{id:string;email:string}}}>('/storefront/buyer/me',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:token}})
  const value=(await me.json())?.data?.buyer
  if(me.ok&&value&&(!expected||expected===value.id))buyer={id:value.id,email:value.email}
  else if(me.status>=500)unavailable=true
 }catch{unavailable=true}
 return <BuyerPrivacy initialBuyer={buyer} expectedBuyer={expected} unavailable={unavailable}/>
}
