/** Identify the one expected Gateway rejection that the reset form can safely explain. */
export function isInvalidCustomerResetError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object'
        && 'status' in error && error.status === 400
        && 'code' in error && error.code === 'INVALID_RESET_TOKEN');
}
