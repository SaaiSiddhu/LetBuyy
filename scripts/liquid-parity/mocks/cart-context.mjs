// S1/W4 render-parity harness — a minimal stand-in for @/context/cart-context.
// The real hook requires a mounted <CartProvider> that fetches server cart state over the network.
// An isolated section render has no cart to bind to; an empty/no-op cart is the honest value — this
// harness is checking settings-driven content (headings, links, images), not live cart state.
export function useCart() {
  return {
    items: [],
    addToCart() {},
    removeFromCart() {},
    updateQuantity() {},
    clearCart() {},
    cartTotal: 0,
    cartCount: 0,
    isOpen: false,
    setIsOpen() {},
  };
}
export function CartProvider({ children }) {
  return children;
}
