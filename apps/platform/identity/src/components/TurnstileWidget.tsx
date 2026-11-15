'use client';

import React, { forwardRef } from 'react';
import { TurnstileWidget as SharedTurnstileWidget, type TurnstileHandle } from '@letbuyy/ui/turnstile';

export type { TurnstileHandle } from '@letbuyy/ui/turnstile';
interface Props { onVerify(token: string): void; onExpire?(): void; }

function canUseClientDevAuthBypass(): boolean {
    return process.env.NODE_ENV === 'development'
        && process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true';
}

// Runtime configuration belongs to the app; SDK and token lifecycle belong to @letbuyy/ui.
export default forwardRef<TurnstileHandle, Props>(function TurnstileWidget(props, ref) {
    return <SharedTurnstileWidget {...props} ref={ref}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
        localSdkUrl={process.env.NEXT_PUBLIC_ENV === 'development'
            ? process.env.NEXT_PUBLIC_LOCAL_CHALLENGE_SDK_URL : undefined}
        developmentBypass={canUseClientDevAuthBypass()} />;
});
