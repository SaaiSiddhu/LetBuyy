// ============================================================
// ACCOUNT BOTTOM SHEET — 5-state auth & account sheet
// States: email_entry → password_login | set_password | not_found | logged_in
// Theme-agnostic: uses CSS variables from the store theme
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input,
    X, User, Mail, Lock, Eye, EyeOff,
    Package, Heart, MapPin, Settings, LogOut,
    ArrowLeft, Loader2, ShoppingBag,
} from '@letbuyy/ui';
import { useCustomerAuth } from '@/context/customer-auth-context';
import TurnstileWidget, { type TurnstileHandle } from '@/components/security/turnstile-widget';
import Link from 'next/link';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
    subdomain: string;
}

type SheetState = 'email_entry' | 'password_login' | 'set_password' | 'not_found' | 'logged_in';

export default function AccountBottomSheet({ isOpen, onClose, storeId, subdomain }: Props) {
    const { customer, isAuthenticated, login, setPassword, checkEmail, logout } = useCustomerAuth();
    const basePath = `/store/${subdomain}`;

    const [state, setState] = useState<SheetState>('email_entry');
    const [email, setEmail] = useState('');
    const [password, setPasswordValue] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const turnstileRef = useRef<TurnstileHandle>(null);

    // Set initial state based on auth
    useEffect(() => {
        if (isOpen) {
            if (isAuthenticated) {
                setState('logged_in');
            } else {
                setState('email_entry');
                setEmail('');
                setPasswordValue('');
                setConfirmPassword('');
                setTurnstileToken(null);
                setError('');
            }
        }
    }, [isOpen, isAuthenticated]);

    // Focus first input on state change
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            if (state === 'email_entry') emailRef.current?.focus();
            if (state === 'password_login' || state === 'set_password') passwordRef.current?.focus();
        }, 200);
        return () => clearTimeout(timer);
    }, [state, isOpen]);

    // ── EMAIL CHECK ─────────────────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);
        setError('');

        try {
            const result = await checkEmail(email, storeId);

            if (!result.exists) {
                setState('not_found');
            } else if (result.hasPassword) {
                setState('password_login');
            } else {
                setState('set_password');
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── PASSWORD LOGIN ──────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        setLoading(true);
        setError('');

        const result = await login(email, password, storeId, turnstileToken);

        if (result.success) {
            setState('logged_in');
        } else {
            setError(result.error || 'Invalid password');
            setTurnstileToken(null);
            turnstileRef.current?.reset();
        }
        setLoading(false);
    };

    // ── SET PASSWORD ────────────────────────────────────────
    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        setError('');

        const result = await setPassword(email, password, storeId);

        if (result.success) {
            setState('logged_in');
        } else {
            setError(result.error || 'Failed to set password');
        }
        setLoading(false);
    };

    // ── LOGOUT ──────────────────────────────────────────────
    const handleLogout = async () => {
        await logout();
        setState('email_entry');
        setPasswordValue('');
    };

    // ── GO BACK ──────────────────────────────────────────────
    const goBack = () => {
        setState('email_entry');
        setPasswordValue('');
        setConfirmPassword('');
        setTurnstileToken(null);
        setError('');
    };

    const initials = customer?.fullName
        ? customer.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : customer?.email?.[0]?.toUpperCase() || '?';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-black/50"
                        onClick={onClose}
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[90] bg-[var(--lb-color-surface)] rounded-t-2xl max-h-[85vh] overflow-y-auto md:right-auto md:top-0 md:bottom-0 md:left-auto md:rounded-none md:rounded-l-2xl md:w-[400px] shadow-2xl"
                        style={{
                            backgroundColor: 'var(--background, rgb(255 255 255))',
                            color: 'var(--text, rgb(26 26 46))',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                            <div className="flex items-center gap-2">
                                {(state === 'password_login' || state === 'set_password' || state === 'not_found') && (
                                    <Button unstyled
                                        onClick={goBack}
                                        className="p-1 rounded-lg hover:bg-[var(--lb-color-surface-subdued)] transition-colors"
                                        style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}
                                    >
                                        <ArrowLeft size={20} />
                                    </Button>
                                )}
                                <h2 className="text-lg font-semibold">
                                    {state === 'logged_in' ? 'My Account' : 'Sign In'}
                                </h2>
                            </div>
                            <Button unstyled
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-[var(--lb-color-surface-subdued)] transition-colors"
                                style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}
                            >
                                <X size={20} />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            <AnimatePresence mode="wait">
                                {/* ─── STATE: Email Entry ──────────────── */}
                                {state === 'email_entry' && (
                                    <motion.form
                                        key="email_entry"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleEmailSubmit}
                                        className="space-y-4"
                                    >
                                        <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                            Enter your email to sign in or create an account.
                                        </p>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary, rgb(156 163 175))' }} />
                                            <Input unstyled
                                                ref={emailRef}
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Email address"
                                                required
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                                                style={{
                                                    borderColor: 'var(--border, rgb(209 213 219))',
                                                    backgroundColor: 'var(--surface, rgb(249 250 251))',
                                                    color: 'var(--text, rgb(26 26 46))',
                                                }}
                                            />
                                        </div>
                                        {error && <p className="text-red-500 text-sm">{error}</p>}
                                        <Button unstyled
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--primary, rgb(0 179 179))' }}
                                        >
                                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Continue'}
                                        </Button>
                                    </motion.form>
                                )}

                                {/* ─── STATE: Password Login ─────────────── */}
                                {state === 'password_login' && (
                                    <motion.form
                                        key="password_login"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleLogin}
                                        className="space-y-4"
                                    >
                                        <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                            Welcome back! Enter your password for <strong>{email}</strong>.
                                        </p>
                                        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary, rgb(156 163 175))' }} />
                                            <Input unstyled
                                                ref={passwordRef}
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPasswordValue(e.target.value)}
                                                placeholder="Password"
                                                required
                                                className="w-full pl-10 pr-12 py-3 rounded-xl border text-sm outline-none transition-colors"
                                                style={{
                                                    borderColor: 'var(--border, rgb(209 213 219))',
                                                    backgroundColor: 'var(--surface, rgb(249 250 251))',
                                                    color: 'var(--text, rgb(26 26 46))',
                                                }}
                                            />
                                            <Button unstyled
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                                style={{ color: 'var(--text-secondary, rgb(156 163 175))' }}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </Button>
                                        </div>
                                        {error && <p className="text-red-500 text-sm">{error}</p>}
                                        <Button unstyled
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--primary, rgb(0 179 179))' }}
                                        >
                                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
                                        </Button>
                                    </motion.form>
                                )}

                                {/* ─── STATE: Set Password (First Time) ──── */}
                                {state === 'set_password' && (
                                    <motion.form
                                        key="set_password"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleSetPassword}
                                        className="space-y-4"
                                    >
                                        <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                            We found your account for <strong>{email}</strong>. Set a password to secure it.
                                        </p>
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary, rgb(156 163 175))' }} />
                                            <Input unstyled
                                                ref={passwordRef}
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPasswordValue(e.target.value)}
                                                placeholder="Create password"
                                                required
                                                minLength={6}
                                                className="w-full pl-10 pr-12 py-3 rounded-xl border text-sm outline-none transition-colors"
                                                style={{
                                                    borderColor: 'var(--border, rgb(209 213 219))',
                                                    backgroundColor: 'var(--surface, rgb(249 250 251))',
                                                    color: 'var(--text, rgb(26 26 46))',
                                                }}
                                            />
                                            <Button unstyled
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                                style={{ color: 'var(--text-secondary, rgb(156 163 175))' }}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </Button>
                                        </div>
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary, rgb(156 163 175))' }} />
                                            <Input unstyled
                                                type={showPassword ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm password"
                                                required
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                                                style={{
                                                    borderColor: 'var(--border, rgb(209 213 219))',
                                                    backgroundColor: 'var(--surface, rgb(249 250 251))',
                                                    color: 'var(--text, rgb(26 26 46))',
                                                }}
                                            />
                                        </div>
                                        {error && <p className="text-red-500 text-sm">{error}</p>}
                                        <Button unstyled
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--primary, rgb(0 179 179))' }}
                                        >
                                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create Account'}
                                        </Button>
                                    </motion.form>
                                )}

                                {/* ─── STATE: Not Found ────────────────────── */}
                                {state === 'not_found' && (
                                    <motion.div
                                        key="not_found"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4 text-center py-4"
                                    >
                                        <div
                                            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
                                            style={{ backgroundColor: 'var(--surface, rgb(243 244 246))' }}
                                        >
                                            <User size={28} style={{ color: 'var(--text-secondary, rgb(156 163 175))' }} />
                                        </div>
                                        <div>
                                            <p className="font-semibold">No account found</p>
                                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                                No account exists for <strong>{email}</strong>. Place an order and your account will be created automatically!
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 pt-2">
                                            <Link
                                                href={`${basePath}/shop`}
                                                onClick={onClose}
                                                className="w-full py-3 rounded-xl text-white text-sm font-semibold text-center transition-opacity"
                                                style={{ backgroundColor: 'var(--primary, rgb(0 179 179))' }}
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    <ShoppingBag size={18} />
                                                    Start Shopping
                                                </span>
                                            </Link>
                                            <Button unstyled
                                                onClick={goBack}
                                                className="text-sm py-2 transition-colors"
                                                style={{ color: 'var(--primary, rgb(0 179 179))' }}
                                            >
                                                Try a different email
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ─── STATE: Logged In ─────────────────────── */}
                                {state === 'logged_in' && customer && (
                                    <motion.div
                                        key="logged_in"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-5"
                                    >
                                        {/* Avatar & Greeting */}
                                        <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                                style={{ backgroundColor: 'var(--primary, rgb(0 179 179))' }}
                                            >
                                                {initials}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{customer.fullName || 'Customer'}</p>
                                                <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                                    {customer.email}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Navigation Links */}
                                        <nav className="space-y-1">
                                            {[
                                                { href: `${basePath}/account/orders`, icon: Package, label: 'My Orders' },
                                                { href: `${basePath}/account/wishlist`, icon: Heart, label: 'Wishlist' },
                                                { href: `${basePath}/account/addresses`, icon: MapPin, label: 'Addresses' },
                                                { href: `${basePath}/account/settings`, icon: Settings, label: 'Settings' },
                                            ].map(({ href, icon: Icon, label }) => (
                                                <Link
                                                    key={href}
                                                    href={href}
                                                    onClick={onClose}
                                                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
                                                    style={{
                                                        color: 'var(--text, rgb(26 26 46))',
                                                    }}
                                                >
                                                    <Icon size={20} style={{ color: 'var(--text-secondary, rgb(107 114 128))' }} />
                                                    {label}
                                                </Link>
                                            ))}
                                        </nav>

                                        {/* Sign Out */}
                                        <Button unstyled
                                            onClick={handleLogout}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                                            style={{
                                                borderColor: 'var(--border, rgb(229 231 235))',
                                                color: 'var(--text-secondary, rgb(107 114 128))',
                                            }}
                                        >
                                            <LogOut size={18} />
                                            Sign Out
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
