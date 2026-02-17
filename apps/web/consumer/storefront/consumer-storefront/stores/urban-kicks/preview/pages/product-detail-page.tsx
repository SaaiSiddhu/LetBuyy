'use client';

import PreviewShell from '../components/preview-shell';
import { MOCK_PRODUCTS, formatPrice } from '../lib/mock-data';
import { useCart } from '@/context/cart-context';
import { useState, useMemo } from 'react';
import {
    ChevronRight, Heart, Share2, Star, ShoppingBag, Minus, Plus,
    Truck, RotateCcw, Shield, Check, ChevronLeft, Sparkles
} from 'lucide-react';
import Link from 'next/link';

const SIZES = ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'];
const COLORS = [
    { name: 'Black', hex: '#111827' },
    { name: 'White', hex: '#F9FAFB' },
    { name: 'Red', hex: '#EF4444' },
    { name: 'Blue', hex: '#3B82F6' },
];

const REVIEWS = [
    { name: 'Arjun M.', rating: 5, date: '2 weeks ago', text: 'Absolute fire! Comfortable and looks even better in person. True to size.', verified: true },
    { name: 'Priya S.', rating: 4, date: '1 month ago', text: 'Great quality for the price. Shipping was fast. Would buy again!', verified: true },
    { name: 'Rahul K.', rating: 5, date: '1 month ago', text: 'These are my new daily drivers. Super comfy and the colorway is clean.', verified: false },
];

interface ProductDetailPageProps {
    productId: string;
}

export default function ProductDetailPage({ productId }: ProductDetailPageProps) {
    const product = MOCK_PRODUCTS.find(p => p.id === productId) || MOCK_PRODUCTS[0];
    const { addToCart, items } = useCart();
    const [selectedSize, setSelectedSize] = useState('UK 9');
    const [selectedColor, setSelectedColor] = useState('Black');
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState<'details' | 'sizing' | 'shipping' | 'reviews'>('details');
    const [added, setAdded] = useState(false);
    const [imgIdx, setImgIdx] = useState(0);

    const isInCart = items.some(i => i.id === product.id);
    const related = useMemo(() => MOCK_PRODUCTS.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4), [product]);

    const handleAddToCart = () => {
        for (let i = 0; i < quantity; i++) addToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    const images = product.images || [];

    return (
        <PreviewShell>
            <div className="max-w-screen-xl mx-auto px-4 py-6">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
                    <Link href="/theme-preview/urban-kicks" className="hover:text-black transition-colors">Home</Link>
                    <ChevronRight size={12} />
                    <Link href="/theme-preview/urban-kicks/shop" className="hover:text-black transition-colors">Shop</Link>
                    <ChevronRight size={12} />
                    <span className="text-black font-medium truncate max-w-[200px]">{product.name}</span>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                    {/* ═══ IMAGE GALLERY ═══ */}
                    <div>
                        <div className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-3">
                            <img src={images[imgIdx] || images[0] || ''} alt={product.name} className="w-full h-full object-cover" />
                            {/* Badges */}
                            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                                {product.isNew && (
                                    <span className="flex items-center gap-1 bg-black text-white text-xs font-bold px-3 py-1 rounded-lg"><Sparkles size={12} /> NEW</span>
                                )}
                                {product.isTrending && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-lg">TRENDING</span>
                                )}
                                {product.compareAtPrice && (
                                    <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-lg">
                                        {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}% OFF
                                    </span>
                                )}
                            </div>
                            {/* Nav arrows */}
                            {images.length > 1 && (
                                <>
                                    <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white"><ChevronLeft size={16} /></button>
                                    <button onClick={() => setImgIdx(i => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white"><ChevronRight size={16} /></button>
                                </>
                            )}
                        </div>
                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div className="flex gap-2">
                                {images.map((img, idx) => (
                                    <button key={idx} onClick={() => setImgIdx(idx)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${idx === imgIdx ? 'border-black' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ═══ PRODUCT INFO ═══ */}
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">{product.category}</p>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{product.name}</h1>

                        {/* Rating */}
                        {product.rating && (
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} className={i < Math.round(product.rating!) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />)}</div>
                                <span className="text-sm font-medium">{product.rating}</span>
                                <span className="text-xs text-gray-400">({product.reviewCount} reviews)</span>
                            </div>
                        )}

                        {/* Price */}
                        <div className="flex items-baseline gap-3 mb-6">
                            <span className="text-3xl font-bold">{formatPrice(product.price)}</span>
                            {product.compareAtPrice && (
                                <>
                                    <span className="text-lg text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>
                                    <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Save {formatPrice(product.compareAtPrice - product.price)}</span>
                                </>
                            )}
                        </div>

                        <p className="text-sm text-gray-600 leading-relaxed mb-6">{product.description}</p>

                        {/* Color */}
                        <div className="mb-5">
                            <p className="text-sm font-semibold mb-2">Color: <span className="font-normal text-gray-500">{selectedColor}</span></p>
                            <div className="flex gap-2">
                                {COLORS.map(c => (
                                    <button key={c.name} onClick={() => setSelectedColor(c.name)} className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === c.name ? 'border-black ring-2 ring-black/10' : 'border-gray-200'}`} style={{ backgroundColor: c.hex }} title={c.name} />
                                ))}
                            </div>
                        </div>

                        {/* Size */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-semibold">Size: <span className="font-normal text-gray-500">{selectedSize}</span></p>
                                <button className="text-xs text-gray-500 underline">Size Guide</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {SIZES.map(s => (
                                    <button key={s} onClick={() => setSelectedSize(s)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${selectedSize === s ? 'bg-black text-white border-black' : 'border-gray-200 hover:border-gray-400'}`}>{s}</button>
                                ))}
                            </div>
                        </div>

                        {/* Quantity + Add to Cart */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center border border-gray-200 rounded-xl h-12">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-full flex items-center justify-center hover:bg-gray-50 rounded-l-xl"><Minus size={14} /></button>
                                <span className="w-10 text-center text-sm font-semibold border-x border-gray-200">{quantity}</span>
                                <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-full flex items-center justify-center hover:bg-gray-50 rounded-r-xl"><Plus size={14} /></button>
                            </div>
                            <button onClick={handleAddToCart} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${added ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-black/90 active:scale-[0.98]'}`}>
                                {added ? <><Check size={16} /> Added!</> : <><ShoppingBag size={16} /> Add to Cart · {formatPrice(product.price * quantity)}</>}
                            </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 mb-6">
                            <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"><Heart size={16} /> Wishlist</button>
                            <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"><Share2 size={16} /> Share</button>
                        </div>

                        {/* Trust */}
                        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl">
                            {[{ icon: Truck, t: 'Free shipping over ₹2,000' }, { icon: RotateCcw, t: '7-day easy returns' }, { icon: Shield, t: '100% authentic' }].map(({ icon: I, t }) => (
                                <div key={t} className="text-center"><I size={16} className="mx-auto text-gray-400 mb-1" /><p className="text-[10px] text-gray-500 leading-tight">{t}</p></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ═══ TABS ═══ */}
                <div className="mt-12 border-t border-gray-100 pt-8">
                    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                        {(['details', 'sizing', 'shipping', 'reviews'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 text-sm font-medium capitalize whitespace-nowrap transition-all border-b-2 ${activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{tab}</button>
                        ))}
                    </div>
                    <div className="max-w-3xl">
                        {activeTab === 'details' && (
                            <div className="prose prose-sm max-w-none">
                                <p className="text-gray-600 leading-relaxed">{product.description}</p>
                                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Premium materials</li>
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Cushioned midsole</li>
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Durable rubber outsole</li>
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Breathable construction</li>
                                </ul>
                            </div>
                        )}
                        {activeTab === 'sizing' && (
                            <div className="text-sm text-gray-600 space-y-3">
                                <p>This product runs true to size. We recommend ordering your normal size.</p>
                                <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b"><th className="py-2 pr-4 font-medium">UK</th><th className="py-2 pr-4 font-medium">US</th><th className="py-2 pr-4 font-medium">EU</th><th className="py-2 font-medium">CM</th></tr></thead><tbody>{[['6', '7', '39', '24.5'], ['7', '8', '40', '25'], ['8', '9', '41', '25.5'], ['9', '10', '42', '26.5'], ['10', '11', '44', '28'], ['11', '12', '45', '29']].map(([uk, us, eu, cm]) => (<tr key={uk} className="border-b border-gray-100"><td className="py-2 pr-4">{uk}</td><td className="py-2 pr-4">{us}</td><td className="py-2 pr-4">{eu}</td><td className="py-2">{cm}</td></tr>))}</tbody></table></div>
                            </div>
                        )}
                        {activeTab === 'shipping' && (
                            <div className="text-sm text-gray-600 space-y-4">
                                <div className="flex items-start gap-3"><Truck size={18} className="text-gray-400 mt-0.5" /><div><p className="font-medium text-black">Standard Delivery (3-5 days)</p><p>Free on orders over ₹2,000. Otherwise ₹99.</p></div></div>
                                <div className="flex items-start gap-3"><RotateCcw size={18} className="text-gray-400 mt-0.5" /><div><p className="font-medium text-black">Easy Returns</p><p>7-day hassle-free returns. Items must be unworn with tags attached.</p></div></div>
                            </div>
                        )}
                        {activeTab === 'reviews' && (
                            <div className="space-y-4">
                                {REVIEWS.map((r, i) => (
                                    <div key={i} className="border border-gray-100 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{r.name[0]}</div>
                                                <div><p className="text-sm font-medium">{r.name} {r.verified && <span className="text-[10px] text-green-600 font-medium">✓ Verified</span>}</p><p className="text-xs text-gray-400">{r.date}</p></div>
                                            </div>
                                            <div className="flex">{Array.from({ length: 5 }).map((_, j) => <Star key={j} size={12} className={j < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />)}</div>
                                        </div>
                                        <p className="text-sm text-gray-600">{r.text}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ RELATED PRODUCTS ═══ */}
                {related.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-gray-100">
                        <h2 className="text-xl font-bold tracking-tight mb-6">You May Also Like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {related.map(p => (
                                <Link key={p.id} href={`/theme-preview/urban-kicks/product/${p.id}`} className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all">
                                    <div className="aspect-square bg-gray-50 overflow-hidden"><img src={p.images?.[0] || ''} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>
                                    <div className="p-3"><p className="text-[10px] text-gray-400 uppercase">{p.category}</p><h4 className="text-sm font-semibold truncate mt-0.5">{p.name}</h4><p className="font-bold text-sm mt-1">{formatPrice(p.price)}</p></div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Sticky Add to Cart */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex items-center justify-between z-50 md:hidden">
                <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">{product.name}</p><p className="font-bold text-base">{formatPrice(product.price)}</p></div>
                <button onClick={handleAddToCart} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${added ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-black/90'}`}>
                    {added ? <><Check size={14} /> Added</> : <><ShoppingBag size={14} /> Add to Cart</>}
                </button>
            </div>
        </PreviewShell>
    );
}
