/**
 * Urban Kicks — Dynamic Checkout Page Component
 * 
 * Re-exports the shared checkout page since it already handles
 * all payment methods (Razorpay, Stripe, PayPal, COD) and order creation.
 * Visual customization comes from CSS theme variables.
 */

export { default } from '@/app/store/[subdomain]/checkout/page';
