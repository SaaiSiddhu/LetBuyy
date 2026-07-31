'use client'

import { useState } from 'react'

const TRUST_ITEMS = [
  { icon: 'users', text: '35,000+ merchants' },
  { icon: 'star', text: 'Weekly insights' },
  { icon: 'shield', text: 'No spam, ever' },
]

export default function PostArticleNewsletter() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email) setSubscribed(true)
  }

  return (
    <section className="arc-post-nl-section" aria-label="Newsletter signup">
      <div className="arc-post-nl-inner">
        <div className="arc-post-nl-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Commerce Intelligence
        </div>

        <h2 className="arc-post-nl-title">
          Join 35,000+ Indian merchants
        </h2>
        <p className="arc-post-nl-sub">
          AI commerce, growth playbooks, and platform updates — every week. Used by merchants across India to grow faster.
        </p>

        {/* Trust indicators */}
        <div className="arc-post-nl-trust">
          <div className="arc-post-nl-trust-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            35,000+ subscribers
          </div>
          <div className="arc-post-nl-trust-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Weekly, every Tuesday
          </div>
          <div className="arc-post-nl-trust-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            No spam, ever
          </div>
        </div>

        {subscribed ? (
          <p className="arc-post-nl-ok">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            You&apos;re in — check your inbox!
          </p>
        ) : (
          <>
            <form className="arc-post-nl-form" onSubmit={handleSubmit}>
              <input
                type="email"
                className="arc-post-nl-input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                aria-label="Email address"
              />
              <button type="submit" className="arc-post-nl-btn">Subscribe</button>
            </form>
            <p className="arc-post-nl-hint">Unsubscribe anytime. Your data stays private.</p>
          </>
        )}
      </div>
    </section>
  )
}
