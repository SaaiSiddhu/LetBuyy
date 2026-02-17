// ============================================================
// ADDRESSES PAGE — Placeholder for future address management
// ============================================================

'use client';

import { MapPin, Plus } from 'lucide-react';

export default function AddressesPage() {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Addresses</h1>
                <button
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: 'var(--primary)' }}
                >
                    <Plus size={16} />
                    Add Address
                </button>
            </div>

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
        </div>
    );
}
