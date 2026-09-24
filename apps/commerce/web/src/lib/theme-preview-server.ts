import 'server-only';
import { cookies } from 'next/headers';
import { getThemePreviewCookieName, normalizeThemePreviewToken } from './theme-preview-cookie';

export async function resolveThemePreviewToken(
    subdomain: string,
    explicitToken?: unknown,
): Promise<string> {
    const token = normalizeThemePreviewToken(explicitToken);
    if (token) return token;

    const cookieStore = await cookies();
    return normalizeThemePreviewToken(cookieStore.get(getThemePreviewCookieName(subdomain))?.value);
}
