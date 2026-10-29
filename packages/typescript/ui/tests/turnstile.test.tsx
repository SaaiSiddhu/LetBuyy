import React, { StrictMode, createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget, type TurnstileHandle } from '../src/turnstile';
import { loadTurnstile, mountTurnstile, type TurnstileApi } from '../src/turnstile-client';

type Options = Record<string, unknown>;
type Browser = Window & { turnstile?: TurnstileApi };
const browser = window as Browser;
function sdk() {
    const options: Options[] = [];
    const render = vi.fn((_container: HTMLElement, config: Options) => { options.push(config); return `widget-${options.length}`; });
    const remove = vi.fn();
    browser.turnstile = { render, remove };
    return { options, render, remove };
}
function call(options: Options, name: string, ...args: unknown[]) {
    (options[name] as (...args: unknown[]) => void)(...args);
}
afterEach(() => { delete browser.turnstile; document.querySelectorAll('script[data-lb-turnstile]').forEach((script) => script.remove()); vi.useRealTimers(); });

describe('shared Turnstile lifecycle', () => {
    it('ends an SDK load that never becomes ready without an automatic retry loop', async () => {
        vi.useFakeTimers();
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const isolated = frame.contentWindow!;
        const pending = loadTurnstile(isolated);
        const failed = expect(pending).rejects.toThrow('unavailable');
        await vi.advanceTimersByTimeAsync(15_001);
        await failed;
        expect(isolated.document.querySelectorAll('script[data-lb-turnstile]')).toHaveLength(0);
        frame.remove();
    });
    it('shares a cold SDK load, uses explicit rendering and recovers after a blocked script', async () => {
        const first = loadTurnstile();
        expect(loadTurnstile()).toBe(first);
        const script = document.querySelector<HTMLScriptElement>('script[data-lb-turnstile]')!;
        expect(script.src).toContain('?render=explicit');
        const failed = expect(first).rejects.toThrow('unavailable');
        script.dispatchEvent(new Event('error'));
        await failed;
        expect(document.contains(script)).toBe(false);
        const next = loadTurnstile();
        expect(next).not.toBe(first);
        const fixture = sdk();
        document.querySelector('script[data-lb-turnstile]')!.dispatchEvent(new Event('load'));
        await expect(next).resolves.toBe(browser.turnstile);
        expect(fixture.render).not.toHaveBeenCalled();
    });

    it('renders one active widget under StrictMode and does not challenge again on callback rerenders', async () => {
        const fixture = sdk();
        const onVerify = vi.fn();
        const ref = createRef<TurnstileHandle>();
        const view = render(<StrictMode><TurnstileWidget ref={ref} siteKey="fixture" onVerify={onVerify} /></StrictMode>);
        await act(async () => {});
        expect(fixture.render).toHaveBeenCalledTimes(1);
        const initial = fixture.options[0];
        expect(initial).toMatchObject({ appearance: 'interaction-only', size: 'flexible', retry: 'never', 'refresh-expired': 'auto' });
        act(() => call(initial, 'callback', 'token-one'));
        expect(onVerify).toHaveBeenLastCalledWith('token-one');
        const nextCallback = vi.fn();
        view.rerender(<StrictMode><TurnstileWidget ref={ref} siteKey="fixture" onVerify={nextCallback} /></StrictMode>);
        expect(fixture.render).toHaveBeenCalledTimes(1);
        act(() => ref.current!.reset());
        expect(nextCallback).toHaveBeenLastCalledWith('');
        await act(async () => {});
        expect(fixture.remove).toHaveBeenCalledWith('widget-1');
        act(() => call(initial, 'callback', 'late-spent-token'));
        expect(nextCallback).toHaveBeenLastCalledWith('');
        act(() => call(fixture.options[1], 'callback', 'token-two'));
        expect(nextCallback).toHaveBeenLastCalledWith('token-two');
        view.unmount();
        expect(nextCallback).toHaveBeenLastCalledWith('');
    });

    it('lets the SDK refresh expiry once, invalidates timeouts and offers bounded manual retry', async () => {
        const fixture = sdk();
        const onVerify = vi.fn();
        render(<TurnstileWidget siteKey="fixture" onVerify={onVerify} />);
        await act(async () => {});
        act(() => call(fixture.options[0], 'callback', 'token'));
        act(() => call(fixture.options[0], 'expired-callback'));
        expect(onVerify).toHaveBeenLastCalledWith('');
        expect(fixture.render).toHaveBeenCalledTimes(1);
        act(() => call(fixture.options[0], 'timeout-callback'));
        fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
        await act(async () => {});
        expect(fixture.render).toHaveBeenCalledTimes(2);
        act(() => call(fixture.options[1], 'error-callback', '110200'));
        expect(screen.getByRole('status').textContent).toContain('temporarily unavailable');
        expect(screen.queryByRole('button', { name: 'Retry verification' })).toBeNull();
    });

    it('isolates concurrent forms and rejects late callbacks after unmount', async () => {
        const fixture = sdk();
        const a = vi.fn(); const b = vi.fn();
        const first = document.createElement('div'); const second = document.createElement('div');
        document.body.append(first, second);
        const one = mountTurnstile(first, { siteKey: 'fixture', onToken: a });
        const two = mountTurnstile(second, { siteKey: 'fixture', onToken: b });
        await Promise.resolve();
        one.destroy();
        call(fixture.options[0], 'callback', 'stale');
        call(fixture.options[1], 'callback', 'fresh');
        expect(a).toHaveBeenLastCalledWith('');
        expect(b).toHaveBeenLastCalledWith('fresh');
        two.destroy(); first.remove(); second.remove();
    });

    it('fails closed without configuration and restores a fresh challenge from back-forward cache', async () => {
        const fixture = sdk();
        const token = vi.fn();
        const view = render(<TurnstileWidget siteKey="" onVerify={token} />);
        expect(fixture.render).not.toHaveBeenCalled();
        expect(token).toHaveBeenLastCalledWith('');
        view.rerender(<TurnstileWidget siteKey="fixture" onVerify={token} />);
        await act(async () => {});
        act(() => call(fixture.options[0], 'callback', 'old'));
        act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        expect(token).toHaveBeenLastCalledWith('');
        await act(async () => {});
        expect(fixture.render).toHaveBeenCalledTimes(2);
    });
});
