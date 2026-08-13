import type { ChangelogEntry } from './types'

/**
 * Pre-launch release history. Kept deliberately short and in the 1.x range —
 * LetBuyy is still in private beta, so the log should read like a product
 * approaching 1.0 general availability, not a mature 2.x platform.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.9.0',
    date: '2026-07-22',
    tag: 'feature',
    title: 'Theme marketplace opens to partner submissions',
    items: [
      { type: 'feature', text: 'Design partners can now submit themes for review from the developer portal' },
      { type: 'feature', text: 'Every submission runs an automated safety check before it reaches a live store' },
      { type: 'improvement', text: 'Theme previews now render your own products instead of placeholder samples' },
      { type: 'improvement', text: 'Switching themes keeps your existing section settings where the layouts match' },
    ],
  },
  {
    version: '1.8.1',
    date: '2026-07-09',
    tag: 'fix',
    title: 'Checkout and GST invoice fixes',
    items: [
      { type: 'fix', text: 'Inter-state orders now show IGST correctly instead of splitting into CGST and SGST' },
      { type: 'fix', text: 'Double-tapping Place Order on a slow connection no longer creates a duplicate order' },
      { type: 'fix', text: 'COD confirmation messages now send reliably to numbers saved with a +91 prefix' },
      { type: 'improvement', text: 'The GST invoice PDF is now attached to the order confirmation email automatically' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-24',
    tag: 'feature',
    title: 'Gift cards and store credit',
    items: [
      { type: 'feature', text: 'Issue gift cards with a fixed value and an optional expiry date' },
      { type: 'feature', text: 'Buyers can apply a gift card at checkout alongside a coupon' },
      { type: 'feature', text: 'Refunds can be returned as store credit instead of to the original payment method' },
      { type: 'improvement', text: 'Gift card balances now appear on the customer profile with full redemption history' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-05',
    tag: 'feature',
    title: 'WhatsApp order updates',
    items: [
      { type: 'feature', text: 'Send order confirmation, shipping and delivery updates over WhatsApp' },
      { type: 'feature', text: 'Message templates in English and Hindi, editable per store' },
      { type: 'improvement', text: 'COD orders can now ask for a WhatsApp confirmation before they enter fulfilment' },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-05-21',
    tag: 'security',
    title: 'Account and payment hardening',
    items: [
      { type: 'improvement', text: 'Payment provider callbacks are now verified with a timing-safe signature check' },
      { type: 'improvement', text: 'Store sign-in is rate limited to five attempts every fifteen minutes' },
      { type: 'improvement', text: 'Refunds and payouts now require a second confirmation step' },
      { type: 'fix', text: 'Signing out now ends the session on every device, not just the current one' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-06',
    tag: 'feature',
    title: 'Multi-location inventory (beta)',
    items: [
      { type: 'feature', text: 'Hold stock across more than one warehouse or shop' },
      { type: 'feature', text: 'Orders route automatically to the location closest to the buyer' },
      { type: 'feature', text: 'Low stock alerts can be set per location' },
      { type: 'improvement', text: 'The inventory screen now shows stock split across all your locations' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-15',
    tag: 'feature',
    title: 'Custom domains',
    items: [
      { type: 'feature', text: 'Connect your own domain and we handle the SSL certificate' },
      { type: 'feature', text: 'Guided DNS setup with live verification while you wait' },
      { type: 'improvement', text: 'Certificates now renew on their own — nothing to remember' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-26',
    tag: 'improvement',
    title: 'Faster checkout on Indian networks',
    items: [
      { type: 'improvement', text: 'Checkout now loads in about half the time it used to on 4G' },
      { type: 'improvement', text: 'UPI apps installed on the buyer’s phone are detected and shown first' },
      { type: 'improvement', text: 'Address autofill now covers PIN codes across the country' },
      { type: 'fix', text: 'Switching between UPI and COD no longer clears the address already entered' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-10',
    tag: 'feature',
    title: 'Developer platform',
    items: [
      { type: 'feature', text: 'API keys with per-key permissions, issued from the developer portal' },
      { type: 'feature', text: 'Webhooks for order, payment and inventory events' },
      { type: 'feature', text: 'Failed webhooks retry automatically with a widening gap between attempts' },
      { type: 'improvement', text: 'A delivery log shows the last 500 attempts for each endpoint' },
    ],
  },
]
