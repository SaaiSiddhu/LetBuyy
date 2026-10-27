import { AUTH_OTP_EXPIRY_MS, AUTH_TOKEN_EXPIRY_MS } from '@letbuyy/auth-core'
import {
  DEFAULT_EMAIL_BRAND, ctaButton, ctaRow, detailRow, detailTable, divider,
  escapeHtml, eyebrow, formatEmailSender, heading, paragraph, renderEmailShell,
  safeSubject, sectionLabel, smallPrint, verificationCode,
  type EmailShellOptions, type RenderedEmailMessage,
} from '@letbuyy/notification-core/email'
import { identityApiRequest } from '../api/client'
import { getAccountsUrl } from '../config/urls'

export { escapeHtml } from '@letbuyy/notification-core/email'

/** Compatibility helper: callers pass raw URLs to the shared shell's safeHref boundary. */
export function safeHttpUrl(value: string): string {
  return /^https?:\/\//i.test(value.trim()) ? escapeHtml(value.trim()) : '#'
}

function emailBrand() {
  const configured = process.env.EMAIL_ASSET_BASE_URL?.trim()
  let assetUrl = DEFAULT_EMAIL_BRAND.assetUrl
  if (configured) {
    try {
      const value = new URL(configured)
      if (value.protocol === 'https:' && !value.username && !value.password && value.hostname !== 'localhost' && !value.hostname.endsWith('.localhost')) assetUrl = value.origin
    } catch { /* Public canonical logo remains available when image configuration is invalid. */ }
  }
  return { ...DEFAULT_EMAIL_BRAND, assetUrl }
}

function message(subject: string, body: string, text: string, options: EmailShellOptions): RenderedEmailMessage {
  return {
    subject: safeSubject(subject),
    html: renderEmailShell(emailBrand(), body, options),
    text: `LetBuyy\n\n${text}\n\n${options.reason}\nSupport: ${DEFAULT_EMAIL_BRAND.supportEmail}`,
  }
}

interface SendEmailOptions { to: string; subject: string; html: string; text?: string }

/** Delivery uses the existing signed Identity → Gateway → Resend transport. */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await identityApiRequest<{
      data?: { success: boolean; error?: string }; success?: boolean; error?: string
    }>('/auth/custom/emails/send', {
      method: 'POST',
      body: JSON.stringify({ from: formatEmailSender(process.env.RESEND_FROM_EMAIL), to, subject: safeSubject(subject), html, ...(text ? { text } : {}) }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !(payload?.data || payload)?.success) {
      console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'email_delivery_failed', status: response.status }))
      return { success: false, error: 'Failed to send email' }
    }
    return { success: true }
  } catch {
    console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'email_delivery_unavailable' }))
    return { success: false, error: 'Failed to send email' }
  }
}

function actionUrl(path: string, token: string, type?: string): string {
  const url = new URL(getAccountsUrl(path))
  url.searchParams.set('token', token)
  if (type) url.searchParams.set('type', type)
  return url.toString()
}

const minutes = (milliseconds: number) => `${Math.round(milliseconds / 60_000)} minutes`

export function verificationEmail(token: string): RenderedEmailMessage {
  const url = actionUrl('/api/auth/verify', token, 'email_verify')
  return message('Verify your LetBuyy account',
    eyebrow('Welcome to LetBuyy') + heading('One step closer to your next idea.') +
    paragraph('Confirm your email address to finish setting up your LetBuyy account.') +
    ctaRow([ctaButton(url, 'Verify email address')]) +
    smallPrint(`This link expires in ${minutes(AUTH_TOKEN_EXPIRY_MS.email_verify)}. If you did not create an account, you can ignore this email.`),
    `Confirm your email address: ${url}\nThis link expires in ${minutes(AUTH_TOKEN_EXPIRY_MS.email_verify)}. If you did not create an account, ignore this email.`,
    { preheader: 'Confirm your email address to finish setting up LetBuyy.', reason: 'You received this message because this address was used to create a LetBuyy account.', category: 'security' })
}

export async function sendVerificationEmail(email: string, token: string) { return sendEmail({ to: email, ...verificationEmail(token) }) }

export function otpEmail(otp: string): RenderedEmailMessage {
  return message('Your LetBuyy verification code',
    eyebrow('Account verification') + heading('Your verification code') +
    paragraph('Enter this one-time code to continue creating your LetBuyy account.') + verificationCode(otp) +
    smallPrint(`Expires in ${minutes(AUTH_OTP_EXPIRY_MS)}. Do not share this code with anyone, including anyone claiming to be LetBuyy support.`),
    `Your verification code is ${otp}.\nIt expires in ${minutes(AUTH_OTP_EXPIRY_MS)}. Do not share it with anyone.`,
    { preheader: 'A one-time code to verify your email address.', reason: 'You requested an email verification code. If this was not you, ignore this message.', category: 'security' })
}

export async function sendOTPEmail(email: string, otp: string) { return sendEmail({ to: email, ...otpEmail(otp) }) }

export function magicLinkEmail(token: string): RenderedEmailMessage {
  const url = actionUrl('/api/auth/verify', token, 'magic_link')
  return message('Your secure LetBuyy sign-in link',
    eyebrow('Secure sign-in') + heading('Welcome back.') +
    paragraph('Use this single-use link to sign in to your LetBuyy account.') + ctaRow([ctaButton(url, 'Sign in to LetBuyy')]) +
    smallPrint(`This link expires in ${minutes(AUTH_TOKEN_EXPIRY_MS.magic_link)}. If you did not request it, you can ignore this email.`),
    `Sign in to LetBuyy: ${url}\nThis single-use link expires in ${minutes(AUTH_TOKEN_EXPIRY_MS.magic_link)}. If you did not request it, ignore this email.`,
    { preheader: 'Your single-use sign-in link is ready.', reason: 'You requested a secure sign-in link for your LetBuyy account.', category: 'security' })
}

export async function sendMagicLinkEmail(email: string, token: string) { return sendEmail({ to: email, ...magicLinkEmail(token) }) }

export function passwordResetEmail(token: string): RenderedEmailMessage {
  const url = actionUrl('/reset-password', token)
  return message('Reset your LetBuyy password',
    eyebrow('Account security') + heading('Reset your password') +
    paragraph('We received a request to reset your LetBuyy merchant account password. Choose a new password using the secure link below.') +
    ctaRow([ctaButton(url, 'Reset password')]) +
    smallPrint(`This single-use link expires in ${minutes(AUTH_TOKEN_EXPIRY_MS.password_reset)}. Your password will stay the same until you complete the reset.`) +
    divider() + paragraph('Did not request this? You can safely ignore this email. Never share your password or reset link.'),
    `Reset your LetBuyy merchant password: ${url}\nThis single-use link expires in ${minutes(AUTH_TOKEN_EXPIRY_MS.password_reset)}. Your password does not change until you complete the reset. If you did not request this, ignore this email.`,
    { preheader: 'Use this secure link to choose a new password.', reason: 'A password reset was requested for your LetBuyy account.', category: 'security' })
}

export async function sendPasswordResetEmail(email: string, token: string) { return sendEmail({ to: email, ...passwordResetEmail(token) }) }

export function storeCreatedEmail(input: { storeName: string; siteType: string; storeUrl: string; adminUrl: string }): RenderedEmailMessage {
  const name = escapeHtml(input.storeName)
  return message('Your LetBuyy store is ready to shape',
    eyebrow('Your next chapter starts here') + heading(`Welcome to ${name}.`) +
    paragraph('Your store workspace is set up. Bring your products, your story and your first customers together in one place.') +
    ctaRow([ctaButton(input.adminUrl, 'Open your store dashboard')]) +
    sectionLabel('Three steps to your first launch') +
    detailTable([
      detailRow('01 · Add your products', 'Start with a clear photo, a useful description and your price.'),
      detailRow('02 · Make it yours', 'Choose your design and customize the details that make your brand recognizable.'),
      detailRow('03 · Get ready to sell', 'Review payment and delivery settings, then publish when you are ready.'),
    ]) + smallPrint('Your dashboard is the place to check your store visibility and preview your storefront before you share it.'),
    `${input.storeName} is ready to shape.\nOpen your dashboard: ${input.adminUrl}\n1. Add your products.\n2. Customize your design.\n3. Review payments, delivery and store visibility before publishing.`,
    { preheader: 'Your store workspace is ready. Take the first steps toward launch.', reason: 'You received this message because you created a store on LetBuyy.', category: 'onboarding' })
}

export async function sendStoreCreatedEmail(email: string, storeName: string, siteType: string, storeUrl: string, adminUrl: string) {
  return sendEmail({ to: email, ...storeCreatedEmail({ storeName, siteType, storeUrl, adminUrl }) })
}

function formattedTime(timestamp: Date): string {
  return timestamp.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST'
}

export function newDeviceLoginEmail(deviceInfo: { device: string; ip: string; location?: string }, timestamp: Date = new Date()): RenderedEmailMessage {
  const time = formattedTime(timestamp)
  const device = deviceInfo.device || 'Not available'
  const ip = deviceInfo.ip || 'Not available'
  return message('New sign-in to your LetBuyy account',
    eyebrow('Account security') + heading('A new device signed in') +
    paragraph('We noticed a sign-in to your account from a new device. If this was you, no action is needed.') +
    detailTable([detailRow('When', escapeHtml(time)), detailRow('Device', escapeHtml(device)), detailRow('Location', escapeHtml(deviceInfo.location || 'Not available')), detailRow('IP address', escapeHtml(ip))]) +
    sectionLabel('Was this not you?') + paragraph('Reset your password to secure your account. LetBuyy support will never ask for your password or verification code.') +
    ctaRow([ctaButton(getAccountsUrl('/forgot-password'), 'Secure your account')]),
    `A new device signed in.\nWhen: ${time}\nDevice: ${device}\nLocation: ${deviceInfo.location || 'Not available'}\nIP address: ${ip}\nIf this was not you, secure your account: ${getAccountsUrl('/forgot-password')}`,
    { preheader: 'Review a recent sign-in to your LetBuyy account.', reason: 'This is a security notification about activity on your LetBuyy account.', category: 'security' })
}

export async function sendNewDeviceLoginEmail(email: string, deviceInfo: { device: string; ip: string; location?: string }, timestamp: Date = new Date()) {
  return sendEmail({ to: email, ...newDeviceLoginEmail(deviceInfo, timestamp) })
}

export function passwordChangedEmail(timestamp: Date = new Date()): RenderedEmailMessage {
  const time = formattedTime(timestamp)
  return message('Your LetBuyy password was changed',
    eyebrow('Account security') + heading('Your password was changed') + paragraph(`Your LetBuyy merchant account password was changed on ${escapeHtml(time)}.`) +
    paragraph('If you made this change, no action is needed. If you did not, reset your password immediately and contact support.') +
    ctaRow([ctaButton(getAccountsUrl('/forgot-password'), 'Secure your account')]),
    `Your LetBuyy merchant password was changed on ${time}.\nIf this was not you, reset your password immediately: ${getAccountsUrl('/forgot-password')}`,
    { preheader: 'A password change was completed for your LetBuyy account.', reason: 'This is a security notification about a password change.', category: 'security' })
}

export async function sendPasswordChangedEmail(email: string, timestamp: Date = new Date()) { return sendEmail({ to: email, ...passwordChangedEmail(timestamp) }) }
