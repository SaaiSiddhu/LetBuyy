import { db } from './supabase';
import { ProductModel } from '@/types/store';

// Mock Data for demo store
const MOCK_PRODUCTS: ProductModel[] = [
    {
        id: '1',
        storeId: 'mock-store',
        name: 'Urban Runner X',
        description: 'Lightweight street-ready runner with responsive cushioning.',
        price: 3499,
        currency: 'INR',
        images: [
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1543508282-6319a3e2621f?q=80&w=1000&auto=format&fit=crop',
        ],
        category: 'Sneakers',
        stock: 15,
        rating: 4.8,
        reviewCount: 128,
        isActive: true,
    },
    {
        id: '2',
        storeId: 'mock-store',
        name: 'Street King High',
        description: 'Classic high-top sneakers with premium leather.',
        price: 4999,
        currency: 'INR',
        images: [
            'https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1560769629-975e130098b6?q=80&w=1000&auto=format&fit=crop',
        ],
        category: 'High Tops',
        stock: 8,
        rating: 4.5,
        reviewCount: 86,
        isActive: true,
    },
    {
        id: '3',
        storeId: 'mock-store',
        name: 'Velocity Knit',
        description: 'Breathable knit upper with ultra-lightweight sole.',
        price: 2999,
        currency: 'INR',
        images: [
            'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1562183241-b937e95585b6?q=80&w=1000&auto=format&fit=crop',
        ],
        category: 'Running',
        stock: 25,
        rating: 4.2,
        reviewCount: 54,
        isActive: true,
    },
    {
        id: '4',
        storeId: 'mock-store',
        name: 'Retro Force',
        description: 'Vintage-inspired sneakers with modern comfort.',
        price: 3999,
        currency: 'INR',
        images: [
            'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1000&auto=format&fit=crop',
        ],
        category: 'Sneakers',
        stock: 12,
        rating: 4.7,
        reviewCount: 92,
        isActive: true,
    },
];

export const ProductService = {
    // Get products by store's selected product IDs
    async getProductsByIds(productIds: string[]): Promise<ProductModel[]> {
        if (!productIds || productIds.length === 0) return [];

        // Check for mock products
        const mockIds = MOCK_PRODUCTS.map(p => p.id);
        if (productIds.some(id => mockIds.includes(id))) {
            return MOCK_PRODUCTS.filter(p => productIds.includes(p.id));
        }

        try {
            const { data, error } = await db
                .from('products')
                .select('*')
                .in('id', productIds)
                .eq('is_active', true);

            if (error || !data) {
                console.error('[ProductService] Error fetching by IDs:', error?.message);
                return [];
            }

            return data.map((d: Record<string, unknown>) => mapSupabaseToProduct(d));
        } catch (error) {
            console.error('[ProductService] Error:', error);
            return [];
        }
    },

    // Get all products for a store
    async getProductsByStoreId(storeId: string): Promise<ProductModel[]> {
        if (storeId === 'mock-store') return MOCK_PRODUCTS;

        try {
            const { data, error } = await db
                .from('products')
                .select('*')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (error || !data) {
                console.error('[ProductService] Error fetching by store:', error?.message);
                return [];
            }

            return data.map((d: Record<string, unknown>) => mapSupabaseToProduct(d));
        } catch (error) {
            console.error('[ProductService] Error:', error);
            return [];
        }
    },

    // Get a single product by ID
    async getProductById(productId: string): Promise<ProductModel | null> {
        // Check mock
        const mock = MOCK_PRODUCTS.find(p => p.id === productId);
        if (mock) return mock;

        try {
            const { data, error } = await db
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error || !data) return null;
            return mapSupabaseToProduct(data);
        } catch (error) {
            console.error('[ProductService] Error fetching by ID:', error);
            return null;
        }
    },

    // Get all products for a seller (via their sites)
    async getProductsBySellerId(sellerId: string): Promise<ProductModel[]> {
        if (sellerId === 'mock-owner') return MOCK_PRODUCTS;

        try {
            // First get all store IDs for this seller
            const { data: stores } = await db
                .from('stores')
                .select('id')
                .eq('user_id', sellerId);

            if (!stores || stores.length === 0) return [];

            const storeIds = stores.map((s: { id: string }) => s.id);

            const { data, error } = await db
                .from('products')
                .select('*')
                .in('store_id', storeIds)
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (error || !data) return [];
            return data.map((d: Record<string, unknown>) => mapSupabaseToProduct(d));
        } catch (error) {
            console.error('[ProductService] Error:', error);
            return [];
        }
    }
};

// ============= HELPER FUNCTIONS =============

function mapSupabaseToProduct(data: Record<string, unknown>): ProductModel {
    return {
        id: data.id as string,
        storeId: data.store_id as string,
        name: (data.name as string) || 'Unnamed Product',
        description: (data.description as string) || '',
        price: Number(data.price) || 0,
        compareAtPrice: data.compare_price ? Number(data.compare_price) : undefined,
        currency: 'INR',
        images: (data.images as string[]) || [],
        category: data.category as string,
        tags: (data.tags as string[]) || [],
        variants: ((data.variants as Array<{ id: string; name: string; options: Record<string, string>; price?: number; stock?: number }>) || []),
        stock: (data.stock as number) || 0,
        isActive: (data.is_active as boolean) ?? true,
        isFeatured: (data.is_featured as boolean) ?? false,
        rating: undefined,
        reviewCount: undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}
