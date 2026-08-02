import { redirect } from 'next/navigation'
import { getAccountsUrl } from '@/lib/public-urls'

/**
 * The marketing site does not handle auth — sign-up lives in the accounts app.
 *
 * This used to be a client component that set `window.location` from an effect,
 * which meant crawlers saw a spinner page with no content and no redirect
 * signal. A server redirect returns a real 307 instead, so the URL is followed
 * rather than indexed as a thin page.
 */
export default function SignupPage(): never {
    redirect(getAccountsUrl('/signup'))
}
