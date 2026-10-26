import Link from 'next/link';
import { ChevronDown, LayoutGrid, Palette, ArrowRight, Check } from '@letbuyy/ui';
import { Gift, Columns2 } from 'lucide-react';

type ShortcutArtwork = 'themes' | 'collections' | 'free' | 'compare';

function MiniStorefront() {
    return <span className="menu-mini-store"><span className="menu-mini-chrome"><i/><i/><i/></span><span className="menu-mini-banner"/><span className="menu-mini-products"><i/><i/><i/></span></span>;
}

/** Decorative website compositions explain the destination, not actual inventory. */
function ShortcutIllustration({kind}: {kind: ShortcutArtwork}) {
    return <span className={`menu-shortcut-art menu-shortcut-art-${kind}`} aria-hidden="true">
        {kind === 'themes' ? <><MiniStorefront/><MiniStorefront/><MiniStorefront/></> : kind === 'collections' ? <><MiniStorefront/><MiniStorefront/><span className="menu-art-swatches"><i/><i/><i/></span></> : kind === 'free' ? <><MiniStorefront/><span className="menu-art-free"><Gift size={18}/><Check size={12}/></span></> : <><MiniStorefront/><MiniStorefront/><span className="menu-art-compare"><Columns2 size={16}/></span></>}
    </span>;
}

interface MenuLink { label: string; href: string }
export default function MarketplaceMobileMenu({ groups, pathname, onNavigate }: {
    groups: { key: string; label: string; links: MenuLink[] }[]; pathname: string; onNavigate: () => void;
}) {
    const quick = [
        { label: 'All themes', href: '/themes', icon: LayoutGrid, artwork: 'themes' as const },
        { label: 'Collections', href: '/collections', icon: Palette, artwork: 'collections' as const },
        { label: 'Free themes', href: '/themes?pricing=free', icon: Gift, artwork: 'free' as const },
        { label: 'Compare', href: '/themes/compare', icon: Columns2, artwork: 'compare' as const },
    ];
    const quickPaths = new Set(quick.map(item=>item.href));
    return <nav className="marketplace-menu-content" aria-label="Mobile navigation">
        <div className="marketplace-menu-quick">{quick.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined} onClick={onNavigate}><span className="menu-shortcut-heading"><item.icon size={18} aria-hidden="true"/><span>{item.label}</span><ArrowRight size={14} aria-hidden="true"/></span><ShortcutIllustration kind={item.artwork}/></Link>)}</div>
        <div className="marketplace-menu-groups">{groups.map(group=>{const links=group.key==='browse'?group.links.filter(item=>!quickPaths.has(item.href)):group.links;return <details key={group.key}><summary><span>{group.key==='browse'?'Browse store themes':group.label}</span><span>{links.length}</span><ChevronDown size={16} aria-hidden="true"/></summary><div>{links.map(link=><Link key={link.href} href={link.href} onClick={onNavigate} aria-current={pathname===link.href?'page':undefined}>{link.label}<ArrowRight size={14} aria-hidden="true"/></Link>)}</div></details>;})}</div>
        <div className="marketplace-menu-help"><Link href="/support" onClick={onNavigate}>Support center <ArrowRight size={14} aria-hidden="true"/></Link><Link href="/contact" onClick={onNavigate}>Contact us <ArrowRight size={14} aria-hidden="true"/></Link></div>
    </nav>;
}
