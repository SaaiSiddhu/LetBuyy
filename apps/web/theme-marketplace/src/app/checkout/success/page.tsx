import Link from 'next/link';
import { CheckCircle, Download, Palette, LayoutDashboard, ArrowRight, Copy, Key } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Purchase Complete' };

export default function SuccessPage() {
    const licenseKey = 'LBTH-A4B2-C8D1-E6F3-G9H7';

    return (
        <div className="container-main py-16 md:py-24 max-w-2xl mx-auto text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-success" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-3">Purchase Complete!</h1>
            <p className="text-text-body text-lg mb-10">
                Thank you for your purchase. Your theme is ready to install.
            </p>

            {/* Order Details */}
            <div className="glass-card p-6 text-left mb-10 space-y-4" style={{ transform: 'none' }}>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Order</span>
                    <span className="text-text-heading font-medium">#LBT-2026-0042</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Theme</span>
                    <span className="text-text-heading font-medium">Neon Tech (Premium Store)</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Amount</span>
                    <span className="text-text-heading font-medium">$49.00</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Payment</span>
                    <span className="text-text-heading font-medium">Stripe •••• 4242</span>
                </div>

                <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-primary-light" />
                            <span className="text-sm text-text-muted">License Key</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-primary-light bg-primary/10 px-3 py-1 rounded-lg">
                                {licenseKey}
                            </code>
                            <button className="p-1.5 rounded-lg hover:bg-surface transition-colors" title="Copy">
                                <Copy className="w-4 h-4 text-text-subtle" />
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-[11px] text-text-subtle">
                    A receipt has been sent to your email address.
                </p>
            </div>

            {/* Next Steps */}
            <h2 className="text-xl font-bold mb-6">What&apos;s Next?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <div className="glass-card p-5 text-center" style={{ transform: 'none' }}>
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                        <Download className="w-5 h-5 text-primary-light" />
                    </div>
                    <p className="text-xs font-semibold text-text-heading mb-1">1. Install</p>
                    <p className="text-[11px] text-text-muted">Select a store to install your theme</p>
                </div>
                <div className="glass-card p-5 text-center" style={{ transform: 'none' }}>
                    <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center mx-auto mb-3">
                        <Palette className="w-5 h-5 text-secondary" />
                    </div>
                    <p className="text-xs font-semibold text-text-heading mb-1">2. Customize</p>
                    <p className="text-[11px] text-text-muted">Change colors, fonts & layouts</p>
                </div>
                <div className="glass-card p-5 text-center" style={{ transform: 'none' }}>
                    <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center mx-auto mb-3">
                        <LayoutDashboard className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-xs font-semibold text-text-heading mb-1">3. Launch</p>
                    <p className="text-[11px] text-text-muted">Go live with your new look!</p>
                </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/dashboard" className="btn-primary py-3 px-6 flex items-center gap-2">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/themes" className="btn-secondary py-3 px-6">
                    Browse More Themes
                </Link>
            </div>
        </div>
    );
}
