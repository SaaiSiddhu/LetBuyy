// ============================================================
// SETTINGS PAGE — Account settings with profile editing + password change
// ============================================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCustomerAuth } from '@/context/customer-auth-context';
import { useWishlist } from '@/context/wishlist-context';
import { buyerPrivacyUrl } from '@/lib/buyer-auth/flow';
import { Button, Input,
    User as UserIcon, Lock, Loader2, Check, Save, AlertCircle, Mail, Phone,
} from '@letbuyy/ui';

function StoreCustomerLinkForm({ returnTo, label, borderColor }: { returnTo: string; label: string; borderColor: string }) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const startLink = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const response = await fetch('/api/buyer-auth/start', {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: new FormData(event.currentTarget),
                credentials: 'same-origin',
                cache: 'no-store',
            });
            const payload = await response.json() as { redirectTo?: unknown };
            if (!response.ok || typeof payload.redirectTo !== 'string') {
                throw new Error('We could not start account connection. Please try again.');
            }
            const destination = new URL(payload.redirectTo);
            if (destination.pathname !== '/buyer/authorize' || destination.username || destination.password) {
                throw new Error('We could not verify the account connection destination.');
            }
            window.location.assign(destination.toString());
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Network error. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <>
            {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
            <form method="post" action="/api/buyer-auth/start" onSubmit={startLink}>
                <Input unstyled type="hidden" name="intent" value="link_store_customer" />
                <Input unstyled type="hidden" name="return_to" value={returnTo} />
                <Button unstyled type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl border text-sm font-semibold disabled:opacity-50" style={{ borderColor }}>
                    {submitting ? 'Connecting…' : label}
                </Button>
            </form>
        </>
    );
}

function StoreCustomerSettings() {
    const { customer, refreshSession } = useCustomerAuth();
    const pathname = usePathname();

    // Profile edit state
    const [fullName, setFullName] = useState(customer?.fullName || '');
    const [phone, setPhone] = useState('');
    const [acceptsMarketing, setAcceptsMarketing] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileLoadError, setProfileLoadError] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState('');

    // Password state
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const loadProfile = useCallback(async (signal?: AbortSignal) => {
        setProfileLoading(true);
        setProfileLoadError('');
        try {
            const response = await fetch('/api/customer/profile', { cache: 'no-store', signal });
            const body = await response.json() as {
                customer?: { email?: string; full_name?: string | null; phone?: string | null; accepts_marketing?: boolean };
                error?: string;
            };
            if (!response.ok || !body.customer) throw new Error(body.error || 'We could not load your store profile.');
            setFullName(body.customer.full_name || '');
            setPhone(body.customer.phone || '');
            setAcceptsMarketing(body.customer.accepts_marketing === true);
        } catch (reason) {
            if (reason instanceof DOMException && reason.name === 'AbortError') return;
            setProfileLoadError(reason instanceof Error ? reason.message : 'We could not load your store profile.');
        } finally {
            if (!signal?.aborted) setProfileLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void loadProfile(controller.signal);
        return () => controller.abort();
    }, [loadProfile]);

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileSaved(false);

        if (!fullName.trim()) {
            setProfileError('Full name is required.');
            return;
        }

        setProfileSaving(true);
        try {
            const res = await fetch('/api/customer/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim(), acceptsMarketing }),
            });
            if (res.ok) {
                await refreshSession();
                setProfileSaved(true);
                setTimeout(() => setProfileSaved(false), 3000);
            } else {
                const data = await res.json();
                setProfileError(data.error || 'Failed to update profile.');
            }
        } catch {
            setProfileError('Network error. Please try again.');
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordResetRequest = async () => {
        setPasswordError('');
        setPasswordSuccess(false);
        if (!customer?.email || !customer.storeId) {
            setPasswordError('Your store account could not be verified. Refresh and try again.');
            return;
        }
        setPasswordSaving(true);
        try {
            const res = await fetch('/api/customer/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_reset',
                    email: customer.email,
                    storeId: customer.storeId,
                    resetUrl: new URL('/customers/reset-password', window.location.origin).toString(),
                }),
            });

            if (res.ok) {
                setPasswordSuccess(true);
            } else {
                setPasswordError('We could not start a password reset. Please try again.');
            }
        } catch {
            setPasswordError('Network error. Please try again.');
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

            <div className="space-y-6">
                <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--lb-color-border)' }}>
                    <div>
                        <h2 className="font-semibold">Connect this store account to LetBuyy</h2>
                        <p className="mt-1 text-sm" style={{ color: 'var(--lb-color-text-secondary)' }}>
                            Sign in with a verified LetBuyy account using the same email as this store account. Connecting does not claim past orders; historical orders need a separate verified claim.
                        </p>
                    </div>
                    <StoreCustomerLinkForm returnTo={pathname || '/'} label="Sign in and connect with LetBuyy" borderColor="var(--lb-color-border)" />
                </section>

                {/* Profile Info */}
                <form onSubmit={handleProfileSave} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="font-semibold flex items-center gap-2">
                                <UserIcon size={18} />
                                Profile
                            </h2>
                            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                Keep contact details current for order updates and support.
                            </p>
                        </div>
                        {profileSaved && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50">
                                <Check size={14} /> Saved
                            </span>
                        )}
                    </div>
                    <div className="space-y-3">
                        {profileLoading && <p role="status" className="text-sm">Loading your store profile…</p>}
                        {profileLoadError && (
                            <div role="alert" className="text-sm text-red-600">
                                <p>{profileLoadError}</p>
                                <Button unstyled type="button" onClick={() => void loadProfile()} className="underline">Try again</Button>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                Email Address
                            </label>
                            <p className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--surface, rgb(243 244 246))' }}>
                                <Mail size={16} style={{ color: 'var(--text-secondary, rgb(107 114 128))' }} />
                                {customer?.email}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                Full Name
                            </label>
                            <Input unstyled
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                disabled={profileLoading || Boolean(profileLoadError)}
                                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                Phone Number
                            </label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }} />
                                <Input unstyled
                                    value={phone}
                                    onChange={e => setPhone(e.target.value.replace(/[^\d+\-\s]/g, ''))}
                                    disabled={profileLoading || Boolean(profileLoadError)}
                                    placeholder="+91 98765 43210"
                                    inputMode="tel"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                                />
                            </div>
                        </div>
                        <label className="flex items-start gap-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                            <Input unstyled
                                type="checkbox"
                                checked={acceptsMarketing}
                                onChange={e => setAcceptsMarketing(e.target.checked)}
                                disabled={profileLoading || Boolean(profileLoadError)}
                                className="mt-1 h-4 w-4 rounded border-[var(--lb-color-border)]"
                            />
                            <span>
                                <span className="block font-medium">Send me store updates</span>
                                <span style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                    Receive restock, order, and offer updates from this store.
                                </span>
                            </span>
                        </label>
                        {profileError && (
                            <p className="flex items-center gap-1 text-sm text-red-500">
                                <AlertCircle size={14} /> {profileError}
                            </p>
                        )}
                        <Button unstyled
                            type="submit"
                            disabled={profileSaving || profileLoading || Boolean(profileLoadError)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: profileSaved ? 'rgb(16 185 129)' : 'var(--primary)' }}
                        >
                            {profileSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : profileSaved ? (
                                <Check size={16} />
                            ) : (
                                <Save size={16} />
                            )}
                            {profileSaved ? 'Saved!' : 'Save Changes'}
                        </Button>
                    </div>
                </form>

                {/* Security */}
                <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <Lock size={18} />
                        Reset Password
                    </h2>
                    <div className="space-y-3">
                        <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                            We’ll email a secure reset link to {customer?.email || 'your account email'} if password reset is available for this account.
                        </p>
                        {passwordError && <p className="text-sm text-red-500" role="alert">{passwordError}</p>}
                        {passwordSuccess && (
                            <p className="text-sm text-green-600 flex items-center gap-1" role="status">
                                <Check size={14} /> If password reset is available, check your email for a link.
                            </p>
                        )}

                        <Button unstyled
                            type="button"
                            onClick={handlePasswordResetRequest}
                            disabled={passwordSaving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: 'var(--primary)' }}
                        >
                            {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                            Email reset link
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    );
}

type BuyerProfile = { id: string; email: string; email_verified: boolean; full_name: string | null; phone: string | null };

function BuyerSettings() {
    const pathname = usePathname();
    const { buyerSessionReady, buyerSessionRevision } = useWishlist();
    const buyerSessionRevisionRef = useRef(buyerSessionRevision);
    buyerSessionRevisionRef.current = buyerSessionRevision;
    const { isAuthenticated: hasStoreCustomerSession, logout: signOutStoreCustomer } = useCustomerAuth();
    const [profile, setProfile] = useState<BuyerProfile | null>(null);
    const profileId = useRef<string | null>(null);
    const [loadedSessionRevision, setLoadedSessionRevision] = useState<number | null>(null);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [linkStatus, setLinkStatus] = useState('');

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError('');
        setLoadedSessionRevision(null);
        try {
            const response = await fetch('/api/buyer/profile', { cache: 'no-store', signal });
            const body = await response.json() as { buyer?: BuyerProfile; error?: string };
            if (!response.ok || !body.buyer) throw new Error(body.error || 'We could not load your profile.');
            if (profileId.current !== body.buyer.id) {
                setFullName(body.buyer.full_name || '');
                setPhone(body.buyer.phone || '');
            }
            profileId.current = body.buyer.id;
            setProfile(body.buyer);
        } catch (reason) {
            if (reason instanceof DOMException && reason.name === 'AbortError') return;
            setError(reason instanceof Error ? reason.message : 'We could not load your profile.');
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setLoadedSessionRevision(buyerSessionRevision);
            }
        }
    }, [buyerSessionRevision]);

    useEffect(() => {
        if (!buyerSessionReady) return;
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [buyerSessionReady, buyerSessionRevision, load]);
    useEffect(() => { setLinkStatus(new URLSearchParams(window.location.search).get('buyer_link') || ''); }, []);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        const submittedRevision = buyerSessionRevisionRef.current;
        const expectedBuyerId = profileId.current;
        if (!expectedBuyerId) {
            setError('Reload your account before saving profile changes.');
            return;
        }
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const response = await fetch('/api/buyer/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim(), expectedBuyerId }),
            });
            const body = await response.json() as { buyer?: BuyerProfile; error?: string };
            if (!response.ok || !body.buyer) throw new Error(body.error || 'We could not update your profile.');
            if (buyerSessionRevisionRef.current !== submittedRevision) return;
            setProfile(body.buyer);
            setFullName(body.buyer.full_name || '');
            setPhone(body.buyer.phone || '');
            setMessage('Your LetBuyy profile is saved.');
        } catch (reason) {
            if (buyerSessionRevisionRef.current !== submittedRevision) return;
            setError(reason instanceof Error ? reason.message : 'We could not update your profile.');
        } finally {
            setSaving(false);
        }
    };

    const signOut = async () => {
        try {
            const response = await fetch('/api/buyer-auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('sign_out_failed');
            window.location.assign(window.location.pathname);
        } catch {
            setError('We could not sign you out. Please try again.');
        }
    };

    const signOutStoreCustomerSession = async () => {
        setError('');
        setMessage('');
        try {
            await signOutStoreCustomer();
            setMessage('Store customer account signed out at this store. Your LetBuyy session remains active here.');
        } catch {
            setError('We could not sign you out of the store customer account. Please try again.');
        }
    };

    if (loading || !buyerSessionReady || loadedSessionRevision !== buyerSessionRevision) {
        return <p role="status">Loading your LetBuyy profile…</p>;
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">LetBuyy Account</h1>
            <form onSubmit={save} className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                <div>
                    <h2 className="font-semibold flex items-center gap-2"><UserIcon size={18} /> Buyer profile</h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>These contact details belong to your LetBuyy account and are shared across supported stores.</p>
                </div>
                <div>
                    <label className="text-xs font-medium block mb-1">Email address</label>
                    <p className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--surface, rgb(243 244 246))' }}>
                        <Mail size={16} /> {profile?.email}
                        {profile?.email_verified ? <span className="text-xs text-green-700">Verified</span> : <span className="text-xs">Not verified</span>}
                    </p>
                </div>
                <div>
                    <label className="text-xs font-medium block mb-1" htmlFor="buyer-full-name">Full name</label>
                    <Input unstyled id="buyer-full-name" value={fullName} onChange={event => setFullName(event.target.value)} maxLength={200} className="w-full px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'var(--border, rgb(229 231 235))' }} />
                </div>
                <div>
                    <label className="text-xs font-medium block mb-1" htmlFor="buyer-phone">Phone number</label>
                    <div className="relative"><Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" /><Input unstyled id="buyer-phone" value={phone} onChange={event => setPhone(event.target.value.slice(0, 32))} inputMode="tel" maxLength={32} className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'var(--border, rgb(229 231 235))' }} /></div>
                </div>
                {error && <div role="alert" className="text-sm text-red-600"><p>{error}</p><Button unstyled type="button" onClick={() => void load()} className="underline">Try again</Button></div>}
                {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                <div className="flex flex-wrap gap-3">
                    <Button unstyled type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save profile
                    </Button>
                    <Button unstyled type="button" onClick={() => void signOut()} className="px-5 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>Sign out of LetBuyy at this store</Button>
                    {hasStoreCustomerSession && <Button unstyled type="button" onClick={() => void signOutStoreCustomerSession()} className="px-5 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: 'var(--lb-color-border)' }}>Sign out of store customer account</Button>}
                </div>
            </form>
            <section className="mt-5 rounded-2xl border border-[var(--lb-color-border)] p-5 space-y-2">
                <h2 className="font-semibold">Your data access</h2>
                <p className="text-sm">Open your canonical LetBuyy account to request a restricted data export. Password verification and a single-use download take place at Identity.</p>
                {profile && <PrivacyEntry buyerId={profile.id} />}
            </section>
            <section className="mt-5 rounded-2xl border p-5 space-y-2" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                <h2 className="font-semibold">Connect this store account</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                    Reconfirm your LetBuyy sign-in to connect a store customer record with the same verified email. This action does not claim past orders; historical orders require a separate verified claim flow.
                </p>
                {linkStatus && <p role="status" className="text-sm" style={{ color: linkStatus === 'linked' ? 'var(--primary)' : 'var(--text-secondary, rgb(107 114 128))' }}>
                    {linkStatus === 'linked' ? 'This store account is connected.'
                        : linkStatus === 'unverified' ? 'Verify your LetBuyy email before connecting a store account.'
                            : linkStatus === 'conflict' ? 'This store customer record is already connected to another LetBuyy account. Contact the store for help.'
                                : 'We could not connect this store account. You can try again shortly.'}
                </p>}
                <StoreCustomerLinkForm returnTo={pathname || '/'} label="Connect store account" borderColor="var(--border, rgb(229 231 235))" />
            </section>
        </div>
    );
}

function PrivacyEntry({ buyerId }: { buyerId: string }) {
    let href: string;
    try {
        href = buyerPrivacyUrl(buyerId, { NEXT_PUBLIC_ACCOUNTS_URL: process.env.NEXT_PUBLIC_ACCOUNTS_URL });
    } catch {
        href = '';
    }
    return href
        ? <a className="inline-block underline" href={href}>Manage data access</a>
        : <p role="alert">The secure data access page is unavailable. Contact support.</p>;
}

export default function SettingsPageClient() {
    const { buyerSessionEmail, buyerSessionReady, buyerSessionUnavailable } = useWishlist();
    const checking = !buyerSessionReady;
    const unavailable = buyerSessionReady && buyerSessionUnavailable;
    return (
        <>
            {checking && <p role="status">Checking your account…</p>}
            {unavailable && <p role="alert">We could not check your account. Please refresh and try again.</p>}
            <div hidden={checking || unavailable} aria-hidden={checking || unavailable || undefined} inert={checking || unavailable || undefined}>
                {buyerSessionEmail
                    ? <BuyerSettings key={buyerSessionEmail} />
                    : <StoreCustomerSettings />}
            </div>
        </>
    );
}
