import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/order-service';
import { OrderItem, OrderCustomer, OrderPricing } from '@/types/store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            storeId,
            sellerId,
            subdomain,
            customer,
            items,
            pricing,
            paymentMethod,
            razorpayOrderId,
            razorpayPaymentId,
            stripeSessionId,
            paypalOrderId,
        } = body;

        // Validate required fields
        if (!storeId || !sellerId || !subdomain || !customer || !items || !pricing) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const order = await createOrder({
            storeId,
            sellerId,
            subdomain,
            customer: customer as OrderCustomer,
            items: items as OrderItem[],
            pricing: pricing as OrderPricing,
            paymentMethod: paymentMethod || 'razorpay',
            razorpayOrderId,
            razorpayPaymentId,
            stripeSessionId,
            paypalOrderId,
        });

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                total: order.pricing.total,
            }
        });

    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
