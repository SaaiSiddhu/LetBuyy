import 'server-only';
import {createConsoleIdentityProof} from '@letbuyy/auth-core/platform-identity';
export interface ConsoleIdentityResult {ok:boolean;token?:string;magic_token?:string;reason?:string;result?:{approval?:unknown};error?:{code?:string;message?:string};status?:number}
/** Finite first-party proxy. No signing key, factor secret, actor assertion or
 * caller-selected MFA counter exists in Console's authentication transport. */
export async function requestConsoleIdentity(command:Record<string,unknown>):Promise<ConsoleIdentityResult>{
 try{
  const url=new URL(process.env.LETBUYY_IDENTITY_URL||process.env.NEXT_PUBLIC_ACCOUNTS_URL||'https://accounts.letbuyy.com');
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Invalid Identity origin');
  const body=JSON.stringify(command),proof=await createConsoleIdentityProof(body,process.env.PLATFORM_CONSOLE_API_TOKEN||'');
  const response=await fetch(new URL('/api/operator/console',url),{method:'POST',headers:{'Content-Type':'application/json',...proof},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  const result=await response.json() as ConsoleIdentityResult;
  if(typeof result?.ok!=='boolean')throw new Error('Invalid Identity reply');
  return {...result,status:response.status,ok:response.ok&&result.ok};
 }catch{return {ok:false,status:503,error:{code:'OPERATOR_AUTH_UNAVAILABLE',message:'Operator authentication is temporarily unavailable.'}};}
}
