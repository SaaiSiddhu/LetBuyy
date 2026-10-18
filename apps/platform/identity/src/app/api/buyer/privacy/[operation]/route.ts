import {NextRequest,NextResponse} from 'next/server'
import {LETBUYY_BUYER_SESSION_HEADER} from '@letbuyy/auth-core'
import {identityApiRequest} from '@/lib/api/client'
import {getBuyerSessionCookie} from '@/lib/auth/buyer-session'
import {validateCsrf} from '@/lib/auth/csrf'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRIVATE={'Cache-Control':'private, no-store',Pragma:'no-cache','Referrer-Policy':'no-referrer'}
const problem=(error:string,status:number)=>NextResponse.json({error},{status,headers:PRIVATE})
function sameOrigin(request:NextRequest){
 const origin=request.headers.get('origin')
 if(origin===request.nextUrl.origin)return true
 // NextURL canonicalizes literal IPv4 loopback to localhost. Preserve the
 // browser's exact HTTP Host/port for that local origin only; never trust an
 // alternate forwarded host or a sibling origin in a hosted request.
 return request.nextUrl.protocol==='http:'&&request.nextUrl.hostname==='localhost'
  &&request.headers.get('host')==='127.0.0.1'+(request.nextUrl.port?':'+request.nextUrl.port:'')
  &&origin==='http://'+request.headers.get('host')
}
async function handle(request:NextRequest,operation:string){
 if(request.method==='POST'&&(!sameOrigin(request)||!validateCsrf(request)))return problem('A same-origin verified form is required.',403)
 const token=await getBuyerSessionCookie();if(!token)return problem('Sign in to manage your data.',401)
 const expected=request.headers.get('X-LetBuyy-Expected-Buyer')||''
 if(!(operation==='account'&&request.method==='GET')&&!UUID.test(expected))return problem('Refresh this page to verify the current account.',409)
 const headers={[LETBUYY_BUYER_SESSION_HEADER]:token}
 try{
  // The hint is refusal-only. Both this read and the action use this request's
  // same captured canonical credential, never a subject supplied in a body.
  const me=await identityApiRequest<{data?:{buyer?:{id?:string;email?:string}}}>('/storefront/buyer/me',{headers});const account=(await me.json())?.data?.buyer
  if(!me.ok||!account?.id||!UUID.test(account.id)||typeof account.email!=='string')return problem('Your buyer session is unavailable. Sign in again.',me.status===401?401:503)
  if(expected&&account.id!==expected)return problem('The signed-in account changed. Refresh before continuing.',409)
  if(operation==='account'&&request.method==='GET')return NextResponse.json({buyer:{id:account.id,email:account.email}},{headers:PRIVATE})
  let path='',body:Record<string,unknown>|undefined,downloadId=''
  if(request.method==='GET'){
   if(operation==='requests')path='/storefront/buyer/privacy-requests'
   else if(operation==='exports'){
    const id=request.nextUrl.searchParams.get('request_id')||'';if(!UUID.test(id))return problem('Invalid access request.',400)
    path='/storefront/buyer/privacy-requests/'+id+'/exports'
   }else return problem('Unknown data action.',404)
  }else{
   const raw:unknown=await request.json().catch(()=>null)
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return problem('Invalid data form.',400)
   const data=raw as Record<string,unknown>,only=(names:string[])=>Object.keys(data).every(key=>names.includes(key))
   if(operation==='requests'){
    if(!only(['type','notes'])||!['access','erasure'].includes(String(data.type))||typeof data.notes!=='string'||data.notes.length>1000)return problem('Choose an access or erasure request and keep notes within 1,000 characters.',400)
    path='/storefront/buyer/privacy-requests';body={type:data.type,notes:data.notes}
   }else if(operation==='prepare'){
    if(!only(['request_id','request_key','password'])||typeof data.request_id!=='string'||!UUID.test(data.request_id)||typeof data.request_key!=='string'||!UUID.test(data.request_key)||typeof data.password!=='string'||data.password.length<8||data.password.length>128)return problem('Provide your current password and a valid access request.',400)
    path='/storefront/buyer/privacy-requests/'+data.request_id+'/export';body={password:data.password,request_key:data.request_key}
   }else if(operation==='download'){
    if(!only(['request_id','export_id'])||typeof data.request_id!=='string'||!UUID.test(data.request_id)||typeof data.export_id!=='string'||!UUID.test(data.export_id))return problem('Invalid download request.',400)
    downloadId=data.export_id;path='/storefront/buyer/privacy-requests/'+data.request_id+'/exports/'+data.export_id+'/download';body={}
   }else return problem('Unknown data action.',404)
  }
  const result=await identityApiRequest(path,{method:request.method,headers,...(body?{body:JSON.stringify(body)}:{}),...(downloadId?{responseType:'text' as const}:{}),signal:AbortSignal.timeout(25000)})
  if(!result.ok){const failure=await result.json() as {error?:{message?:string}}|null;return problem(failure?.error?.message||'Your data action could not be confirmed. Retry when service is restored.',result.status>=400?result.status:503)}
  if(downloadId)return new Response(await result.text(),{headers:{...PRIVATE,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="letbuyy-data-'+downloadId+'.json"','X-Content-Type-Options':'nosniff'}})
  const payload=await result.json();return NextResponse.json(payload,{headers:PRIVATE})
 }catch{return problem('Your data action could not be confirmed. Your existing request remains available; retry when service is restored.',503)}
}
export async function GET(request:NextRequest,context:{params:Promise<{operation:string}>}){return handle(request,(await context.params).operation)}
export async function POST(request:NextRequest,context:{params:Promise<{operation:string}>}){return handle(request,(await context.params).operation)}
