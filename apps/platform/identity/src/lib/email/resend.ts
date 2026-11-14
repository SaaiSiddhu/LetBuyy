import { identityApiRequest } from '../api/client'
import { getAccountsUrl } from '../config/urls'
import { letbuyyPrimitiveTokens } from '@letbuyy/ui/tokens'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@letbuyy.com'
const emailTableTag = 'table'
// Email clients cannot resolve CSS variables, so the identity surface's admin ink brand (D-AUTH-LIGHT)
// is inlined from the token source rather than repeated here as hex.
const EMAIL_INK = letbuyyPrimitiveTokens.color.brandInk[800]
const EMAIL_INK_LIGHT = letbuyyPrimitiveTokens.color.brandInk[600]

/**
 * Every value that did not come from this file goes through this before it enters an email's HTML
 * (APPID-SEC2). Until then a store name, a link, a device name or an IP address was inserted raw, so
 * whoever supplied one supplied markup in a message sent from LetBuyy's own address.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** An http(s) URL for an href, escaped; anything else (javascript:, data:, a bare string) becomes '#'. */
export function safeHttpUrl(value: string): string {
  return /^https?:\/\//i.test(value.trim()) ? escapeHtml(value.trim()) : '#'
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Send a transactional email via Resend.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await identityApiRequest<{
      data?: { success: boolean; error?: string }
      success?: boolean
      error?: string
    }>('/auth/custom/emails/send', {
      method: 'POST',
      body: JSON.stringify({
      from: `LetBuyy <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      }),
    })
    const payload = await response.json()
    const result = payload?.data || payload

    if (!response.ok || !result?.success) {
      const error = result?.error || response.statusText || 'Email provider request failed'
      console.error('Resend error:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (err) {
    console.error('Email send failed:', err)
    return { success: false, error: 'Failed to send email' }
  }
}

/**
 * Send verification email with a link.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = `${getAccountsUrl('/api/auth/verify')}?token=${token}&type=email_verify`

  return sendEmail({
    to: email,
    subject: 'Verify your LetBuyy account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: rgb(17 17 17); margin: 0;">LetBuyy</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 16px;">Verify your email</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px;">
          Click the button below to verify your email address and complete your account setup.
        </p>
        <a href="${verifyUrl}" style="display: block; background: rgb(17 17 17); color: rgb(255 255 255); text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Verify email address
        </a>
        <p style="font-size: 13px; color: rgb(153 153 153); margin: 24px 0 0; line-height: 1.5;">
          This link expires in 1 hour. If you didn't create a LetBuyy account, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

/**
 * Send OTP verification email with a 6-digit code.
 */
export async function sendOTPEmail(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: email,
    subject: `${otp} is your LetBuyy verification code`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, ${EMAIL_INK}, ${EMAIL_INK_LIGHT}); border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700;">L</div>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 8px; text-align: center;">Verify your email</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Enter this code to verify your email address and create your LetBuyy account.
        </p>
        <div style="background: rgb(248 249 250); border: 2px solid rgb(229 231 235); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: rgb(17 17 17); font-family: 'SF Mono', 'Fira Code', monospace;">${otp}</div>
        </div>
        <p style="font-size: 13px; color: rgb(153 153 153); line-height: 1.5; text-align: center; margin: 0;">
          This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

/**
 * Send magic link login email.
 */
export async function sendMagicLinkEmail(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const magicUrl = `${getAccountsUrl('/api/auth/verify')}?token=${token}&type=magic_link`

  return sendEmail({
    to: email,
    subject: 'Your LetBuyy login link',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: rgb(17 17 17); margin: 0;">LetBuyy</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 16px;">Log in to LetBuyy</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px;">
          Click the button below to securely log in. This link is single-use and expires in 15 minutes.
        </p>
        <a href="${magicUrl}" style="display: block; background: rgb(17 17 17); color: rgb(255 255 255); text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Log in to LetBuyy
        </a>
        <p style="font-size: 13px; color: rgb(153 153 153); margin: 24px 0 0; line-height: 1.5;">
          If you didn't request this link, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${getAccountsUrl('/reset-password')}?token=${token}`

  return sendEmail({
    to: email,
    subject: 'Reset your LetBuyy password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: rgb(17 17 17); margin: 0;">LetBuyy</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 16px;">Reset your password</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px;">
          Click the button below to set a new password for your account. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: block; background: rgb(17 17 17); color: rgb(255 255 255); text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Reset password
        </a>
        <p style="font-size: 13px; color: rgb(153 153 153); margin: 24px 0 0; line-height: 1.5;">
          If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
        </p>
      </div>
    `,
  })
}

/* ====================================
   STORE CREATION EMAILS
   ==================================== */

const SITE_TYPE_LABELS: Record<string, string> = {
  ecommerce: 'Online Store',
  portfolio: 'Portfolio',
  resume: 'Resume / CV',
  landing_page: 'Landing Page',
}

/**
 * The store-created email. Pure, so its escaping can be tested without sending anything.
 */
export function storeCreatedEmail(input: {
  storeName: string
  siteType: string
  storeUrl: string
  adminUrl: string
}): { subject: string; html: string } {
  const typeLabel = SITE_TYPE_LABELS[input.siteType] || 'Store'
  const storeName = escapeHtml(input.storeName)
  const storeUrl = safeHttpUrl(input.storeUrl)
  const adminUrl = safeHttpUrl(input.adminUrl)

  return {
    subject: `🎉 Your ${typeLabel} is ready!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: rgb(17 17 17); margin: 0;">LetBuyy</h1>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 56px; height: 56px; background: rgb(240 253 244); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">OK</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 8px; text-align: center;">Your ${typeLabel} is Ready! 🎉</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Congratulations! Your ${typeLabel.toLowerCase()} has been created.
        </p>

        <div style="background: rgb(249 250 251); border: 1px solid rgb(229 231 235); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 13px; color: rgb(107 114 128);">Store Name</span><br/>
            <span style="font-size: 15px; font-weight: 600; color: rgb(17 17 17);">${storeName}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <span style="font-size: 13px; color: rgb(107 114 128);">Type</span><br/>
            <span style="font-size: 15px; color: rgb(17 17 17);">${typeLabel}</span>
          </div>
          <div>
            <span style="font-size: 13px; color: rgb(107 114 128);">URL</span><br/>
            <a href="${storeUrl}" style="font-size: 15px; color: ${EMAIL_INK}; text-decoration: none;">${storeUrl}</a>
          </div>
        </div>

        <a href="${adminUrl}" style="display: block; background: ${EMAIL_INK}; color: rgb(255 255 255); text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Open Dashboard →
        </a>

        <div style="margin-top: 24px;">
          <p style="font-size: 14px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 8px;">Next Steps:</p>
          <ul style="font-size: 14px; color: rgb(85 85 85); line-height: 1.8; padding-left: 20px; margin: 0;">
            <li>Customize your store branding and theme</li>
            <li>Add your products or content</li>
            <li>Set up a custom domain</li>
            <li>Publish when you're ready!</li>
          </ul>
        </div>

        <p style="font-size: 12px; color: rgb(156 163 175); margin: 32px 0 0; text-align: center;">
          © LetBuyy · <a href="https://letbuyy.com/support" style="color: ${EMAIL_INK};">Support</a>
        </p>
      </div>
    `,
  }
}

/**
 * Send the store-created email. Only create-store calls this, for the store it just created and the
 * signed-in merchant it created it for.
 */
export async function sendStoreCreatedEmail(
  email: string,
  storeName: string,
  siteType: string,
  storeUrl: string,
  adminUrl: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail({ to: email, ...storeCreatedEmail({ storeName, siteType, storeUrl, adminUrl }) })
}

/**
 * The new-device sign-in alert. Pure, so its escaping can be tested without sending anything. The
 * device name comes from the User-Agent header and the address from X-Forwarded-For, both of which
 * the client writes.
 */
export function newDeviceLoginEmail(
  deviceInfo: { device: string; ip: string; location?: string },
  timestamp: Date = new Date()
): { subject: string; html: string } {
  const formattedTime = timestamp.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const device = escapeHtml(deviceInfo.device || 'Unknown')
  const ip = escapeHtml(deviceInfo.ip || 'Unknown')
  const location = deviceInfo.location ? escapeHtml(deviceInfo.location) : ''

  return {
    subject: 'New sign-in to your LetBuyy account',
    html: `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, ${EMAIL_INK}, ${EMAIL_INK_LIGHT}); border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700;">L</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 8px; text-align: center;">New Sign-In Detected</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Your account was signed into from a new device.
        </p>

        <div style="background: rgb(248 249 250); border: 1px solid rgb(229 231 235); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <${emailTableTag} style="width: 100%; font-size: 14px; color: rgb(51 51 51);">
            <tr><td style="padding: 4px 0; font-weight: 600;">Device</td><td style="padding: 4px 0; text-align: right;">${device}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">IP Address</td><td style="padding: 4px 0; text-align: right; font-family: monospace;">${ip}</td></tr>
            ${location ? '<tr><td style="padding: 4px 0; font-weight: 600;">Location</td><td style="padding: 4px 0; text-align: right;">' + location + '</td></tr>' : ''}
            <tr><td style="padding: 4px 0; font-weight: 600;">Time</td><td style="padding: 4px 0; text-align: right;">${formattedTime}</td></tr>
          </${emailTableTag}>
        </div>

        <div style="background: rgb(255 251 235); border: 1px solid rgb(253 230 138); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: rgb(146 64 14); margin: 0;">
            <strong>Wasn't you?</strong> Change your password immediately and contact support.
          </p>
        </div>

        <p style="font-size: 13px; color: rgb(153 153 153); margin: 24px 0 0; text-align: center;">
          You received this because a new device signed into your LetBuyy account.
        </p>
      </div>
    `,
  }
}

/**
 * Send a security alert when a user logs in from a new device.
 */
export async function sendNewDeviceLoginEmail(
  email: string,
  deviceInfo: { device: string; ip: string; location?: string },
  timestamp: Date = new Date()
) {
  return sendEmail({ to: email, ...newDeviceLoginEmail(deviceInfo, timestamp) })
}

/**
 * Send a notification when the user's password has been changed.
 */
export async function sendPasswordChangedEmail(
  email: string,
  timestamp: Date = new Date()
) {
  const formattedTime = timestamp.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return sendEmail({
    to: email,
    subject: '🔑 Your LetBuyy password was changed',
    html: `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, ${EMAIL_INK}, ${EMAIL_INK_LIGHT}); border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700;">L</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: rgb(17 17 17); margin: 0 0 8px; text-align: center;">Password Changed</h2>
        <p style="font-size: 15px; color: rgb(85 85 85); line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Your account password was successfully changed on ${formattedTime}.
        </p>

        <div style="background: rgb(240 253 244); border: 1px solid rgb(187 247 208); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: rgb(22 101 52); margin: 0;">
            All other sessions have been signed out for security.
          </p>
        </div>

        <div style="background: rgb(255 251 235); border: 1px solid rgb(253 230 138); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: rgb(146 64 14); margin: 0;">
            <strong>Didn't change your password?</strong> Contact support immediately.
          </p>
        </div>

        <p style="font-size: 13px; color: rgb(153 153 153); margin: 24px 0 0; text-align: center;">
          This is an automated security notification from LetBuyy.
        </p>
      </div>
    `,
  })
}
