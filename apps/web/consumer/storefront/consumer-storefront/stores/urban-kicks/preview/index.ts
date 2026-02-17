/**
 * Urban Kicks – Preview Module
 * 
 * This barrel export provides all preview-mode page components for the Urban Kicks theme.
 * Each page is a self-contained client component that uses the PreviewShell wrapper
 * and mock data for demonstration purposes.
 * 
 * Usage in Next.js route files:
 *   import { HomePage } from '@stores/urban-kicks/preview';
 *   export default function Page() { return <HomePage />; }
 */

export { default as HomePage } from './pages/home-page';
export { default as ShopPage } from './pages/shop-page';
export { default as CartPage } from './pages/cart-page';
export { default as ProductDetailPage } from './pages/product-detail-page';
export { default as TrackOrderPage } from './pages/track-order-page';
export { default as NewArrivalsPage } from './pages/new-arrivals-page';

// Re-export shared components and data for external use
export { default as PreviewShell } from './components/preview-shell';
export { MOCK_PRODUCTS, MOCK_ORDERS, CATEGORIES, formatPrice } from './lib/mock-data';
export type { MockOrder } from './lib/mock-data';
