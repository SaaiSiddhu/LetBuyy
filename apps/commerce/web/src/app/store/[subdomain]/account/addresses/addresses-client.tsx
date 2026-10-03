// ============================================================
// ADDRESSES PAGE — Full CRUD for customer saved addresses
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { CustomerAddress } from '@letbuyy/shared-types';
import { Banner, Button, Input,
    MapPin, Plus, Trash2, Edit3, Star, Loader2, X, Home, Briefcase, Check,
} from '@letbuyy/ui';
import { StorefrontEmptyState, StorefrontListLoadingState } from '@/components/storefront/storefront-states';

type AddressRow = Pick<CustomerAddress, 'id' | 'full_name' | 'address_line1' | 'city' | 'state' | 'postal_code' | 'country' | 'is_default'> &
    Partial<Pick<CustomerAddress, 'label' | 'address_line2' | 'landmark'>> & {
        customer_phone?: string | null;
        phone?: string | null;
    };

const EMPTY_FORM = {
    label: 'home',
    full_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'IN',
    landmark: '',
    phone: '',
    is_default: false,
};

const LABEL_ICONS: Record<string, React.ReactNode> = {
    home: <Home size={14} />,
    work: <Briefcase size={14} />,
    other: <MapPin size={14} />,
};

export default function AddressesPageClient() {
    const [addresses, setAddresses] = useState<AddressRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [defaultingId, setDefaultingId] = useState<string | null>(null);
    /** A failed LOAD. Kept separate from `addresses.length === 0` so an outage can
        never be rendered as "you have no addresses" — the two mean opposite things
        to a shopper mid-checkout. */
    const [loadError, setLoadError] = useState<string | null>(null);
    /** A failed WRITE (save/delete/set-default). Shown next to the action that failed. */
    const [actionError, setActionError] = useState<string | null>(null);
    const [buyerMode, setBuyerMode] = useState<boolean | null>(null);
    const pinCodeComplete = form.postal_code.length === 6;

    /** Pull the server's safe message, falling back to something a shopper can act on. */
    const messageFrom = async (res: Response, fallback: string): Promise<string> => {
        try {
            const body = await res.json();
            const message = typeof body?.error === 'string' ? body.error : null;
            return message || fallback;
        } catch {
            return fallback;
        }
    };

    const fetchAddresses = useCallback(async (isBuyer: boolean): Promise<void> => {
        setLoadError(null);
        try {
            const res = await fetch(isBuyer ? '/api/buyer/addresses' : '/api/customer/addresses', { cache: 'no-store' });
            if (!res.ok) {
                // A non-2xx must NOT fall through to `addresses: []`. An expired
                // session (401) previously rendered as an empty address book.
                setLoadError(res.status === 401
                    ? 'Your session has expired. Sign in again to see your saved addresses.'
                    : 'We could not load your addresses.');
                return;
            }
            const data = await res.json() as { addresses?: AddressRow[] };
            setAddresses(data.addresses || []);
        } catch {
            setLoadError('We could not reach the server. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const session = await fetch('/api/buyer-auth/session', { cache: 'no-store', signal: controller.signal });
                if (!session.ok) throw new Error('session_unavailable');
                const payload = await session.json() as { buyer?: unknown };
                const isBuyer = Boolean(payload.buyer);
                setBuyerMode(isBuyer);
                await fetchAddresses(isBuyer);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') return;
                setLoadError('We could not verify your account. Please try again.');
                setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [fetchAddresses]);

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(true);
    };

    const openEdit = (addr: AddressRow) => {
        setForm({
            label: addr.label || 'home',
            full_name: addr.full_name,
            address_line1: addr.address_line1,
            address_line2: addr.address_line2 || '',
            city: addr.city,
            state: addr.state,
            postal_code: addr.postal_code,
            country: addr.country,
            landmark: addr.landmark || '',
            phone: addr.phone || addr.customer_phone || '',
            is_default: addr.is_default,
        });
        setEditingId(addr.id);
        setShowForm(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setActionError(null);
        try {
            const res = buyerMode
                ? await fetch(editingId ? `/api/buyer/addresses/${encodeURIComponent(editingId)}` : '/api/buyer/addresses', {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                : await fetch('/api/customer/addresses', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
            });

            if (!res.ok) {
                // Previously an `if (res.ok)` with no else: a rejected save closed
                // nothing, said nothing, and looked identical to a slow one.
                setActionError(await messageFrom(res, 'We could not save this address.'));
                return;
            }

            setShowForm(false);
            setEditingId(null);
            await fetchAddresses(Boolean(buyerMode));
        } catch {
            setActionError('We could not reach the server. Your address was not saved.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (deletingId) return;
        setDeletingId(id);
        setActionError(null);
        try {
            const res = buyerMode
                ? await fetch(`/api/buyer/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' })
                : await fetch('/api/customer/addresses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (!res.ok) {
                // The row used to be removed from the list unconditionally, so a
                // rejected delete looked like a successful one until the next reload.
                setActionError(await messageFrom(res, 'We could not delete this address.'));
                return;
            }

            setAddresses(prev => prev.filter(a => a.id !== id));
        } catch {
            setActionError('We could not reach the server. This address was not deleted.');
        } finally {
            setDeletingId(null);
        }
    };

    const setDefault = async (id: string) => {
        if (defaultingId) return;
        setDefaultingId(id);
        setActionError(null);
        try {
            const res = buyerMode
                ? await fetch(`/api/buyer/addresses/${encodeURIComponent(id)}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }),
                })
                : await fetch('/api/customer/addresses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_default: true }),
            });

            if (!res.ok) {
                setActionError(await messageFrom(res, 'We could not set this address as default.'));
                return;
            }

            await fetchAddresses(Boolean(buyerMode));
        } catch {
            setActionError('We could not reach the server. The default address is unchanged.');
        } finally {
            setDefaultingId(null);
        }
    };

    if (loading) {
        return <StorefrontListLoadingState rows={3} />;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Addresses</h1>
                <Button unstyled
                    onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)' }}
                >
                    <Plus size={16} />
                    Add Address
                </Button>
            </div>

            {/* A failed write. role="alert" comes from Banner's critical variant. */}
            {actionError && (
                <div className="mb-4">
                    <Banner variant="critical" title="Something went wrong">
                        {actionError}
                    </Banner>
                </div>
            )}

            {/* ── Address Cards ──────────────────────────
                Load failure and "genuinely empty" are rendered as DIFFERENT states.
                Collapsing them told a shopper their address book was empty when the
                request had actually failed. */}
            {loadError ? (
                <Banner
                    variant="critical"
                    title="We could not load your addresses"
                    action={(
                        <Button
                            variant="secondary"
                            onClick={() => { setLoading(true); void fetchAddresses(Boolean(buyerMode)); }}
                        >
                            Try again
                        </Button>
                    )}
                >
                    {loadError}
                </Banner>
            ) : addresses.length === 0 && !showForm ? (
                <StorefrontEmptyState
                    icon={<MapPin size={28} aria-hidden="true" />}
                    title="No saved addresses"
                    body="Add an address for faster checkout."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {addresses.map(addr => {
                        const label = addr.label || 'other';

                        return (
                            <div
                                key={addr.id}
                                className="rounded-2xl border p-4 relative transition-shadow hover:shadow-md"
                                style={{
                                    borderColor: addr.is_default ? 'var(--primary)' : 'var(--border, rgb(229 231 235))',
                                    borderWidth: addr.is_default ? 2 : 1,
                                }}
                            >
                            {/* Label badge */}
                            <div className="flex items-center gap-2 mb-3">
                                <span
                                    className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                                    style={{
                                        backgroundColor: 'var(--surface, rgb(243 244 246))',
                                        color: 'var(--text-secondary, rgb(107 114 128))',
                                    }}
                                >
                                    {LABEL_ICONS[label] || LABEL_ICONS.other}
                                    {label}
                                </span>
                                {addr.is_default && (
                                    <span
                                        className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: `var(--primary)15`, color: 'var(--primary)' }}
                                    >
                                        <Star size={10} fill="currentColor" />
                                        Default
                                    </span>
                                )}
                            </div>

                            <p className="font-semibold text-sm">{addr.full_name}</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                {addr.address_line1}
                                {addr.address_line2 && <>, {addr.address_line2}</>}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                {addr.city}, {addr.state} {addr.postal_code}
                            </p>
                            {addr.landmark && (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted, rgb(156 163 175))' }}>
                                    Landmark: {addr.landmark}
                                </p>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                                <Button unstyled
                                    onClick={() => openEdit(addr)}
                                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                                    style={{ color: 'var(--primary)' }}
                                >
                                    <Edit3 size={12} /> Edit
                                </Button>
                                {!addr.is_default && (
                                    <Button unstyled
                                        onClick={() => setDefault(addr.id)}
                                        disabled={defaultingId === addr.id}
                                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                                        style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}
                                    >
                                        {/* Matches the Delete button beside it, which already
                                            guarded its in-flight state. */}
                                        {defaultingId === addr.id
                                            ? <Loader2 size={12} className="animate-spin" />
                                            : <Star size={12} />}
                                        Set Default
                                    </Button>
                                )}
                                <Button unstyled
                                    onClick={() => handleDelete(addr.id)}
                                    disabled={deletingId === addr.id}
                                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 ml-auto"
                                    style={{ color: 'rgb(239 68 68)' }}
                                >
                                    {deletingId === addr.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Delete
                                </Button>
                            </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Add/Edit Form Modal ─────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
                    <div
                        className="bg-[var(--lb-color-surface)] dark:bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
                        style={{ backgroundColor: 'var(--card-bg, rgb(255 255 255))' }}
                    >
                        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                            <h2 className="font-bold text-lg">
                                {editingId ? 'Edit Address' : 'New Address'}
                            </h2>
                            <Button unstyled onClick={() => { setShowForm(false); setEditingId(null); }}>
                                <X size={20} style={{ color: 'var(--text-secondary, rgb(107 114 128))' }} />
                            </Button>
                        </div>

                        <form onSubmit={handleSave} className="p-4 space-y-4">
                            {/* Label selector */}
                            <div className="flex gap-2">
                                {['home', 'work', 'other'].map(l => (
                                    <Button unstyled
                                        key={l}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, label: l }))}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium capitalize transition-colors"
                                        style={{
                                            backgroundColor: form.label === l ? 'var(--primary)' : 'var(--surface, rgb(243 244 246))',
                                            color: form.label === l ? 'rgb(255 255 255)' : 'var(--text, inherit)',
                                        }}
                                    >
                                        {LABEL_ICONS[l]} {l}
                                    </Button>
                                ))}
                            </div>

                            <Input unstyled
                                required
                                value={form.full_name}
                                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                                placeholder="Full Name *"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                            />
                            <Input unstyled
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^\d+\-\s]/g, '') }))}
                                placeholder="+91 98765 43210"
                                inputMode="tel"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                            />
                            <Input unstyled
                                required
                                value={form.address_line1}
                                onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                                placeholder="Address Line 1 *"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                            />
                            <Input unstyled
                                value={form.address_line2}
                                onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                                placeholder="Address Line 2"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input unstyled
                                    required
                                    value={form.city}
                                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                    placeholder="City *"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                                />
                                <Input unstyled
                                    required
                                    value={form.state}
                                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                                    placeholder="State *"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input unstyled
                                    required
                                    value={form.postal_code}
                                    onChange={e => setForm(f => ({ ...f, postal_code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                    placeholder="PIN Code *"
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                                />
                                <Input unstyled
                                    value={form.landmark}
                                    onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
                                    placeholder="Landmark"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, rgb(229 231 235))', backgroundColor: 'var(--input-bg, rgb(249 250 251))' }}
                                />
                            </div>
                            {form.postal_code.length > 0 && (
                                <p className="text-xs" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                    {pinCodeComplete
                                        ? 'PIN code captured. City/state lookup needs backend support, so confirm those fields before saving.'
                                        : 'Enter a 6-digit India PIN code.'}
                                </p>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer">
                                <Input unstyled
                                    type="checkbox"
                                    checked={form.is_default}
                                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm font-medium">Set as default address</span>
                            </label>

                            <Button unstyled
                                type="submit"
                                disabled={saving}
                                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: 'var(--primary)' }}
                            >
                                {saving ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <><Check size={18} /> {editingId ? 'Update Address' : 'Save Address'}</>
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
