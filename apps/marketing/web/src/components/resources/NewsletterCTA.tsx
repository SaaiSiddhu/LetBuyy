'use client'

import { useState } from 'react'
import { Button, Input } from '@letbuyy/ui'

export default function NewsletterCTA() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email) setSubscribed(true)
  }

  return (
    <div className="rc-newsletter">
      <h3>Get commerce insights, weekly.</h3>
      <p>35,000+ Indian merchants read our newsletter. No spam, ever.</p>

      {subscribed ? (
        <p className="rc-newsletter-success">
          ✓ You&apos;re subscribed! Check your inbox.
        </p>
      ) : (
        <form className="rc-newsletter-form" onSubmit={handleSubmit}>
          <Input
            unstyled
            type="email"
            className="rc-newsletter-input"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            aria-label="Email address"
          />
          <Button unstyled type="submit" className="rc-newsletter-btn">
            Subscribe
          </Button>
        </form>
      )}
    </div>
  )
}
