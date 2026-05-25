// ============================================================
// ADDRESSES PAGE — Full CRUD for customer saved addresses
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    MapPin, Plus, Trash2, Edit3, Star, Loader2, X, Home, Briefcase, Check,
} from 'lucide-react';

interface Address {
    id: string;
    label: string;
    full_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    landmark?: string;
    is_default: boolean;
    customer_phone?: string;
}

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

export default function AddressesPage() {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchAddresses = useCallback(async () => {
        try {
            const res = await fetch('/api/customer/addresses');
            const data = await res.json();
            setAddresses(data.addresses || []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(true);
    };

    const openEdit = (addr: Address) => {
        setForm({
            label: addr.label,
            full_name: addr.full_name,
            address_line1: addr.address_line1,
            address_line2: addr.address_line2 || '',
            city: addr.city,
            state: addr.state,
            postal_code: addr.postal_code,
            country: addr.country,
            landmark: addr.landmark || '',
            phone: addr.customer_phone || '',
            is_default: addr.is_default,
        });
        setEditingId(addr.id);
        setShowForm(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = editingId ? 'PUT' : 'POST';
            const body = editingId ? { id: editingId, ...form } : form;

            const res = await fetch('/api/customer/addresses', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setShowForm(false);
                setEditingId(null);
                fetchAddresses();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await fetch('/api/customer/addresses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setAddresses(prev => prev.filter(a => a.id !== id));
        } finally {
            setDeletingId(null);
        }
    };

    const setDefault = async (id: string) => {
        await fetch('/api/customer/addresses', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_default: true }),
        });
        fetchAddresses();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Addresses</h1>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)' }}
                >
                    <Plus size={16} />
                    Add Address
                </button>
            </div>

            {/* ── Address Cards ────────────────────────── */}
            {addresses.length === 0 && !showForm ? (
                <div className="text-center py-16">
                    <div
                        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--surface, #F3F4F6)' }}
                    >
                        <MapPin size={28} style={{ color: 'var(--text-secondary, #9CA3AF)' }} />
                    </div>
                    <h2 className="text-lg font-semibold mb-1">No saved addresses</h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                        Add an address for faster checkout.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {addresses.map(addr => (
                        <div
                            key={addr.id}
                            className="rounded-2xl border p-4 relative transition-shadow hover:shadow-md"
                            style={{
                                borderColor: addr.is_default ? 'var(--primary)' : 'var(--border, #E5E7EB)',
                                borderWidth: addr.is_default ? 2 : 1,
                            }}
                        >
                            {/* Label badge */}
                            <div className="flex items-center gap-2 mb-3">
                                <span
                                    className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                                    style={{
                                        backgroundColor: 'var(--surface, #F3F4F6)',
                                        color: 'var(--text-secondary, #6B7280)',
                                    }}
                                >
                                    {LABEL_ICONS[addr.label] || LABEL_ICONS.other}
                                    {addr.label}
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
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                {addr.address_line1}
                                {addr.address_line2 && <>, {addr.address_line2}</>}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                {addr.city}, {addr.state} {addr.postal_code}
                            </p>
                            {addr.landmark && (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted, #9CA3AF)' }}>
                                    Landmark: {addr.landmark}
                                </p>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                                <button
                                    onClick={() => openEdit(addr)}
                                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                                    style={{ color: 'var(--primary)' }}
                                >
                                    <Edit3 size={12} /> Edit
                                </button>
                                {!addr.is_default && (
                                    <button
                                        onClick={() => setDefault(addr.id)}
                                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                                        style={{ color: 'var(--text-secondary, #6B7280)' }}
                                    >
                                        <Star size={12} /> Set Default
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(addr.id)}
                                    disabled={deletingId === addr.id}
                                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 ml-auto"
                                    style={{ color: '#EF4444' }}
                                >
                                    {deletingId === addr.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Add/Edit Form Modal ─────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
                    <div
                        className="bg-white dark:bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
                        style={{ backgroundColor: 'var(--card-bg, #fff)' }}
                    >
                        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                            <h2 className="font-bold text-lg">
                                {editingId ? 'Edit Address' : 'New Address'}
                            </h2>
                            <button onClick={() => { setShowForm(false); setEditingId(null); }}>
                                <X size={20} style={{ color: 'var(--text-secondary, #6B7280)' }} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-4 space-y-4">
                            {/* Label selector */}
                            <div className="flex gap-2">
                                {['home', 'work', 'other'].map(l => (
                                    <button
                                        key={l}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, label: l }))}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium capitalize transition-colors"
                                        style={{
                                            backgroundColor: form.label === l ? 'var(--primary)' : 'var(--surface, #F3F4F6)',
                                            color: form.label === l ? '#FFFFFF' : 'var(--text, inherit)',
                                        }}
                                    >
                                        {LABEL_ICONS[l]} {l}
                                    </button>
                                ))}
                            </div>

                            <input
                                required
                                value={form.full_name}
                                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                                placeholder="Full Name *"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                            <input
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="Phone Number"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                            <input
                                required
                                value={form.address_line1}
                                onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                                placeholder="Address Line 1 *"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                            <input
                                value={form.address_line2}
                                onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                                placeholder="Address Line 2"
                                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    required
                                    value={form.city}
                                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                    placeholder="City *"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                                />
                                <input
                                    required
                                    value={form.state}
                                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                                    placeholder="State *"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    required
                                    value={form.postal_code}
                                    onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
                                    placeholder="PIN Code *"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                                />
                                <input
                                    value={form.landmark}
                                    onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
                                    placeholder="Landmark"
                                    className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2"
                                    style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_default}
                                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm font-medium">Set as default address</span>
                            </label>

                            <button
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
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
