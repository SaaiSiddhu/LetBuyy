import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Card, FormProtectionProvider, MetricCard, PageHeader, SaveBar, Section } from '../../src';
import { letbuyySurfaceTokens } from '../../src/tokens';

function contrast(a: string, b: string) {
    const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((n, c, i) => n + c * [.2126, .7152, .0722][i], 0);
    const [x, y] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (x + .05) / (y + .05);
}

describe('premium canonical admin compositions', () => {
    it('keeps action, inverse text, links, focus and essential control boundaries legible without recoloring other surfaces', () => {
        const admin = letbuyySurfaceTokens.admin.light;
        expect(admin['--lb-component-sidebar-bg']).toBe('#1E1A2D');
        expect(admin['--lb-color-primary-active']).toBe('#181524');
        expect(admin['--lb-color-primary-soft']).toBe('#E7E3F7');
        for (const role of ['bg', 'hover', 'active']) expect(contrast(admin['--lb-component-button-primary-text'], admin[`--lb-component-button-primary-${role}`])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(admin['--lb-color-primary-text'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
        expect(contrast(admin['--lb-color-focus-ring'], '#FFFFFF')).toBeGreaterThanOrEqual(3);
        expect(contrast(admin['--lb-component-input-border'], '#FFFFFF')).toBeGreaterThanOrEqual(3);
        expect(contrast(admin['--lb-component-save-bar-text'], admin['--lb-component-save-bar-bg'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(admin['--lb-component-save-bar-action-text'], admin['--lb-component-save-bar-action-bg'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(admin['--lb-component-save-bar-focus'], admin['--lb-component-save-bar-bg'])).toBeGreaterThanOrEqual(3);
        expect(letbuyySurfaceTokens.storefront.light['--lb-color-primary']).toBe('#8B5CF6');
        expect(letbuyySurfaceTokens.identity.light['--lb-component-save-bar-bg']).toBeUndefined();
        expect(admin['--lb-component-banner-danger-text']).toBe(letbuyySurfaceTokens.identity.light['--lb-component-banner-danger-text']);
    });

    it('keeps solid semantic statuses legible, including composited translucent descriptions', () => {
        const admin = letbuyySurfaceTokens.admin.light;
        const opacity = Number(admin['--lb-component-feedback-description-opacity']);
        const descriptionColor = (bg: string) => '#' + bg.slice(1).match(/../g)!.map(c => Math.round(255 * opacity + parseInt(c, 16) * (1 - opacity)).toString(16).padStart(2, '0')).join('');
        for (const family of ['toast', 'banner-solid', 'badge-solid']) {
            for (const tone of ['info', 'success', 'warning', 'danger']) {
                const bg = admin[`--lb-component-${family}-${tone}-bg`];
                expect(contrast('#FFFFFF', bg)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(descriptionColor(bg), bg)).toBeGreaterThanOrEqual(4.5);
            }
        }
        expect(admin['--lb-component-badge-solid-warning-bg']).not.toBe(admin['--lb-color-primary']);
    });

    it('groups Settings fields with the same single boundary and heading language as a main form', () => {
        const { container } = render(<><Card><Section title="Main form">Main fields</Section></Card><Section variant="grouped" title="Settings form" description="Help" columns={2} action={<button>Configure</button>}><input aria-label="One" /><input aria-label="Two" /></Section><MetricCard label="Orders" value="—" /></>);
        const cards = container.querySelectorAll('[data-lb-card-layout]');
        expect(cards).toHaveLength(3);
        expect(cards[1].querySelector('[data-lb-card-layout]')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Main form' }).className).toBe(screen.getByRole('heading', { name: 'Settings form' }).className);
        expect(screen.getByRole('button', { name: 'Configure' })).toBeTruthy();
        expect(screen.getByLabelText('Two')).toBeTruthy();
        expect(screen.getByText('—')).toBeTruthy();
    });

    it('exposes save capabilities accurately and leaves acknowledgement to the form owner', async () => {
        const register = vi.fn(), onSave = vi.fn(async () => {}), onDiscard = vi.fn();
        const view = (disabled: boolean) => <FormProtectionProvider register={register}><SaveBar state="unsaved" onSave={onSave} onDiscard={onDiscard} saveDisabled={disabled} discardDisabled /></FormProtectionProvider>;
        const { rerender } = render(view(true));
        expect(register.mock.lastCall?.[1]).toMatchObject({ dirty: true, canSave: false, canDiscard: false });
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
        expect(onSave).not.toHaveBeenCalled();
        rerender(view(false));
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
        await Promise.resolve();
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(register.mock.lastCall?.[1].dirty).toBe(true);
        expect(screen.getByText('Unsaved changes')).toBeTruthy();
    });

    it('preserves explicit header context, overflow and disabled navigation during pending actions', () => {
        const { container } = render(<PageHeader title="A long translated record name" recipe="record" identity="products" titleAdornment={<span>Draft</span>} primaryAction={{ label: 'Save product', loading: true, loadingLabel: 'Saving product' }} secondaryActions={[{ label: 'View product', href: '/product', disabled: true }]} overflowAction={<button aria-label="More record actions">More</button>} />);
        expect(container.querySelector('[data-lb-page-header-recipe="record"]')).toBeTruthy();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('A long translated record name');
        expect(screen.getByText('View product').closest('a')?.hasAttribute('href')).toBe(false);
        expect(screen.getByRole('button', { name: 'More record actions' })).toBeTruthy();
    });
});
