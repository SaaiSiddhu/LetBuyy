import Link from 'next/link';
import { ArrowRight, Check, Palette, Search, Input, Button } from '@letbuyy/ui';
import ThemeShowcase from './theme-showcase';

const CATEGORIES = [
    { slug: 'store', label: 'Online stores' },
    { slug: 'portfolio', label: 'Portfolios' },
    { slug: 'landing', label: 'Landing pages' },
    { slug: 'resume', label: 'Resumes' },
    { slug: 'saas', label: 'SaaS' },
];

export default function MarketplaceHero() {
    return <>
            <div className="marketplace-hero-stage">
                <div className="marketplace-hero-backdrop"><ThemeShowcase /></div>
            <section className="marketplace-hero marketplace-hero-overlay" aria-labelledby="marketplace-hero-heading">
                <div className="marketplace-container"><div className="marketplace-hero-copy">
                    <p className="marketplace-eyebrow"><Palette size={16} aria-hidden="true" /> LetBuyy Theme Store</p>
                    <h1 id="marketplace-hero-heading">Make your business <span>look like you.</span></h1>
                    <p className="marketplace-intro">Find a theme that fits your next chapter. Explore the design, try the demo, and make it your own with LetBuyy.</p>
                    <form action="/themes" method="get" className="marketplace-hero-search" role="search">
                        <label className="sr-only" htmlFor="home-theme-search">Search themes</label>
                        <Search size={20} aria-hidden="true" />
                        <Input unstyled id="home-theme-search" name="q" type="search" placeholder="Search themes, styles, or features" maxLength={80} />
                        <Button type="submit" size="sm">Search</Button>
                    </form>
                    <div className="marketplace-hero-actions">
                        <Link href="/themes" className="marketplace-action">Explore all themes <ArrowRight aria-hidden="true" /></Link>
                        <Link href="/themes?pricing=free" className="marketplace-text-link">Start with a free theme</Link>
                    </div>
                    <p className="marketplace-hero-note"><Check size={16} aria-hidden="true" /><span>Preview before you choose. Your products stay yours.</span></p>
                </div></div>
            </section>
            </div>
            <div className="marketplace-home-categories"><div className="marketplace-container">
                    <nav className="marketplace-category-nav" aria-label="Browse theme categories">
                        <Link href="/themes" aria-current="page">All themes</Link>
                        {CATEGORIES.map(category => <Link key={category.slug} href={`/themes?category=${category.slug}`}>{category.label}</Link>)}
                    </nav>
            </div></div>

    </>;
}
