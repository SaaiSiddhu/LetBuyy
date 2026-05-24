import { redirect } from 'next/navigation';
import { URBAN_KICKS_DEMO_SUBDOMAIN } from '@/lib/demo/urban-kicks-demo';

export default function UrbanKicksDemoShortcut() {
    redirect(`/store/${URBAN_KICKS_DEMO_SUBDOMAIN}`);
}
