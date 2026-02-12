const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.letbuyy.store'

export async function apiFetch<T = unknown>(
    path: string,
    token: string,
    options?: RequestInit
): Promise<{ data?: T; error?: { code: string; message: string } }> {
    try {
        const res = await fetch(`${API_URL}${path}`, {
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
