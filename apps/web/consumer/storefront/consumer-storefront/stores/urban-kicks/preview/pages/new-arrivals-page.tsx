'use client';

import PreviewShell from '../components/preview-shell';
import { MOCK_PRODUCTS, formatPrice } from '../lib/mock-data';
import { useCart } from '@/context/cart-context';
import { Sparkles, ShoppingBag, Heart, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NewArrivalsPage() {
    const newProducts = MOCK_PRODUCTS.filter(p => p.isNew);
    const { addToCart } = useCart();

    return (
        <PreviewShell>
            {/* Hero */}
            <div className="relative bg-black text-white overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <img src="https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=2000" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="relative max-w-screen-xl mx-auto px-4 py-16 md:py-24 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                        <Sparkles size={14} /> Just Dropped
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">New Arrivals</h1>
                    <p className="text-white/60 text-lg max-w-md mx-auto mb-8">Fresh drops this week. Get them before they&apos;re gone.</p>
                    <Link href="/theme-preview/urban-kicks/shop" className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
                        Shop All <ArrowRight size={16} />
                    </Link>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-screen-xl mx-auto px-4 py-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">This Week&apos;s Drops</h2>
                        <p className="text-gray-500 text-sm mt-1">{newProducts.length} new items</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {newProducts.map(product => (
                        <div key={product.id} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300">
                            <div className="relative bg-gray-50 aspect-square overflow-hidden">
                                <img src={product.images?.[0] || ''} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <span className="absolute top-2 left-2 flex items-center gap-1 bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg uppercase">
                                    <Sparkles size={11} /> New
                                </span>
                                {product.stock && product.stock <= 5 && (
                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg">{product.stock} left</span>
                                )}
                                <div className="absolute bottom-2 right-2 flex gap-1.5">
                                    <button className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"><Heart size={14} /></button>
                                    <button onClick={() => addToCart(product)} className="p-2 bg-black text-white rounded-full shadow-md hover:bg-black/80 transition-colors"><ShoppingBag size={14} /></button>
                                </div>
                            </div>
                            <div className="p-3 md:p-4">
                                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-1">{product.category}</p>
                                <h3 className="font-semibold text-sm md:text-base leading-tight mb-1.5">{product.name}</h3>
                                {product.rating && (
                                    <div className="flex items-center gap-1 mb-2">
                                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">{product.rating}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm md:text-base">{formatPrice(product.price)}</span>
                                    {product.compareAtPrice && <span className="text-xs text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {newProducts.length === 0 && (
                    <div className="text-center py-20">
                        <Sparkles size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-400 text-lg">No new arrivals right now</p>
                        <p className="text-gray-400 text-sm mt-1">Check back soon for fresh drops!</p>
                    </div>
                )}

                {/* CTA Banner */}
                <div className="mt-12 bg-black text-white rounded-2xl p-8 md:p-12 text-center">
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Don&apos;t Miss a Drop</h3>
                    <p className="text-white/60 mb-6 max-w-md mx-auto">Subscribe to get notified when new products drop. Be the first to cop.</p>
                    <div className="flex max-w-sm mx-auto gap-2">
                        <input type="email" placeholder="your@email.com" className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
                        <button className="px-6 py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors whitespace-nowrap">Notify Me</button>
                    </div>
                </div>
            </div>
        </PreviewShell>
    );
}
