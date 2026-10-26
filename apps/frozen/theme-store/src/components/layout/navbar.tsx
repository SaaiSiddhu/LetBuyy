'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { Button, ChevronDown, Drawer, Input, Menu, Modal, Popover, Search, ThemeToggleButton } from '@letbuyy/ui';
import BrandLogo from '@/components/brand-logo';
import { useAuth } from '@/hooks/useAuth';
import { getAccountsUrl, getThemeMarketplaceUrl } from '@/lib/public-urls';
import { isCommandSearchShortcut } from '@/lib/utils';

const BROWSE_LINKS = [
    {label:'All themes',href:'/themes'},
    {label:'Explore collections',href:'/collections'},
    {label:'Free themes',href:'/themes?pricing=free'},
    {label:'New themes',href:'/themes?sort=recent'},
    {label:'Popular themes',href:'/themes?sort=popular'},
    {label:'Online stores',href:'/themes?category=store'},
    {label:'Portfolios',href:'/themes?category=portfolio'},
    {label:'Landing pages',href:'/themes?category=landing'},
    {label:'Professional profiles',href:'/themes?category=resume'},
    {label:'SaaS presentation',href:'/themes?category=saas'},
    {label:'Compare themes',href:'/themes/compare'},
];

const LEARN_LINKS = [{label:'Theme guides',href:'/guides'},{label:'Documentation',href:'/docs'},{label:'Frequently asked questions',href:'/faq'},{label:'Theme pricing',href:'/pricing'},{label:'For theme creators',href:'/for-creators'},{label:'About LetBuyy Themes',href:'/about'},{label:'Legal and privacy',href:'/legal'}];
const LIBRARY_LINKS = [{label:'Your theme library',href:'/dashboard'},{label:'Saved themes',href:'/dashboard/favorites'},{label:'Installations and releases',href:'/dashboard/installations'},{label:'Purchases and licenses',href:'/dashboard/purchases'},{label:'Downloads',href:'/dashboard/downloads'},{label:'Marketplace settings',href:'/dashboard/settings'}];
const MENUS = [{key:'browse',label:'Browse themes',links:BROWSE_LINKS},{key:'learn',label:'Learn',links:LEARN_LINKS},{key:'library',label:'My themes',links:LIBRARY_LINKS}];

export default function Navbar() {
    const { isAuthenticated, signOut } = useAuth();
    const pathname = usePathname();
    const [searchOpen,setSearchOpen] = useState(false);
    const [mobileOpen,setMobileOpen] = useState(false);
    const [openMenu,setOpenMenu] = useState<string | null>(null);

    useEffect(()=>{
        function shortcut(event:KeyboardEvent) {
            if(isCommandSearchShortcut(event)) { event.preventDefault(); setSearchOpen(open=>!open); }
        }
        window.addEventListener('keydown',shortcut);
        return ()=>window.removeEventListener('keydown',shortcut);
    },[]);

    function accountHref(path:string) {
        const url=new URL(path,getAccountsUrl());
        // The server boundary remains authoritative; this only keeps navigation context.
        url.searchParams.set('return_to',getThemeMarketplaceUrl(pathname));
        return url.toString();
    }

    function preserveReturnTo(event: MouseEvent<HTMLAnchorElement>) {
        const url = new URL(event.currentTarget.href);
        url.searchParams.set('return_to',window.location.href);
        event.currentTarget.href = url.toString();
    }

    function closeNavigation() { setMobileOpen(false); setOpenMenu(null); }

    return <>
        <a href="#marketplace-main" className="marketplace-skip-link">Skip to themes</a>
        <header className="marketplace-header">
            <div className="marketplace-container marketplace-header-inner">
                <Link href="/" className="marketplace-brand" aria-label="LetBuyy Themes home" onClick={closeNavigation}><BrandLogo width={142} height={44} priority /><span>Themes</span></Link>
                <nav className="marketplace-desktop-nav" aria-label="Main navigation">
                    {MENUS.map(menu => <Popover key={menu.key} open={openMenu===menu.key} onOpenChange={open=>setOpenMenu(open?menu.key:null)} ariaLabel={menu.label} trigger={<Button variant="ghost">{menu.label} <ChevronDown size={14} aria-hidden="true" /></Button>}>
                        <div className="marketplace-browse-menu">{menu.links.map(link=><Link href={link.href} key={link.href} aria-current={pathname===link.href?'page':undefined} onClick={closeNavigation}>{link.label}</Link>)}</div>
                    </Popover>)}
                    <Link href="/support" aria-current={pathname==='/support'?'page':undefined}>Support</Link>
                </nav>
                <div className="marketplace-header-actions">
                    <Button variant="ghost" size="icon" aria-label="Search themes" onClick={()=>setSearchOpen(true)}><Search aria-hidden="true" /></Button>
                    <span className="marketplace-theme-toggle"><ThemeToggleButton /></span>
                    <div className="marketplace-account-nav">
                        {isAuthenticated ? <><Link href="/dashboard" className="marketplace-header-login">Your library</Link><Button variant="ghost" onClick={()=>void signOut()}>Log out</Button></> : <><a href={accountHref('/lookup')} onClick={preserveReturnTo} className="marketplace-header-login">Log in</a><a href={accountHref('/signup')} onClick={preserveReturnTo} className="marketplace-action">Start for free</a></>}
                    </div>
                    <Button className="marketplace-mobile-menu-trigger" variant="ghost" size="icon" aria-label="Open menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu aria-hidden="true" /></Button>
                </div>
            </div>
        </header>
        <Drawer open={mobileOpen} onClose={()=>setMobileOpen(false)} title="LetBuyy Themes" side="right" size="md">
            <nav aria-label="Mobile navigation" className="marketplace-mobile-navigation">
                {MENUS.map(menu=><section key={menu.key} className="marketplace-mobile-nav-group"><h2>{menu.label}</h2>{menu.links.map(link=><Link href={link.href} key={link.href} aria-current={pathname===link.href?'page':undefined} onClick={closeNavigation}>{link.label}</Link>)}</section>)}
                <Link href="/support" onClick={closeNavigation}>Support center</Link><Link href="/contact" onClick={closeNavigation}>Contact</Link>
                {isAuthenticated ? <Link href="/dashboard" onClick={closeNavigation}>Your library</Link> : <a href={accountHref('/lookup')} onClick={preserveReturnTo}>Log in</a>}
                <ThemeToggleButton />
            </nav>
        </Drawer>
        <Modal open={searchOpen} onClose={()=>setSearchOpen(false)} title="Find your theme" description="Search by name, style, or a feature your business needs.">
            <form action="/themes" method="get" role="search" className="marketplace-search-form" onSubmit={()=>setSearchOpen(false)}>
                <Input label="Search themes" name="q" type="search" placeholder="Try minimal, clothing, or portfolio" maxLength={80} autoFocus />
                <Button type="submit">Search themes</Button>
            </form>
            <div className="marketplace-search-suggestions"><p>Explore a little</p>{BROWSE_LINKS.slice(0,4).map(link=><Link key={link.href} href={link.href} onClick={()=>setSearchOpen(false)}>{link.label}</Link>)}</div>
        </Modal>
    </>;
}
