import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consoleStepUpReturnPath } from '@/lib/console-step-up';
import {
    getConsoleSessionFromCookies,
    isConsoleEmailAllowed,
    setConsoleMfaCookie,
} from '@/lib/console-auth-server';

const mfaSchema = z.object({
    code: z.string().trim().regex(/^\d{6}$/),
});

function redirectWithError(request: NextRequest, error: string, continuation?: { stepUp: boolean; returnTo: string }) {
    const target = new URL(`/mfa?error=${encodeURIComponent(error)}`, request.url);
    if (continuation?.stepUp) { target.searchParams.set('step_up', '1'); target.searchParams.set('return_to', continuation.returnTo); }
    return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
    if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid verification origin.'},{status:403});
    const session = await getConsoleSessionFromCookies();

    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url), 303);
    }
    if (!isConsoleEmailAllowed(session.email)) {
        return NextResponse.redirect(new URL('/login?error=access_revoked', request.url), 303);
    }

    const formData = await request.formData();
    const stepUp = formData.get('step_up') === '1';
    const returnTo = consoleStepUpReturnPath(formData.get('return_to'));
    const parsed = mfaSchema.safeParse({
        code: formData.get('code'),
    });

    if (!parsed.success) {
        return redirectWithError(request, 'invalid_code', { stepUp, returnTo });
    }

    const verification=await setConsoleMfaCookie({code:parsed.data.code});
    if(!verification.ok) {
        const error=verification.reason==='locked'?'too_many_attempts':verification.reason==='invalid'?'invalid_code':verification.reason==='reset_required'?'administrator_reset_required':verification.reason==='mfa_not_configured'?'mfa_not_configured':'session_unavailable';
        return redirectWithError(request,error,{stepUp,returnTo});
    }

    return NextResponse.redirect(new URL(stepUp ? returnTo : '/dashboard', request.url), 303);
}
