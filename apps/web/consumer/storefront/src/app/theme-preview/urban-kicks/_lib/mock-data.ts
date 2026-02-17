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

// ============= SHIPPING METHODS =============

export interface ShippingMethod {
    id: 'standard' | 'express' | 'free';
    label: string;
    price: number;
    eta: string;
    minOrder?: number;
    badge?: string;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
    { id: 'standard', label: 'Standard Delivery', price: 40, eta: '5-7 business days' },
    { id: 'express', label: 'Express Delivery', price: 99, eta: '2-3 business days', badge: '★ Popular' },
    { id: 'free', label: 'Free Delivery', price: 0, eta: '7-10 business days', minOrder: 2000, badge: '🎉 FREE' },
];

// ============= PAYMENT METHODS =============

export interface PaymentMethod {
    id: 'razorpay' | 'cod';
    label: string;
    description: string;
    extraFee?: number;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
    { id: 'razorpay', label: 'Razorpay', description: 'UPI, Cards, Wallets, NetBanking' },
    { id: 'cod', label: 'Cash on Delivery', description: 'Pay when you receive', extraFee: 49 },
];

// ============= INDIAN STATES =============

export const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
    'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
    'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli',
    'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

// ============= BRAND GALLERY / STORYTELLING =============

export interface BrandGalleryFeature {
    icon: string; // lucide icon name
    title: string;
    description: string;
}

export interface BrandGallerySplitPanel {
    image: string;
    title: string;
    description: string;
}

export interface BrandGalleryData {
    heroBanner: { image: string; title: string; subtitle: string };
    features: BrandGalleryFeature[];
    splitPanels: BrandGallerySplitPanel[];
    video?: { thumbnail: string; url: string; title: string };
    showcaseImages: string[];
}

export const BRAND_GALLERY: Record<string, BrandGalleryData> = {
    Sneakers: {
        heroBanner: {
            image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=1200',
            title: 'ENGINEERED FOR MOVEMENT',
            subtitle: 'Premium materials. Bold design. Built for the streets and beyond.',
        },
        features: [
            { icon: 'Zap', title: 'Lightweight', description: 'Ultra-light cushioning for all-day comfort' },
            { icon: 'Shield', title: 'Durable', description: 'Built to last with reinforced stitching' },
            { icon: 'Leaf', title: 'Sustainable', description: 'Made with recycled materials' },
            { icon: 'Gem', title: 'Handcrafted', description: 'Attention to detail in every pair' },
        ],
        splitPanels: [
            {
                image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?q=80&w=800',
                title: 'Premium Leather Upper',
                description: 'Full-grain leather that develops a natural patina over time. Each pair tells its own story as the leather ages gracefully with every wear.',
            },
            {
                image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=800',
                title: 'Visible Air Cushioning',
                description: 'Responsive Air Max unit returns energy with every step. The visible cushioning system provides superior impact absorption for all-day comfort.',
            },
        ],
        video: {
            thumbnail: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1200',
            url: 'https://www.w3schools.com/html/mov_bbb.mp4',
            title: 'The Making of Air Max',
        },
        showcaseImages: [
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800',
            'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?q=80&w=600',
            'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?q=80&w=600',
            'https://images.unsplash.com/photo-1543508282-6319a3e2621f?q=80&w=600',
            'https://images.unsplash.com/photo-1605348532760-6753d2c43329?q=80&w=800',
        ],
    },
    Apparel: {
        heroBanner: {
            image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=1200',
            title: 'WEAR YOUR IDENTITY',
            subtitle: 'Streetwear essentials crafted from premium fabrics. Made for comfort, designed for culture.',
        },
        features: [
            { icon: 'Zap', title: '400 GSM', description: 'Heavyweight premium cotton fabric' },
            { icon: 'Shield', title: 'Pre-Shrunk', description: 'Washed and treated to hold its shape' },
            { icon: 'Leaf', title: 'Organic Cotton', description: '100% GOTS certified organic cotton' },
            { icon: 'Gem', title: 'Screen Printed', description: 'Hand-finished graphic prints' },
        ],
        splitPanels: [
            {
                image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=800',
                title: 'Oversized Boxy Fit',
                description: 'Relaxed silhouette with dropped shoulders for that effortless street style look. Designed to drape perfectly whether dressed up or down.',
            },
            {
                image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800',
                title: 'Washed Vintage Finish',
                description: 'Each piece is garment-dyed and enzyme-washed for a lived-in feel. The color softens beautifully wash after wash.',
            },
        ],
        video: {
            thumbnail: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1200',
            url: 'https://www.w3schools.com/html/mov_bbb.mp4',
            title: 'Behind the Collection',
        },
        showcaseImages: [
            'https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=800',
            'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=600',
            'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600',
            'https://images.unsplash.com/photo-1503341504253-dff4815485f1?q=80&w=600',
            'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800',
        ],
    },
    Accessories: {
        heroBanner: {
            image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1200',
            title: 'COMPLETE THE LOOK',
            subtitle: 'Essential accessories that elevate every outfit. Functional meets fashionable.',
        },
        features: [
            { icon: 'Zap', title: 'Lightweight', description: 'Carry essentials without the bulk' },
            { icon: 'Shield', title: 'Water-Resistant', description: 'Coated nylon repels rain and spills' },
            { icon: 'Leaf', title: 'Recycled Nylon', description: 'Made from post-consumer waste' },
            { icon: 'Gem', title: 'YKK Zippers', description: 'Premium hardware that lasts' },
        ],
        splitPanels: [
            {
                image: 'https://images.unsplash.com/photo-1588850561407-ed78c334e67a?q=80&w=800',
                title: 'Structured Design',
                description: 'Six-panel construction with premium embroidery. Adjustable snap-back closure fits all head sizes comfortably.',
            },
            {
                image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800',
                title: 'Compact & Organized',
                description: 'Multiple compartments keep your essentials organized and accessible. Adjustable strap goes from crossbody to shoulder carry in seconds.',
            },
        ],
        showcaseImages: [
            'https://images.unsplash.com/photo-1588850561407-ed78c334e67a?q=80&w=800',
            'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600',
            'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?q=80&w=600',
            'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?q=80&w=800',
        ],
    },
};

// ============= HELPERS =============

export function formatPrice(price: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}
