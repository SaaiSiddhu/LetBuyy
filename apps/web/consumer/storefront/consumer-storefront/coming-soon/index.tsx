'use client';

import StoreComingSoon from './components/store/store-coming-soon';
import PortfolioComingSoon from './components/portfolio/portfolio-coming-soon';
import ResumeComingSoon from './components/resume/resume-coming-soon';
import LandingComingSoon from './components/landing/landing-coming-soon';
import BlogComingSoon from './components/blog/blog-coming-soon';

export type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog';

interface ComingSoonRouterProps {
    siteType: SiteType;
    storeName: string;
    tagline?: string;
    logoUrl?: string;
    launchDate?: string;
}

export default function ComingSoonRouter({ siteType, storeName, tagline, logoUrl, launchDate }: ComingSoonRouterProps) {
    const props = { storeName, tagline, logoUrl, launchDate };

    switch (siteType) {
        case 'store':
            return <StoreComingSoon {...props} />;
        case 'portfolio':
            return <PortfolioComingSoon {...props} />;
        case 'resume':
            return <ResumeComingSoon {...props} />;
        case 'landing':
            return <LandingComingSoon {...props} />;
        case 'blog':
            return <BlogComingSoon {...props} />;
        default:
            return <StoreComingSoon {...props} />;
    }
}
