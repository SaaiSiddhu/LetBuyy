/**
 * Urban Kicks — Dynamic Cart Page Component
 * 
 * Re-exports the shared cart page component.
 * The cart page is fully client-side and reads from CartContext,
 * so no theme-specific customization is needed at the data level.
 * The theme CSS variables handle visual customization.
 */

// The cart page is a client component that uses CartContext
// It's identical across themes — visual differences come from CSS variables
export { default } from '@/app/store/[subdomain]/cart/page';
