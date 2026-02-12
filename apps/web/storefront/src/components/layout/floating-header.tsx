'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import { ShoppingBag, Menu, Search, User } from 'lucide-react';
import { useCart } from '@/context/cart-context';

export default function FloatingHeader() {
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { cartCount } = useCart();

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() || 0;
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
        setScrolled(latest > 50);
    });

    return (
        <motion.header
            variants={{
                visible: { y: 0 },
                hidden: { y: -100 },
            }}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled
                ? 'py-4 header-scrolled backdrop-blur-xl'
                : 'py-6 bg-transparent'
                }`}
        >
            <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
                {/* Mobile Menu */}
                <button className={`p-2 rounded-full hover:bg-surface-hover transition-colors md:hidden ${scrolled ? 'text-theme' : 'text-white'}`}>
                    <Menu size={24} />
                </button>

                {/* Logo */}
                <Link href="/" className="relative z-10">
                    <span className={`font-display text-2xl font-bold tracking-tight ${scrolled ? 'text-theme' : 'text-white'}`}>
                        STORE
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className={`hidden md:flex items-center gap-8 ${scrolled ? 'text-theme-secondary' : 'text-white/90'}`}>
                    {['Collection', 'About', 'Journal'].map((item) => (
                        <Link
                            key={item}
                            href={`/${item.toLowerCase()}`}
                            className="text-sm font-medium hover:text-primary transition-colors"
                        >
                            {item}
                        </Link>
                    ))}
                </nav>

                {/* Actions */}
                <div className={`flex items-center gap-2 ${scrolled ? 'text-theme' : 'text-white'}`}>
                    <button className="p-2 rounded-full hover:bg-surface-hover transition-colors hidden sm:block">
                        <Search size={22} strokeWidth={1.5} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-surface-hover transition-colors hidden sm:block">
                        <User size={22} strokeWidth={1.5} />
                    </button>
                    <Link href="/cart" className="p-2 rounded-full hover:bg-black/5 transition-colors relative">
                        <ShoppingBag size={22} strokeWidth={1.5} />
                        {cartCount > 0 && (
                            <span className="absolute top-1 right-0 bg-primary text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                                {cartCount}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </motion.header>
    );
}
