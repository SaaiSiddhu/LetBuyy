/** Shared browser lifecycle for React forms and native Liquid forms. No auth authority. */
export type TurnstileStatus = 'checking' | 'interactive' | 'verified' | 'retry' | 'unavailable';

export interface TurnstileApi {
    render(container: HTMLElement, options: Record<string, unknown>): string;
    remove(widgetId: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };
const loads = new WeakMap<Window, Promise<TurnstileApi>>();
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/** An explicit loopback provider simulation never changes server verification. */
export function resolveTurnstileScriptUrl(pageUrl: string, localSdkUrl?: string): string {
    if (!localSdkUrl) return scriptUrl;
    try {
        const page = new URL(pageUrl), sdk = new URL(localSdkUrl);
        const loopback = (url: URL) => url.protocol === 'http:'
            && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
            && Number(url.port) >= 1024 && Number(url.port) <= 65535
            && !url.username && !url.password;
        if (loopback(page) && loopback(sdk)
            && sdk.pathname === '/fixtures/turnstile/api.js' && !sdk.search && !sdk.hash) return sdk.href;
    } catch { /* Fail closed without returning a caller-supplied URL. */ }
    throw new Error('Local verification configuration unavailable');
}

/** One SDK request per document, including concurrent mounts and route transitions. */
export function loadTurnstile(target: Window = window, localSdkUrl?: string): Promise<TurnstileApi> {
    let selectedUrl: string;
    try { selectedUrl = resolveTurnstileScriptUrl(target.location.href, localSdkUrl); }
    catch (error) { return Promise.reject(error); }
    const browser = target as TurnstileWindow;
    if (browser.turnstile) return Promise.resolve(browser.turnstile);
    const pending = loads.get(target);
    if (pending) return pending;
    const promise = new Promise<TurnstileApi>((resolve, reject) => {
        const document = target.document;
        let script = Array.from(document.scripts).find((candidate) => {
            try { return new URL(candidate.src).origin + new URL(candidate.src).pathname === selectedUrl; }
            catch { return false; }
        });
        const owned = !script;
        if (!script) {
            script = document.createElement('script');
            script.src = localSdkUrl ? selectedUrl : `${selectedUrl}?render=explicit`;
            script.async = true;
            script.defer = true;
            script.dataset.lbTurnstile = 'true';
        }
        const selected = script;
        let finished = false;
        const finish = (failed = false) => {
            if (finished || (!failed && !browser.turnstile)) return;
            finished = true;
            target.clearInterval(poll);
            target.clearTimeout(timeout);
            selected.removeEventListener('load', ready);
            selected.removeEventListener('error', fail);
            if (failed) {
                if (selected.dataset.lbTurnstile === 'true') selected.remove();
                reject(new Error('Verification script unavailable'));
            } else resolve(browser.turnstile!);
        };
        const ready = () => finish();
        const fail = () => finish(true);
        const poll = target.setInterval(ready, 100);
        const timeout = target.setTimeout(fail, 15_000);
        selected.addEventListener('load', ready);
        selected.addEventListener('error', fail);
        if (owned) document.head.appendChild(selected);
        ready();
    });
    loads.set(target, promise);
    // A failed load may be retried explicitly; no invisible infinite retry loop.
    const release = () => { if (loads.get(target) === promise) loads.delete(target); };
    void promise.then(release, release);
    return promise;
}

export interface TurnstileControllerOptions {
    siteKey: string;
    localSdkUrl?: string;
    action?: string;
    onToken(token: string): void;
    onStatus?(status: TurnstileStatus): void;
    onExpire?(): void;
}

export interface TurnstileController {
    reset(): void;
    destroy(): void;
}

/** Tokens belong to one mounted form and one attempt, never to a login session. */
export function mountTurnstile(container: HTMLElement, options: TurnstileControllerOptions): TurnstileController {
    let api: TurnstileApi | undefined;
    let widgetId: string | null = null;
    let generation = 0;
    let destroyed = false;
    const clear = () => options.onToken('');
    const remove = () => {
        if (api && widgetId !== null) {
            try { api.remove(widgetId); } catch { /* SDK may already have removed a stale iframe. */ }
        }
        widgetId = null;
        container.replaceChildren();
    };
    const start = () => {
        const attempt = ++generation;
        clear();
        remove();
        if (destroyed) return;
        if (!options.siteKey.trim()) { options.onStatus?.('unavailable'); return; }
        options.onStatus?.('checking');
        const current = () => !destroyed && generation === attempt;
        void loadTurnstile(container.ownerDocument.defaultView!, options.localSdkUrl).then((sdk) => {
            if (!current()) return;
            api = sdk;
            widgetId = sdk.render(container, {
                sitekey: options.siteKey,
                ...(options.action ? { action: options.action } : {}),
                size: 'flexible',
                theme: 'auto',
                appearance: 'interaction-only',
                execution: 'render',
                retry: 'never',
                'refresh-expired': 'auto',
                'refresh-timeout': 'manual',
                'response-field': true,
                callback: (token: string) => {
                    if (!current()) return;
                    options.onToken(token);
                    options.onStatus?.(token ? 'verified' : 'retry');
                },
                'expired-callback': () => {
                    if (!current()) return;
                    clear();
                    options.onExpire?.();
                    options.onStatus?.('checking');
                    // The SDK owns auto-refresh. Calling reset here causes duplicate refreshes.
                },
                'before-interactive-callback': () => { if (current()) { clear(); options.onStatus?.('interactive'); } },
                'timeout-callback': () => { if (current()) { clear(); options.onStatus?.('retry'); } },
                'unsupported-callback': () => { if (current()) { clear(); options.onStatus?.('unavailable'); } },
                'error-callback': (code: string) => {
                    if (!current()) return;
                    clear();
                    options.onStatus?.(['110100', '110110', '110200'].includes(String(code)) ? 'unavailable' : 'retry');
                },
            });
        }).catch(() => { if (current()) { clear(); options.onStatus?.('retry'); } });
    };
    const browser = container.ownerDocument.defaultView!;
    const restored = (event: PageTransitionEvent) => { if (event.persisted && !destroyed) start(); };
    browser.addEventListener('pageshow', restored);
    start();
    return {
        reset: () => { if (!destroyed) start(); },
        destroy: () => { destroyed = true; ++generation; browser.removeEventListener('pageshow', restored); clear(); remove(); },
    };
}
