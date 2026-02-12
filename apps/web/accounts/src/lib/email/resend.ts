import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@letbuyy.store'

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
    const { error } = await getResend().emails.send({
      from: `LetBuyy <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
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
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?
    (process.env.NODE_ENV === 'production' ? 'https://accounts.letbuyy.store' : 'http://localhost:3000') :
    'http://localhost:3000'
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
 * Send magic link login email.
 */
export async function sendMagicLinkEmail(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://accounts.letbuyy.store' : 'http://localhost:3000'
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
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://accounts.letbuyy.store' : 'http://localhost:3000'
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
          <div style="width: 56px; height: 56px; background: #f0fdf4; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">✓</div>
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
    : 'http://localhost:3000/onboarding'

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
          <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; color: #ef4444;">✕</div>
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

