import { LetbuyyApiError } from '@letbuyy/api-client';
import { createPlatformOperationsApiClient } from './client';

export type EmployeeAnalytics = {
    total_stores: number;
    total_orders: number;
    total_users: number;
};

type ApiLoadResult<T> = {
    data?: T;
    error?: string;
};

function normalizeApiError(error: unknown, fallback: string) {
    if (error instanceof LetbuyyApiError) {
        return error.message || fallback;
    }

    return error instanceof Error ? error.message : fallback;
}

export async function loadEmployeeAnalytics(): Promise<ApiLoadResult<EmployeeAnalytics>> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const data = await api.requestData<EmployeeAnalytics>('/employees/analytics');
        return { data };
    } catch (error) {
        return { error: normalizeApiError(error, 'Employee analytics unavailable') };
    }
}

export async function probeTicketInfrastructure(): Promise<ApiLoadResult<{ available: boolean }>> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        await api.requestData<unknown>('/employees/tickets');
        return { data: { available: true } };
    } catch (error) {
        return { error: normalizeApiError(error, 'Support ticket infrastructure is not configured') };
    }
}
