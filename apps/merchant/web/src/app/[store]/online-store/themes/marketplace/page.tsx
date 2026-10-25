import { Suspense } from 'react'
import { Skeleton } from '@letbuyy/ui'
import { ThemeMarketplace } from '@/components/theme-library/ThemeMarketplace'
export default function ThemeMarketplacePage() { return <Suspense fallback={<Skeleton variant="card"/>}><ThemeMarketplace/></Suspense> }
