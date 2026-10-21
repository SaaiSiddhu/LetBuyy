import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Breadcrumbs, Button, DesignSystemRoot, NavigationLinkProvider, PageHeader } from '../../src';

function RouterLink(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <a {...props} data-router-link="true" />;
}

function renderWithRouter(children: React.ReactNode) {
    return render(<DesignSystemRoot><NavigationLinkProvider linkComponent={RouterLink}>{children}</NavigationLinkProvider></DesignSystemRoot>);
}

describe('NavigationLinkProvider', () => {
    it('keeps native anchors as the default for apps without an adapter', () => {
        render(<DesignSystemRoot><Button as="a" href="/products">Products</Button><Breadcrumbs items={[{ label: 'Home', href: '/home' }]} /></DesignSystemRoot>);
        for (const name of ['Products', 'Home']) {
            const link = screen.getByRole('link', { name });
            expect(link.tagName).toBe('A');
            expect(link.hasAttribute('data-router-link')).toBe(false);
        }
    });

    it('adapts page-header actions and breadcrumbs while preserving anchor attributes', () => {
        renderWithRouter(<>
            <PageHeader title="Orders" showBreadcrumbs breadcrumbs={[{ label: 'Home', href: '/home' }, { label: 'Orders' }]}
                primaryAction={{ label: 'New order', href: '/orders/new' }} secondaryActions={[{ label: 'Products', href: '/products' }]} />
            <Button as="a" href="https://example.invalid" target="_blank" rel="noreferrer">External</Button>
        </>);
        for (const [name, href] of [['Home', '/home'], ['New order', '/orders/new'], ['Products', '/products'], ['External', 'https://example.invalid']]) {
            const link = screen.getByRole('link', { name });
            expect(link.getAttribute('data-router-link')).toBe('true');
            expect(link.getAttribute('href')).toBe(href);
        }
        expect(screen.getByRole('link', { name: 'External' }).getAttribute('target')).toBe('_blank');
        expect(screen.getByRole('link', { name: 'External' }).getAttribute('rel')).toBe('noreferrer');
    });

    it('prevents disabled and loading anchor actions from navigating or firing callbacks', () => {
        const onClick = vi.fn();
        renderWithRouter(<><Button as="a" href="/orders" disabled onClick={onClick}>Disabled</Button><Button as="a" href="/orders" loading onClick={onClick}>Loading</Button></>);
        for (const text of ['Disabled', 'Loading']) {
            const anchor = screen.getByText(text).closest('a')!;
            expect(anchor.getAttribute('data-router-link')).toBe('true');
            expect(anchor.hasAttribute('href')).toBe(false);
            expect(anchor.getAttribute('aria-disabled')).toBe('true');
            expect(fireEvent.click(anchor)).toBe(false);
        }
        expect(onClick).not.toHaveBeenCalled();
    });

    it('keeps button and asChild click behavior intact inside the provider', () => {
        const button = vi.fn(), child = vi.fn(), wrapper = vi.fn();
        renderWithRouter(<><Button onClick={button}>Save</Button><Button asChild onClick={wrapper}><a href="#draft" onClick={child}>Draft</a></Button></>);
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        fireEvent.click(screen.getByRole('link', { name: 'Draft' }));
        expect(button).toHaveBeenCalledTimes(1);
        expect(child).toHaveBeenCalledTimes(1);
        expect(wrapper).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: 'Draft' }).hasAttribute('data-router-link')).toBe(false);
    });

    it('uses the closest app adapter when providers are nested', () => {
        const InnerLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} data-inner-link="true" />;
        renderWithRouter(<NavigationLinkProvider linkComponent={InnerLink}><Button as="a" href="/orders">Orders</Button></NavigationLinkProvider>);
        expect(screen.getByRole('link', { name: 'Orders' }).getAttribute('data-inner-link')).toBe('true');
        expect(screen.getByRole('link', { name: 'Orders' }).hasAttribute('data-router-link')).toBe(false);
    });
});
