import { identityApiRequest } from '../api/client'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@letbuyy.store'
const LOCAL_ACCOUNTS_URL = 'http://localhost:3001'

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
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://accounts.letbuyy.store' : LOCAL_ACCOUNTS_URL
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}&type=email_verify`

  return sendEmail({
    to: email,
    subject: 'Verify your LetBuyy account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">LetBuyy</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 16px;">Verify your email</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px;">
          Click the button below to verify your email address and complete your account setup.
        </p>
        <a href="${verifyUrl}" style="display: block; background: #111; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Verify email address
        </a>
        <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
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
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #a78bfa); border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700;">L</div>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 8px; text-align: center;">Verify your email</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Enter this code to verify your email address and create your LetBuyy account.
        </p>
        <div style="background: #f8f9fa; border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111; font-family: 'SF Mono', 'Fira Code', monospace;">${otp}</div>
        </div>
        <p style="font-size: 13px; color: #999; line-height: 1.5; text-align: center; margin: 0;">
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
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://accounts.letbuyy.store' : LOCAL_ACCOUNTS_URL
  const magicUrl = `${baseUrl}/api/auth/verify?token=${token}&type=magic_link`

  return sendEmail({
    to: email,
    subject: 'Your LetBuyy login link',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">LetBuyy</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 16px;">Log in to LetBuyy</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px;">
          Click the button below to securely log in. This link is single-use and expires in 15 minutes.
        </p>
        <a href="${magicUrl}" style="display: block; background: #111; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Log in to LetBuyy
        </a>
        <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
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
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://accounts.letbuyy.store' : LOCAL_ACCOUNTS_URL
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  return sendEmail({
    to: email,
    subject: 'Reset your LetBuyy password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">LetBuyy</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 16px;">Reset your password</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px;">
          Click the button below to set a new password for your account. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: block; background: #111; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Reset password
        </a>
        <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
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
 * Send store creation success email.
 */
export async function sendStoreCreatedEmail(
  email: string,
  storeName: string,
  siteType: string,
  storeUrl: string,
  adminUrl: string
): Promise<{ success: boolean; error?: string }> {
  const typeLabel = SITE_TYPE_LABELS[siteType] || siteType

  return sendEmail({
    to: email,
    subject: `🎉 Your ${typeLabel} is ready!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">LetBuyy</h1>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 56px; height: 56px; background: #f0fdf4; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">OK</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 8px; text-align: center;">Your ${typeLabel} is Ready! 🎉</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Congratulations! Your ${typeLabel.toLowerCase()} has been created.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 13px; color: #6b7280;">Store Name</span><br/>
            <span style="font-size: 15px; font-weight: 600; color: #111;">${storeName}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <span style="font-size: 13px; color: #6b7280;">Type</span><br/>
            <span style="font-size: 15px; color: #111;">${typeLabel}</span>
          </div>
          <div>
            <span style="font-size: 13px; color: #6b7280;">URL</span><br/>
            <a href="${storeUrl}" style="font-size: 15px; color: #8b5cf6; text-decoration: none;">${storeUrl}</a>
          </div>
        </div>

        <a href="${adminUrl}" style="display: block; background: #8b5cf6; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Open Dashboard →
        </a>

        <div style="margin-top: 24px;">
          <p style="font-size: 14px; font-weight: 600; color: #111; margin: 0 0 8px;">Next Steps:</p>
          <ul style="font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li>Customize your store branding and theme</li>
            <li>Add your products or content</li>
            <li>Set up a custom domain</li>
            <li>Publish when you're ready!</li>
          </ul>
        </div>

        <p style="font-size: 12px; color: #9ca3af; margin: 32px 0 0; text-align: center;">
          © LetBuyy · <a href="https://letbuyy.store/support" style="color: #8b5cf6;">Support</a>
        </p>
      </div>
    `,
  })
}

/**
 * Send store creation failure email.
 */
export async function sendStoreCreationFailedEmail(
  email: string,
  storeName: string,
  siteType: string,
  reason: string,
  errorDetails?: string
): Promise<{ success: boolean; error?: string }> {
  const typeLabel = SITE_TYPE_LABELS[siteType] || siteType
  const retryUrl = process.env.NODE_ENV === 'production'
    ? 'https://accounts.letbuyy.store/onboarding'
    : `${LOCAL_ACCOUNTS_URL}/onboarding`

  const reasonMessages: Record<string, { title: string; solution: string }> = {
    subdomain_taken: { title: 'Subdomain Already Taken', solution: 'Try a different store name.' },
    database_error: { title: 'Database Error', solution: 'Please try again in a few minutes.' },
    validation_error: { title: 'Validation Failed', solution: 'Check your store name and try again.' },
    rate_limit: { title: 'Too Many Attempts', solution: 'Please wait a few minutes and try again.' },
    unknown: { title: 'Unexpected Error', solution: 'Please contact support if this persists.' },
  }

  const msg = reasonMessages[reason] || reasonMessages.unknown

  return sendEmail({
    to: email,
    subject: `Store creation failed – ${msg.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0;">LetBuyy</h1>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; color: #ef4444;">X</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 8px; text-align: center;">Store Creation Failed</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px; text-align: center;">
          We encountered an issue while creating your ${typeLabel.toLowerCase()}.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="font-size: 15px; font-weight: 600; color: #b91c1c; margin: 0 0 4px;">${msg.title}</p>
          ${errorDetails ? `<p style="font-size: 13px; color: #7f1d1d; margin: 0 0 12px; font-family: monospace;">${errorDetails}</p>` : ''}
          <p style="font-size: 14px; color: #555; margin: 0;"><strong>Solution:</strong> ${msg.solution}</p>
        </div>

        <a href="${retryUrl}" style="display: block; background: #111; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Try Again →
        </a>

        <p style="font-size: 13px; color: #999; margin: 24px 0 0; text-align: center;">
          Need help? <a href="https://letbuyy.store/support" style="color: #8b5cf6;">Contact Support</a>
        </p>
      </div>
    `,
  })
}

/**
 * Send a security alert when a user logs in from a new device.
 */
export async function sendNewDeviceLoginEmail(
  email: string,
  deviceInfo: { device: string; ip: string; location?: string },
  timestamp: Date = new Date()
) {
  const formattedTime = timestamp.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return sendEmail({
    to: email,
    subject: 'New sign-in to your LetBuyy account',
    html: `
      <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #a78bfa); border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700;">L</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 8px; text-align: center;">New Sign-In Detected</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Your account was signed into from a new device.
        </p>

        <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; font-size: 14px; color: #333;">
            <tr><td style="padding: 4px 0; font-weight: 600;">Device</td><td style="padding: 4px 0; text-align: right;">${deviceInfo.device || 'Unknown'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">IP Address</td><td style="padding: 4px 0; text-align: right; font-family: monospace;">${deviceInfo.ip || 'Unknown'}</td></tr>
            ${deviceInfo.location ? '<tr><td style="padding: 4px 0; font-weight: 600;">Location</td><td style="padding: 4px 0; text-align: right;">' + deviceInfo.location + '</td></tr>' : ''}
            <tr><td style="padding: 4px 0; font-weight: 600;">Time</td><td style="padding: 4px 0; text-align: right;">${formattedTime}</td></tr>
          </table>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #92400e; margin: 0;">
            <strong>Wasn't you?</strong> Change your password immediately and contact support.
          </p>
        </div>

        <p style="font-size: 13px; color: #999; margin: 24px 0 0; text-align: center;">
          You received this because a new device signed into your LetBuyy account.
        </p>
      </div>
    `,
  })
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
          <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #a78bfa); border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700;">L</div>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 8px; text-align: center;">Password Changed</h2>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px; text-align: center;">
          Your account password was successfully changed on ${formattedTime}.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #166534; margin: 0;">
            All other sessions have been signed out for security.
          </p>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #92400e; margin: 0;">
            <strong>Didn't change your password?</strong> Contact support immediately.
          </p>
        </div>

        <p style="font-size: 13px; color: #999; margin: 24px 0 0; text-align: center;">
          This is an automated security notification from LetBuyy.
        </p>
      </div>
    `,
  })
}
