'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/resources/categories'

const FREQUENCY_OPTIONS = [
  { id: 'weekly', label: 'Weekly digest', desc: 'Best of the week, every Tuesday morning' },
  { id: 'instant', label: 'Instant updates', desc: 'Get articles as soon as they publish' },
]

export default function NewsletterPage() {
  const [selected, setSelected] = useState<string[]>(CATEGORIES.map(c => c.slug))
  const [frequency, setFrequency] = useState('weekly')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function toggle(slug: string) {
    setSelected(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    )
  }

  function selectAll() {
    setSelected(CATEGORIES.map(c => c.slug))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="res-newsletter-page">
      <div className="container" style={{ maxWidth: 640 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Resources</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>Newsletter</span>
        </nav>

        <div className="res-newsletter-hero">
          <h1>Stay ahead in Indian commerce</h1>
          <p>
            Join 35,000+ merchants and developers getting weekly insights on ecommerce strategy, payments, operations, and platform updates.
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', border: '1px solid var(--border-subtle)', borderRadius: 16, background: 'var(--bg-card)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>You&apos;re subscribed!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
              We&apos;ll send your first digest to <strong>{email}</strong> on Tuesday.
            </p>
            <Link href="/resources" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
              ← Browse articles
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="you@store.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="rc-newsletter-input"
                style={{ width: '100%', fontSize: 15 }}
              />
            </div>

            {/* Frequency */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                How often do you want updates?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FREQUENCY_OPTIONS.map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setFrequency(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: `1px solid ${frequency === opt.id ? 'var(--primary)' : 'var(--border-subtle)'}`,
                      background: frequency === opt.id ? 'var(--primary-glow)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: `2px solid ${frequency === opt.id ? 'var(--primary)' : 'var(--border-light)'}`,
                      background: frequency === opt.id ? 'var(--primary)' : 'transparent',
                      flexShrink: 0,
                    }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Which topics interest you?
                </p>
                <button type="button" onClick={selectAll} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Select all
                </button>
              </div>
              <div className="res-newsletter-categories">
                {CATEGORIES.map(cat => {
                  const checked = selected.includes(cat.slug)
                  return (
                    <div
                      key={cat.slug}
                      className="res-newsletter-cat-row"
                      onClick={() => toggle(cat.slug)}
                      style={{ borderColor: checked ? `${cat.color}50` : 'var(--border-subtle)', background: checked ? cat.accent : 'var(--bg-card)' }}
                    >
                      <div className="res-cat-icon-wrap" style={{ background: cat.accent, width: 32, height: 32, borderRadius: 8 }}>
                        <span style={{ fontSize: 14, color: cat.color }}>◆</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p className="res-newsletter-cat-label" style={{ color: checked ? cat.color : 'var(--text-primary)' }}>{cat.label}</p>
                        <p className="res-newsletter-cat-desc">{cat.description}</p>
                      </div>
                      <div className={`res-newsletter-check${checked ? ' checked' : ''}`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="submit"
              className="rc-newsletter-btn"
              style={{ width: '100%', padding: '14px', fontSize: 15, borderRadius: 10 }}
            >
              Subscribe — it&apos;s free
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 12 }}>
              No spam. Unsubscribe anytime. By subscribing you agree to our Privacy Policy.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
