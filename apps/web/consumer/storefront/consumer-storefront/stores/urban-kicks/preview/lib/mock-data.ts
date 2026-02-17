import { ProductModel } from '@/types/store';

// ============= MOCK PRODUCTS (12 items across 3 categories) =============

export const MOCK_PRODUCTS: ProductModel[] = [
    // ── Sneakers ──
    {
        id: 'uk-1',
        name: 'Air Max Retro \'97',
        description: 'Classic retro runner with premium materials and visible Air cushioning.',
        price: 12999,
        compareAtPrice: 15999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600'],
        category: 'Sneakers',
        stock: 24,
        rating: 4.8,
        reviewCount: 156,
        isNew: true,
    },
    {
        id: 'uk-2',
        name: 'Jordan 1 High OG',
        description: 'The iconic silhouette that started it all. Premium leather construction.',
        price: 18499,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=600'],
        category: 'Sneakers',
        stock: 8,
        rating: 4.9,
        reviewCount: 312,
        isTrending: true,
    },
    {
        id: 'uk-3',
        name: 'Yeezy Boost 350 V2',
        description: 'Primeknit upper with responsive Boost cushioning for all-day comfort.',
        price: 24999,
        compareAtPrice: 27999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?q=80&w=600'],
        category: 'Sneakers',
        stock: 3,
        rating: 4.7,
        reviewCount: 89,
        isFeatured: true,
    },
    {
        id: 'uk-4',
        name: 'New Balance 550',
        description: 'Basketball-inspired court shoe with retro vibes and modern comfort.',
        price: 9999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=600'],
        category: 'Sneakers',
        stock: 42,
        rating: 4.6,
        reviewCount: 74,
    },
    {
        id: 'uk-7',
        name: 'Dunk Low Retro',
        description: 'Heritage basketball style with padded collar and rubber cupsole.',
        price: 10999,
        compareAtPrice: 12999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1597045566677-8cf032ed6634?q=80&w=600'],
        category: 'Sneakers',
        stock: 18,
        rating: 4.7,
        reviewCount: 203,
        isNew: true,
    },
    // ── Apparel ──
    {
        id: 'uk-5',
        name: 'Oversized Graphic Tee',
        description: 'Premium heavyweight cotton with screen-printed graphic. Boxy oversized fit.',
        price: 2499,
        compareAtPrice: 3499,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=600'],
        category: 'Apparel',
        stock: 120,
        rating: 4.5,
        reviewCount: 230,
    },
    {
        id: 'uk-6',
        name: 'Cargo Joggers',
        description: 'Utility cargo pants with tapered fit and elasticated cuffs. Multi-pocket design.',
        price: 3999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=600'],
        category: 'Apparel',
        stock: 56,
        rating: 4.4,
        reviewCount: 98,
        isNew: true,
    },
    {
        id: 'uk-8',
        name: 'Heavyweight Hoodie',
        description: '400 GSM French terry hoodie with kangaroo pocket. Washed black finish.',
        price: 4499,
        compareAtPrice: 5999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=600'],
        category: 'Apparel',
        stock: 32,
        rating: 4.8,
        reviewCount: 167,
        isTrending: true,
    },
    {
        id: 'uk-9',
        name: 'Utility Shorts',
        description: 'Relaxed fit ripstop shorts with cargo pockets. Drawstring waist.',
        price: 2999,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1591195853828-11db59a44f6b?q=80&w=600'],
        category: 'Apparel',
        stock: 65,
        rating: 4.3,
        reviewCount: 55,
        isNew: true,
    },
    // ── Accessories ──
    {
        id: 'uk-10',
        name: 'Snapback Cap',
        description: 'Structured six-panel cap with flat brim and embroidered logo.',
        price: 1499,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1588850561407-ed78c334e67a?q=80&w=600'],
        category: 'Accessories',
        stock: 80,
        rating: 4.5,
        reviewCount: 142,
    },
    {
        id: 'uk-11',
        name: 'Crossbody Bag',
        description: 'Compact nylon crossbody with adjustable strap. Water-resistant.',
        price: 1999,
        compareAtPrice: 2499,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600'],
        category: 'Accessories',
        stock: 45,
        rating: 4.6,
        reviewCount: 88,
        isNew: true,
    },
    {
        id: 'uk-12',
        name: 'Crew Socks (3-Pack)',
        description: 'Mid-calf ribbed socks with cushioned sole. Breathable cotton blend.',
        price: 799,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?q=80&w=600'],
        category: 'Accessories',
        stock: 200,
        rating: 4.4,
        reviewCount: 310,
    },
];

// ============= MOCK ORDERS =============

export interface MockOrder {
    id: string;
    date: string;
    status: 'ordered' | 'confirmed' | 'shipped' | 'out_for_delivery' | 'delivered';
    items: { product: ProductModel; quantity: number; size: string }[];
    address: string;
    estimatedDelivery: string;
    trackingId: string;
    carrier: string;
}

export const MOCK_ORDERS: MockOrder[] = [
    {
        id: 'ORD-2026-4829',
        date: '2026-02-14',
        status: 'shipped',
        items: [
            { product: MOCK_PRODUCTS[0], quantity: 1, size: 'UK 9' },
            { product: MOCK_PRODUCTS[5], quantity: 2, size: 'L' },
        ],
        address: '42, Marine Drive, Mumbai, MH 400020',
        estimatedDelivery: '2026-02-19',
        trackingId: 'DTDC9283746510',
        carrier: 'DTDC Express',
    },
    {
        id: 'ORD-2026-4712',
        date: '2026-02-10',
        status: 'delivered',
        items: [
            { product: MOCK_PRODUCTS[1], quantity: 1, size: 'UK 10' },
        ],
        address: '42, Marine Drive, Mumbai, MH 400020',
        estimatedDelivery: '2026-02-15',
        trackingId: 'BLUEDART8271635',
        carrier: 'BlueDart',
    },
];

// ============= CATEGORIES =============

export const CATEGORIES = ['All', 'Sneakers', 'Apparel', 'Accessories'] as const;

// ============= HELPERS =============

export function formatPrice(price: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}
