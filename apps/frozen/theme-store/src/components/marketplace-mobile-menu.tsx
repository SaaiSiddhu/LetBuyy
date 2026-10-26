import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, LayoutGrid, Palette, ArrowRight } from '@letbuyy/ui';
import { Gift, Columns2 } from 'lucide-react';

interface MenuLink { label: string; href: string }
export default function MarketplaceMobileMenu({ groups, pathname, onNavigate }: {
    groups: { key: string; label: string; links: MenuLink[] }[]; pathname: string; onNavigate: () => void;
}) {
    const quick = [
        { label: 'All themes', href: '/themes', icon: LayoutGrid, artwork: 'discover', description: 'Find your store’s look' },
        { label: 'Collections', href: '/collections', icon: Palette, artwork: 'library', description: 'Explore curated styles' },
        { label: 'Free themes', href: '/themes?pricing=free', icon: Gift, artwork: 'menu-storefront', description: 'Start without a theme fee' },
        { label: 'Compare', href: '/themes/compare', icon: Columns2, artwork: 'compare', description: 'Review your shortlist' },
    ];
    const quickPaths = new Set(quick.map(item=>item.href));
    return <nav className="marketplace-menu-content" aria-label="Mobile navigation">
        <div className="marketplace-menu-quick">{quick.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined} onClick={onNavigate}>
            <span className={`menu-shortcut-background${item.artwork==='compare'?' menu-shortcut-background-compare':''}`} aria-hidden="true">{(item.artwork==='compare'?['discover','library']:[item.artwork]).map(art=><Image key={art} src={`/illustrations/${art}.webp`} alt="" width={960} height={720} sizes="(max-width: 640px) 180px, 240px" />)}</span>
            <span className="menu-shortcut-symbol"><item.icon size={20} aria-hidden="true"/></span><ArrowRight className="menu-shortcut-arrow" size={14} aria-hidden="true"/>
            <span className="menu-shortcut-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
        </Link>)}</div>
        <div className="marketplace-menu-groups">{groups.map(group=>{const links=group.key==='browse'?group.links.filter(item=>!quickPaths.has(item.href)):group.links;return <details key={group.key}><summary><span>{group.key==='browse'?'Browse store themes':group.label}</span><span>{links.length}</span><ChevronDown size={16} aria-hidden="true"/></summary><div>{links.map(link=><Link key={link.href} href={link.href} onClick={onNavigate} aria-current={pathname===link.href?'page':undefined}>{link.label}<ArrowRight size={14} aria-hidden="true"/></Link>)}</div></details>;})}</div>
        <div className="marketplace-menu-help"><Link href="/support" onClick={onNavigate}>Support center <ArrowRight size={14} aria-hidden="true"/></Link><Link href="/contact" onClick={onNavigate}>Contact us <ArrowRight size={14} aria-hidden="true"/></Link></div>
    </nav>;
}
