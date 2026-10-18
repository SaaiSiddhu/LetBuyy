// ============================================================
// ORDER SERVICE — Storefront read/customer helpers.
// Order creation and payment mutation flows are owned by the Hono worker.
// ============================================================

import type { OrderModel, OrderStatus } from '@letbuyy/checkout-core';

// ============================================================
// ORDER RETRIEVAL
// ============================================================

export async function getOrderById(orderId: string): Promise<OrderModel | null> {
    void orderId;
    throw new Error('Direct order lookup requires a store-scoped worker endpoint');
}

export async function getSellerOrders(
    sellerId: string,
    status?: OrderStatus
): Promise<OrderModel[]> {
    void sellerId;
    void status;
    throw new Error('Seller order reads must use the authenticated admin worker API');
}

// ============================================================
// CUSTOMER AUTHENTICATION
// ============================================================

export async function checkCustomerExists(emailOrPhone: string): Promise<boolean> {
    void emailOrPhone;
    throw new Error('Customer existence checks require a store-scoped worker endpoint');
}
