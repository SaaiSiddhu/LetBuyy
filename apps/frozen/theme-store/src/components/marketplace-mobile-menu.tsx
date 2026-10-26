import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, LayoutGrid, Palette, ArrowRight } from '@letbuyy/ui';
import { Gift, Columns2 } from 'lucide-react';

interface MenuLink { label: string; href: string }
export default function MarketplaceMobileMenu({ groups, pathname, onNavigate }: {
    groups: { key: string; label: string; links: MenuLink[] }[]; pathname: string; onNavigate: () => void;
}) {
    const quick = [
        { label: 'All themes', href: '/themes', icon: LayoutGrid, image: 'wardrobe' },
        { label: 'Collections', href: '/collections', icon: Palette, image: 'living' },
        { label: 'Free themes', href: '/themes?pricing=free', icon: Gift, image: 'pantry' },
        { label: 'Compare', href: '/themes/compare', icon: Columns2, image: 'care' },
    ];
    const quickPaths = new Set(quick.map(item=>item.href));
    return <nav className="marketplace-menu-content" aria-label="Mobile navigation">
        <div className="marketplace-menu-quick">{quick.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined} onClick={onNavigate}><span className="marketplace-menu-shortcut-image" aria-hidden="true"><Image src={`/showcase/${item.image}.webp`} alt="" fill sizes="(max-width: 640px) 160px, 240px" /></span><item.icon size={20} aria-hidden="true"/><span>{item.label}</span><ArrowRight size={14} aria-hidden="true"/></Link>)}</div>
        <div className="marketplace-menu-groups">{groups.map(group=>{const links=group.key==='browse'?group.links.filter(item=>!quickPaths.has(item.href)):group.links;return <details key={group.key}><summary><span>{group.key==='browse'?'Browse store themes':group.label}</span><span>{links.length}</span><ChevronDown size={16} aria-hidden="true"/></summary><div>{links.map(link=><Link key={link.href} href={link.href} onClick={onNavigate} aria-current={pathname===link.href?'page':undefined}>{link.label}<ArrowRight size={14} aria-hidden="true"/></Link>)}</div></details>;})}</div>
        <div className="marketplace-menu-help"><Link href="/support" onClick={onNavigate}>Support center <ArrowRight size={14} aria-hidden="true"/></Link><Link href="/contact" onClick={onNavigate}>Contact us <ArrowRight size={14} aria-hidden="true"/></Link></div>
    </nav>;
}
