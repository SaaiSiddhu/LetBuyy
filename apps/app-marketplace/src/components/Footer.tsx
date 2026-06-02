import Link from 'next/link';
import { Heart } from '@letbuyy/ui';

export function Footer() {
    return (
        <footer className="appstore-footer">
            <div className="appstore-footer-inner">
                <div className="appstore-footer-brand">
                    <h3>LetBuyy App Store</h3>
                    <p>
                        Discover powerful apps and integrations to grow your online business.
                        Built for Indian entrepreneurs.
                    </p>
                </div>

                <div className="appstore-footer-col">
                    <h4>Marketplace</h4>
                    <Link href="/">Browse Apps</Link>
                    <Link href="/categories">Categories</Link>
                    <Link href="/collections/staff-picks">Staff Picks</Link>
                    <Link href="/search">Search</Link>
                </div>

                <div className="appstore-footer-col">
                    <h4>Developers</h4>
                    <Link href="/developers">Developer Portal</Link>
                    <Link href="/developers/register">Become a Developer</Link>
                    <a href="https://docs.letbuyy.store/apps" target="_blank" rel="noreferrer">Documentation</a>
                    <a href="https://docs.letbuyy.store/api" target="_blank" rel="noreferrer">API Reference</a>
                </div>

                <div className="appstore-footer-col">
                    <h4>LetBuyy</h4>
                    <a href="https://letbuyy.store" target="_blank" rel="noreferrer">Home</a>
                    <a href="https://admin.letbuyy.store" target="_blank" rel="noreferrer">Admin</a>
                    <a href="https://themes.letbuyy.store" target="_blank" rel="noreferrer">Themes</a>
                    <a href="mailto:support@letbuyy.store">Support</a>
                </div>
            </div>

            <div className="appstore-footer-bottom">
                <span>© {new Date().getFullYear()} LetBuyy. All rights reserved.</span>
                <span className="inline-flex items-center gap-1">
                    Made with <Heart className="h-4 w-4" aria-hidden="true" /> in India
                </span>
            </div>
        </footer>
    );
}
