'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppExtensionRegistration } from '@letbuyy/shared-types';
import {
    createCheckoutUiExtensionBridgeContext,
    createCheckoutUiExtensionFramePolicy,
    listEnabledCheckoutUiExtensions,
    type CheckoutUiExtensionHostRegistration,
    type CheckoutUiExtensionTarget,
} from '@letbuyy/extension-host';

interface CheckoutExtensionHostProps {
    extensions: AppExtensionRegistration[];
    target: CheckoutUiExtensionTarget;
    storeId: string;
    subdomain: string;
    cartTotal: number;
    itemCount: number;
    currency?: string;
    className?: string;
}

type ResizeMessage = {
    type?: string;
    extension_id?: string;
    height?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeResizeMessage(value: unknown): ResizeMessage | null {
    if (!isRecord(value)) return null;
    return {
        type: typeof value.type === 'string' ? value.type : undefined,
        extension_id: typeof value.extension_id === 'string' ? value.extension_id : undefined,
        height: typeof value.height === 'number' ? value.height : undefined,
    };
}

function clampExtensionHeight(value: number): number {
    if (!Number.isFinite(value)) return 160;
    return Math.max(96, Math.min(Math.round(value), 640));
}

function extensionFrameSrc(extension: CheckoutUiExtensionHostRegistration): string {
    const url = new URL(extension.url);
    url.searchParams.set('letbuyy_extension_id', extension.id);
    url.searchParams.set('letbuyy_target', extension.target);
    return url.toString();
}

export function CheckoutExtensionHost({
    extensions,
    target,
    storeId,
    subdomain,
    cartTotal,
    itemCount,
    currency = 'INR',
    className = 'space-y-3',
}: CheckoutExtensionHostProps) {
    const framePolicy = useMemo(() => createCheckoutUiExtensionFramePolicy(), []);
    const enabledExtensions = useMemo(
        () => listEnabledCheckoutUiExtensions(extensions, target),
        [extensions, target],
    );
    const frameRefs = useRef(new Map<string, HTMLIFrameElement>());
    const [frameHeights, setFrameHeights] = useState<Record<string, number>>({});

    const createContext = useCallback((extension: CheckoutUiExtensionHostRegistration) => (
        createCheckoutUiExtensionBridgeContext({
            extension,
            storeId,
            store: subdomain,
            currency,
            cartTotalMinor: Math.round(cartTotal * 100),
            itemCount,
        })
    ), [cartTotal, currency, itemCount, storeId, subdomain]);

    const postContext = useCallback((extension: CheckoutUiExtensionHostRegistration) => {
        const frame = frameRefs.current.get(extension.id);
        frame?.contentWindow?.postMessage({
            type: 'letbuyy.checkout.extension.context',
            payload: createContext(extension),
        }, extension.origin);
    }, [createContext]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            enabledExtensions.forEach((extension) => postContext(extension));
        }, 0);

        return () => window.clearTimeout(timer);
    }, [enabledExtensions, postContext]);

    useEffect(() => {
        const allowed = new Map(enabledExtensions.map((extension) => [extension.id, extension]));

        function handleMessage(event: MessageEvent<unknown>) {
            const message = normalizeResizeMessage(event.data);
            if (message?.type !== 'letbuyy.checkout.extension.resize' || !message.extension_id) return;

            const extension = allowed.get(message.extension_id);
            if (!extension || extension.origin !== event.origin || typeof message.height !== 'number') return;
            const height = message.height;

            setFrameHeights((current) => ({
                ...current,
                [extension.id]: clampExtensionHeight(height),
            }));
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [enabledExtensions]);

    if (enabledExtensions.length === 0) return null;

    return (
        <div className={className} data-checkout-extension-target={target}>
            {enabledExtensions.map((extension) => (
                <section
                    key={extension.id}
                    aria-label={extension.title}
                    className="overflow-hidden rounded-xl border border-card bg-[var(--lb-color-surface)]/60 dark:bg-slate-950/40"
                    data-checkout-extension-id={extension.id}
                    data-checkout-extension-handle={extension.handle}
                >
                    <iframe
                        ref={(node) => {
                            if (node) {
                                frameRefs.current.set(extension.id, node);
                            } else {
                                frameRefs.current.delete(extension.id);
                            }
                        }}
                        title={extension.title}
                        src={extensionFrameSrc(extension)}
                        sandbox={framePolicy.sandbox}
                        allow={framePolicy.allow}
                        referrerPolicy={framePolicy.referrerPolicy}
                        loading="lazy"
                        onLoad={() => postContext(extension)}
                        className="block w-full border-0"
                        style={{ height: frameHeights[extension.id] || 160 }}
                    />
                </section>
            ))}
        </div>
    );
}
