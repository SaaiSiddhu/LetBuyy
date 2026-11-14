import MarketingHome from '@/components/MarketingHome'
import Pricing from '@/components/Pricing'
import { loadPublicPricing } from '@/lib/pricing'
import '../home.css'

export default async function Home() {
  const initialData = await loadPublicPricing()
  return <MarketingHome pricing={<Pricing initialData={initialData} />} />
}
