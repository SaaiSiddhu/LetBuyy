'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Banner,Button,Modal} from '@letbuyy/ui';
import BrandLogo from '@/components/brand-logo';
import {clearSavedThemeChoices} from '@/lib/browser-preferences';
const SUPPORT_EMAIL=process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@letbuyy.com';
const columns=[
    {title:'Explore',links:[['All themes','/themes'],['Collections and categories','/collections'],['Free themes','/themes?pricing=free'],['New themes','/themes?sort=recent'],['Compare themes','/themes/compare']]},
    {title:'Learn',links:[['Theme guides','/guides'],['Documentation','/docs'],['Pricing explained','/pricing'],['Frequently asked questions','/faq'],['About Themes','/about']]},
    {title:'My themes',links:[['Your library','/dashboard'],['Saved themes','/dashboard/favorites'],['Installations','/dashboard/installations'],['Purchases and licenses','/dashboard/purchases'],['Downloads','/dashboard/downloads'],['Settings','/dashboard/settings']]},
    {title:'Help and creators',links:[['Support center','/support'],['Contact us','/contact'],['Creator guidance','/for-creators'],['Author workspace','/developer'],['API reference','/docs/api'],['Legal and privacy','/legal']]},
];
export default function Footer(){
    const [privacyOpen,setPrivacyOpen]=useState(false);
    const [result,setResult]=useState<'cleared'|'error'|null>(null);
    function clearChoices(){try{clearSavedThemeChoices(window.localStorage);window.dispatchEvent(new CustomEvent('letbuyy-theme-preferences-changed'));setResult('cleared');}catch{setResult('error');}}
    return <footer className="marketplace-footer" aria-labelledby="site-footer-heading"><div className="marketplace-container"><h2 id="site-footer-heading" className="sr-only">LetBuyy Themes footer</h2>
        <div className="marketplace-footer-grid"><div><Link href="/" aria-label="LetBuyy Themes home"><BrandLogo width={158} height={48}/></Link><p className="marketplace-footer-tagline">A home for your next great look.<br/>Built for your business, on LetBuyy.</p></div>{columns.map(column=><nav key={column.title} aria-label={column.title}><h3>{column.title}</h3><ul>{column.links.map(([label,href])=><li key={label}><Link href={href}>{label}</Link></li>)}</ul></nav>)}</div>
        <div className="marketplace-footer-bottom"><span>© {new Date().getFullYear()} LetBuyy · India · English</span><nav aria-label="Legal links"><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/cookies">Cookies and storage</Link><Link href="/legal/license">Theme license</Link><Link href="/legal/refund">Refunds</Link><Button variant="ghost" size="sm" onClick={()=>{setResult(null);setPrivacyOpen(true);}}>Privacy choices</Button></nav></div>
        <a className="marketplace-footer-contact" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </div><Modal title="Your browser preferences" description="Manage the theme choices saved on this browser." open={privacyOpen} onClose={()=>setPrivacyOpen(false)} footer={<Button variant="secondary" onClick={()=>setPrivacyOpen(false)}>Done</Button>}>
        <div className="marketplace-filter-fields"><p>Clear your saved themes and comparison shortlist on this browser. Your account, purchases, licenses, store installations, and color theme are unchanged.</p><Button variant="secondary" onClick={clearChoices}>Clear saved themes and comparison</Button>
            {result==='cleared'&&<Banner variant="success">Saved themes and comparison cleared on this browser.</Banner>}{result==='error'&&<Banner variant="warning">Could not clear all saved choices. Check your browser’s storage settings and try again.</Banner>}
            <p>These controls do not change the privacy settings of an external payment or demo provider.</p><Link href="/legal/cookies" className="marketplace-text-link">Read cookies and browser storage information</Link><Link href="/legal/privacy" className="marketplace-text-link">Read the privacy review document</Link>
        </div>
    </Modal></footer>;
}
