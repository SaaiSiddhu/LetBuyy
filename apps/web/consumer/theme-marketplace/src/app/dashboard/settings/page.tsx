'use client';

import { useState } from 'react';
import { User, Bell, Shield, CreditCard, Mail, Globe, Moon, Sun, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
    const [saved, setSaved] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [updateNotifs, setUpdateNotifs] = useState(true);
    const [marketingNotifs, setMarketingNotifs] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Settings</h1>
                <p className="text-sm text-text-muted">Manage your account preferences</p>
            </div>

            <div className="space-y-6 max-w-2xl">
                {/* Profile */}
                <div className="glass-card p-6" style={{ transform: 'none' }}>
                    <h2 className="text-base font-semibold text-text-heading flex items-center gap-2 mb-5">
                        <User className="w-4 h-4 text-primary-light" />
                        Profile
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-text-muted block mb-1.5">Display Name</label>
                            <input
                                type="text"
                                defaultValue="Saai Sidd"
                                className="w-full px-4 py-2.5 rounded-lg bg-bg-card border border-border text-text-heading text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-muted block mb-1.5">Email</label>
                            <input
                                type="email"
                                defaultValue="saai@letbuyy.com"
                                className="w-full px-4 py-2.5 rounded-lg bg-bg-card border border-border text-text-heading text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Appearance */}
                <div className="glass-card p-6" style={{ transform: 'none' }}>
                    <h2 className="text-base font-semibold text-text-heading flex items-center gap-2 mb-5">
                        <Moon className="w-4 h-4 text-primary-light" />
                        Appearance
                    </h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-heading">Dark Mode</p>
                            <p className="text-xs text-text-muted">Use dark color scheme</p>
                        </div>
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={cn(
                                'relative w-12 h-6 rounded-full transition-colors',
                                darkMode ? 'bg-primary' : 'bg-surface'
                            )}
                        >
                            <div className={cn(
                                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                                darkMode ? 'translate-x-6' : 'translate-x-0.5'
                            )} />
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="glass-card p-6" style={{ transform: 'none' }}>
                    <h2 className="text-base font-semibold text-text-heading flex items-center gap-2 mb-5">
                        <Bell className="w-4 h-4 text-primary-light" />
                        Notifications
                    </h2>
                    <div className="space-y-4">
                        {[
                            { label: 'Email Notifications', desc: 'Receive purchase receipts and updates', value: emailNotifs, set: setEmailNotifs },
                            { label: 'Theme Updates', desc: 'Get notified when themes are updated', value: updateNotifs, set: setUpdateNotifs },
                            { label: 'Marketing', desc: 'New themes, promotions, and tips', value: marketingNotifs, set: setMarketingNotifs },
                        ].map(item => (
                            <div key={item.label} className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-heading">{item.label}</p>
                                    <p className="text-xs text-text-muted">{item.desc}</p>
                                </div>
                                <button
                                    onClick={() => item.set(!item.value)}
                                    className={cn(
                                        'relative w-12 h-6 rounded-full transition-colors',
                                        item.value ? 'bg-primary' : 'bg-surface'
                                    )}
                                >
                                    <div className={cn(
                                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                                        item.value ? 'translate-x-6' : 'translate-x-0.5'
                                    )} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Security */}
                <div className="glass-card p-6" style={{ transform: 'none' }}>
                    <h2 className="text-base font-semibold text-text-heading flex items-center gap-2 mb-5">
                        <Shield className="w-4 h-4 text-primary-light" />
                        Security
                    </h2>
                    <div className="space-y-3">
                        <button className="btn-secondary text-sm py-2.5 px-4 w-full text-left">
                            Change Password
                        </button>
                        <button className="btn-secondary text-sm py-2.5 px-4 w-full text-left">
                            Two-Factor Authentication
                        </button>
                    </div>
                </div>

                {/* Save */}
                <button onClick={handleSave} className="btn-primary py-3 px-6 flex items-center gap-2">
                    {saved ? (
                        <>
                            <Check className="w-4 h-4" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Changes
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
