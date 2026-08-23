import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
}

if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
}

// jsdom has MutationObserver but not ResizeObserver, and Sidebar mounts a
// ScrollThumb — which constructs one — for every rail. Without this stub, any
// test that renders an app shell throws before it can assert anything. A no-op
// is enough: jsdom reports zero geometry, so the thumb has nothing to draw.
if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

afterEach(() => {
    cleanup();
});
