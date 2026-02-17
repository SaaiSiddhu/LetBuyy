// ============================================================
// SETTINGS PAGE — Placeholder for account settings
// ============================================================

'use client';

import { useCustomerAuth } from '@/context/customer-auth-context';
import { Settings, Mail, User as UserIcon, Lock } from 'lucide-react';

export default function SettingsPage() {
    const { customer } = useCustomerAuth();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

            <div className="space-y-6">
                {/* Profile Info */}
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <UserIcon size={18} />
                        Profile
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Full Name
                            </label>
                            <p className="mt-0.5 font-medium">{customer?.fullName || '—'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Email Address
                            </label>
                            <p className="mt-0.5 font-medium">{customer?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <Lock size={18} />
                        Security
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                        Password change functionality coming soon.
                    </p>
                </div>
            </div>
        </div>
    );
}
