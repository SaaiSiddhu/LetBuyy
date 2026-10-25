import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProtectionProvider, Page, PageHeader, SaveBar, Section } from '../../src';

describe('existing form compositions', () => {
    it('removes clean SaveBar controls and announcements instead of leaving hidden focus stops', () => {
        const { rerender, container } = render(<SaveBar state="unsaved" />);
        expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
        rerender(<SaveBar state="saved" />);
        expect(container.querySelector('button')).toBeNull();
        expect(container.textContent).not.toContain('Unsaved changes');
        rerender(<SaveBar state="saving" />);
        expect((screen.getByRole('button', { name: 'Discard' }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: 'Saving' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('reports current dirty/saving/clean state without storing fields and respects uncertain discard', () => {
        const register = vi.fn();
        const onSave = vi.fn(), onDiscard = vi.fn();
        const { rerender, unmount } = render(<FormProtectionProvider register={register}>
            <SaveBar state="unsaved" onSave={onSave} onDiscard={onDiscard} discardDisabled />
        </FormProtectionProvider>);
        expect(register.mock.lastCall?.[1]).toMatchObject({ dirty: true, canDiscard: false });
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        expect(onDiscard).not.toHaveBeenCalled();
        rerender(<FormProtectionProvider register={register}><SaveBar state="saved" /></FormProtectionProvider>);
        expect(register.mock.lastCall?.[1]).toMatchObject({ dirty: false });
        unmount();
        expect(register.mock.lastCall?.[1]).toBeNull();
    });

    it('returns keyboard focus to the task heading when an acknowledged save removes the focused bar', () => {
        const view = (state: 'saved' | 'unsaved') => <main><h1>General</h1><SaveBar state={state} onSave={() => {}} onDiscard={() => {}} /></main>;
        const { rerender } = render(view('unsaved'));
        screen.getByRole('button', { name: 'Save', exact: true }).focus();
        rerender(view('saved'));
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'General' }));
        expect(screen.queryByRole('button', { name: 'Save', exact: true })).toBeNull();
    });

    it('keeps a single shell landmark and grouped heading semantics with existing styling', () => {
        const { container, rerender } = render(<main><Page><Section variant="grouped" title="Store details">Fields</Section></Page></main>);
        expect(container.querySelectorAll('main')).toHaveLength(1);
        expect(screen.getByRole('heading', { name: 'Store details', level: 2 }).classList.contains('m-0')).toBe(true);
        rerender(<Page as="main">Standalone</Page>);
        expect(screen.getByRole('main').textContent).toBe('Standalone');
    });

    it('forwards header busy state to Button and prevents loading actions', () => {
        const onClick = vi.fn();
        render(<PageHeader title="Products" primaryAction={{ label: 'Save', loading: true, loadingLabel: 'Saving product', onClick }}
            secondaryActions={[{ label: 'Preview', href: '/preview', loading: true }]} />);
        const save = screen.getByRole('button', { name: 'Saving product' });
        expect((save as HTMLButtonElement).disabled).toBe(true);
        expect(save.getAttribute('aria-busy')).toBe('true');
        fireEvent.click(save);
        expect(onClick).not.toHaveBeenCalled();
        expect(screen.getByText('Preview').closest('a')?.hasAttribute('href')).toBe(false);
    });
});
