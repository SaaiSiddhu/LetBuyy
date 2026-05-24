// ============================================================
// SETTINGS PAGE — Account settings with profile editing + password change
// ============================================================

'use client';

import { useState } from 'react';
import { useCustomerAuth } from '@/context/customer-auth-context';
import {
    User as UserIcon, Lock, Loader2, Check, Eye, EyeOff, Save,
} from 'lucide-react';

export default function SettingsPage() {
    const { customer } = useCustomerAuth();

    // Profile edit state
    const [fullName, setFullName] = useState(customer?.fullName || '');
    const [phone, setPhone] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileSaving(true);
        try {
            const res = await fetch('/api/customer/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, phone }),
            });
            if (res.ok) {
                setProfileSaved(true);
                setTimeout(() => setProfileSaved(false), 3000);
            }
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess(false);

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        setPasswordSaving(true);
        try {
            const res = await fetch('/api/customer/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: currentPassword || undefined,
                    password: newPassword,
                }),
            });

            if (res.ok) {
                setPasswordSuccess(true);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setPasswordSuccess(false), 3000);
            } else {
                const data = await res.json();
                setPasswordError(data.error || 'Failed to update password');
            }
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

            <div className="space-y-6">
                {/* Profile Info */}
                <form onSubmit={handleProfileSave} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <UserIcon size={18} />
                        Profile
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Email Address
                            </label>
                            <p className="text-sm font-medium px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--surface, #F3F4F6)' }}>
                                {customer?.email}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Full Name
                            </label>
                            <input
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Phone Number
                            </label>
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="Enter phone number"
                                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={profileSaving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: profileSaved ? '#10B981' : 'var(--primary)' }}
                        >
                            {profileSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : profileSaved ? (
                                <Check size={16} />
                            ) : (
                                <Save size={16} />
                            )}
                            {profileSaved ? 'Saved!' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                {/* Security */}
                <form onSubmit={handlePasswordChange} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <Lock size={18} />
                        Change Password
                    </h2>
                    <div className="space-y-3">
                        <div className="relative">
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password (if set)"
                                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 pr-10"
                                    style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--text-muted, #9CA3AF)' }}
                                >
                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 pr-10"
                                    style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--text-muted, #9CA3AF)' }}
                                >
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                required
                                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                                style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                            />
                        </div>

                        {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
                        {passwordSuccess && (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                                <Check size={14} /> Password updated successfully!
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={passwordSaving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: 'var(--primary)' }}
                        >
                            {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
