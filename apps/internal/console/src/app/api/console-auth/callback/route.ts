import {NextRequest,NextResponse} from 'next/server';
import {requestConsoleIdentity} from '@/lib/console-identity-client';
import {persistConsoleIdentityCookie} from '@/lib/console-auth-server';
export async function GET(request:NextRequest){
 const magic=request.nextUrl.searchParams.get('token');
 if(!magic||magic.length>4096)return NextResponse.redirect(new URL('/login?error=invalid_magic_link',request.url),303);
 const result=await requestConsoleIdentity({operation:'exchange',magic_token:magic});
 if(!result.ok||!result.token||!await persistConsoleIdentityCookie(result.token))return NextResponse.redirect(new URL('/login?error=invalid_magic_link',request.url),303);
 return NextResponse.redirect(new URL('/mfa',request.url),303);
}
