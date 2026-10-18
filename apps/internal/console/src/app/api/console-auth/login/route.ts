import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requestConsoleIdentity} from '@/lib/console-identity-client';
function fail(request:NextRequest,error:string){return NextResponse.redirect(new URL('/login?error='+encodeURIComponent(error),request.url),303);}
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'A same-origin sign-in form is required.'},{status:403});
 const form=await request.formData().catch(()=>null),email=z.string().trim().email().max(254).safeParse(form?.get('email'));
 if(!email.success)return fail(request,'invalid_email');
 const result=await requestConsoleIdentity({operation:'magic',email:email.data.toLowerCase()});
 if(!result.ok||!result.magic_token)return fail(request,result.error?.code==='magic_link_delivery_not_configured'?'magic_link_delivery_not_configured':'session_unavailable');
 const link=new URL('/api/console-auth/callback',request.url);link.searchParams.set('token',result.magic_token);
 return NextResponse.redirect(new URL('/login?sent=1&devMagicLink='+encodeURIComponent(link.pathname+link.search),request.url),303);
}
