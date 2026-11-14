import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InternalWorkspace } from '../../src/internal-workspace';

afterEach(cleanup);
describe('Internal workspace landmarks', () => {
    it('keeps a main landmark for standalone consumers', () => {
        render(<InternalWorkspace eyebrow="Operations" title="Overview" description="Platform status"><p>Content</p></InternalWorkspace>);
        expect(screen.getByRole('main').contains(screen.getByRole('heading', { name: 'Overview' }))).toBe(true);
    });
    it('composes into a shell without introducing a nested main landmark', () => {
        render(<main><InternalWorkspace as="section" className="console-workspace" eyebrow="Operations" title="Overview" description="Platform status"><p>Content</p></InternalWorkspace></main>);
        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getByRole('heading', { name: 'Overview' }).closest('section')?.classList.contains('console-workspace')).toBe(true);
    });
});
