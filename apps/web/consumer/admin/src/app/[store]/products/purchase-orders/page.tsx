'use client'

export default function PurchaseOrdersPage() {
    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Purchase orders</h1>
            </div>

            <div className="products-empty-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                <span className="material-symbols-outlined" style={{
                    fontSize: 48, color: 'var(--text-hint)', marginBottom: 16
                }}>receipt_long</span>
                <h2 style={{
                    fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px'
                }}>Manage your purchase orders</h2>
                <p style={{
                    fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px',
                    maxWidth: 440, marginInline: 'auto', lineHeight: 1.6
                }}>
                    Track and receive inventory ordered from suppliers. Create purchase orders
                    to keep your stock levels accurate and your suppliers organized.
                </p>
                <button
                    style={{
                        background: 'var(--text-primary)', color: 'var(--bg)',
                        padding: '9px 20px', borderRadius: 8, fontSize: 13,
                        fontWeight: 600, border: 'none', cursor: 'pointer'
                    }}
                >
                    Create purchase order
                </button>
            </div>
        </div>
    )
}
