function getApiBaseUrl(): string {
    const configuredUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.letbuyy.store/v1').replace(/\/$/, '')

    try {
        const url = new URL(configuredUrl)
        const path = url.pathname.replace(/\/$/, '')

        if (path === '' || path === '/') {
            url.pathname = '/v1'
            return url.toString().replace(/\/$/, '')
        }

        if (!path.endsWith('/v1')) {
            url.pathname = `${path}/v1`
            return url.toString().replace(/\/$/, '')
        }
    } catch {
        if (!configuredUrl.endsWith('/v1')) {
            return `${configuredUrl}/v1`
        }
    }

    return configuredUrl
}

export async function apiFetch<T = unknown>(
    path: string,
    token: string,
    options?: RequestInit
): Promise<{ data?: T; error?: { code: string; message: string } }> {
    try {
        const res = await fetch(`${getApiBaseUrl()}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...options?.headers,
            },
        })
        const json = await res.json()
        if (!res.ok) {
            return { error: json.error || { code: 'API_ERROR', message: res.statusText } }
        }
        return { data: json.data ?? json }
    } catch (e) {
        return { error: { code: 'NETWORK_ERROR', message: (e as Error).message } }
    }
}
