// Transitional import facade for existing Gateway callers. The single implementation lives
// in notification-core so Identity, Gateway and Queue can share it without runtime imports.
export * from '@letbuyy/notification-core/email';
