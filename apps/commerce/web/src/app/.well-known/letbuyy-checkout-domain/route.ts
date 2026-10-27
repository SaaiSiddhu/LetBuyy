import { NextRequest,NextResponse } from 'next/server';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { CheckoutDomainProbeSchema,canonicalCheckoutDomainProbePayload } from '@letbuyy/checkout-core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const denied=()=>NextResponse.json({error:'Invalid checkout readiness proof'},{status:401,headers:HEADERS});
export async function GET(request:NextRequest) {
  const key=process.env.STORE_ACCESS_SIGNING_KEY;
  if(!key||key.length<16)return NextResponse.json({error:'Checkout readiness is unavailable'},{status:503,headers:HEADERS});
  const raw=request.headers.get('x-letbuyy-checkout-probe');
  if(!raw||raw.length>2048)return denied();
  let input:unknown;try{input=JSON.parse(raw);}catch{return denied();}
  if(!input||typeof input!=='object'||Array.isArray(input))return denied();
  const {signature,...value}=input as Record<string,unknown>;const parsed=CheckoutDomainProbeSchema.safeParse(value);
  const host=request.headers.get('host')||request.nextUrl.host;
  if(!parsed.success||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature)
      ||host!==parsed.data.hostname||!host.startsWith('checkout.'))return denied();
  const expiry=Date.parse(parsed.data.expires_at);
  if(expiry<=Date.now()||expiry>Date.now()+60_000)return denied();
  const expected=createHmac('sha256',key).update(canonicalCheckoutDomainProbePayload('request',parsed.data)).digest('hex');
  if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))return denied();
  const responseSignature=createHmac('sha256',key).update(canonicalCheckoutDomainProbePayload('response',parsed.data)).digest('hex');
  return NextResponse.json({...parsed.data,signature:responseSignature},{headers:HEADERS});
}
