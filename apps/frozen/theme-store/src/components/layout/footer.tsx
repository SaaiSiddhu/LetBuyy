'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Checkbox, Modal } from '@letbuyy/ui';
import BrandLogo from '@/components/brand-logo';

const PLATFORM_URL = process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || 'https://letbuyy.com';
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@letbuyy.com';
const columns = [
    {title:'Explore',links:[['All themes','/themes'],['Free themes','/themes?pricing=free'],['Recently added','/themes?sort=recent'],['Compare themes','/themes/compare']]},
    {title:'Make it yours',links:[['Theme guide','/docs'],['Your library','/dashboard'],['Saved themes','/dashboard/favorites'],['LetBuyy platform',PLATFORM_URL]]},
    {title:'We’re here to help',links:[['Help centre','/support'],['Contact us','/contact'],['About Themes','/about'],['Theme licence','/legal/license']]},
];

export default function Footer() {
    const [privacyOpen,setPrivacyOpen]=useState(false);
    const [analytics,setAnalytics]=useState(false);
    const [personalization,setPersonalization]=useState(false);
    function openPrivacy() {
        try {
            const stored=JSON.parse(window.localStorage.getItem('letbuyy_privacy_choices') || '{}');
            setAnalytics(stored.analytics===true);setPersonalization(stored.personalization===true);
        } catch { setAnalytics(false);setPersonalization(false); }
        setPrivacyOpen(true);
    }
    function savePrivacy() {
        window.localStorage.setItem('letbuyy_privacy_choices',JSON.stringify({analytics,personalization,savedAt:new Date().toISOString()}));
        setPrivacyOpen(false);
    }
    return <footer className="marketplace-footer" aria-labelledby="site-footer-heading">
        <div className="marketplace-container">
            <h2 id="site-footer-heading" className="sr-only">LetBuyy Themes footer</h2>
            <div className="marketplace-footer-grid">
                <div><Link href="/" aria-label="LetBuyy Themes home"><BrandLogo width={158} height={48} /></Link><p className="marketplace-footer-tagline">A home for your next great look.<br />Built for your business, on LetBuyy.</p></div>
                {columns.map(column=><nav key={column.title} aria-label={column.title}><h3>{column.title}</h3><ul>{column.links.map(([label,href])=><li key={label}><Link href={href}>{label}</Link></li>)}</ul></nav>)}
            </div>
            <div className="marketplace-footer-bottom"><span>© {new Date().getFullYear()} LetBuyy</span><span>India · English</span><nav aria-label="Legal links"><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/refund">Refunds</Link><Button variant="ghost" size="sm" onClick={openPrivacy}>Your Privacy Choices</Button></nav></div>
            <a className="marketplace-footer-contact" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
        <Modal title="Your Privacy Choices" description="Essential preferences keep the site working. Choose whether to allow optional preferences on this browser." open={privacyOpen} onClose={()=>setPrivacyOpen(false)} footer={<Button onClick={savePrivacy}>Save choices</Button>}>
            <div className="marketplace-filter-fields"><Checkbox label="Analytics" checked={analytics} onCheckedChange={setAnalytics} /><Checkbox label="Personalization" checked={personalization} onCheckedChange={setPersonalization} /></div>
        </Modal>
    </footer>;
}
