/** Explicit synthetic catalog-preview data. Never seed installed themes, real stock or merchants. */
import { ElectronicsFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/circuit/v2/';
const productId = (n: number) => `c1c01700-1000-4000-8000-${String(n).padStart(12, '0')}`;
const variantId = (n: number) => `c1c01700-2000-4000-8000-${String(n).padStart(12, '0')}`;
const collectionId = (n: number) => `c1c01700-3000-4000-8000-${String(n).padStart(12, '0')}`;
const sheet = (reference: string) => ({ reference, source_date: '2026-10-22' });

export const CIRCUIT_DEMO_PRODUCTS: ProductModel[] = [
  {
    id: productId(1), name: 'CG-7 USB-C hub', description: 'Seven-port hub with distinct host, data, display and power roles. Fictional demonstration product, not for sale.', price: 3490, currency: 'INR', stock: 4, isActive: true, category: 'Connect', images: [media + 'cg7-hub.webp'],
    variantOptions: [{ name: 'Finish', values: ['Graphite', 'Silver'] }], variants: [{ id: variantId(1), name: 'Graphite', sku: 'NW-CG7-GR', price: 3490, stock: 4, options: { Finish: 'Graphite' } }, { id: variantId(2), name: 'Silver', sku: 'NW-CG7-SI', price: 3490, stock: 0, options: { Finish: 'Silver' } }],
    electronics: ElectronicsFactsSchema.parse({ manufacturer: 'Nodeworks', model: 'CG-7', kind: 'hub', power_input_w: 100, pass_through_output_w: 85, data_rate_mbps: 5000, length_mm: 100, video: { width_px: 3840, height_px: 2160, refresh_hz: 30 }, dimensions_mm: { length: 115, width: 43, height: 15 }, connectors: [{ kind: 'usb-c', role: 'host', count: 1 }, { kind: 'usb-c', role: 'power-input', count: 1 }, { kind: 'usb-c', role: 'data', count: 1 }, { kind: 'usb-a', role: 'data', count: 2 }, { kind: 'hdmi', role: 'video', count: 1 }, { kind: 'sd', role: 'card-reader', count: 1 }, { kind: 'microsd', role: 'card-reader', count: 1 }], host_requirements: ['USB-C host with data support.', 'DisplayPort Alt Mode is required for HDMI output.', 'Host must support USB Power Delivery input for laptop charging.'], box_contents: [{ label: 'CG-7 Graphite hub with captive USB-C host cable (100 mm)', quantity: 1 }, { label: 'Printed quick-start guide', quantity: 1 }], fact_sheet: sheet('NW-CG7-F1'), compatible_devices: [], notes: 'Charger, display cable, memory cards and laptop are not included. Maxima are merchant-stated fixture facts, not guaranteed simultaneous output.' }),
  },
  {
    id: productId(2), name: 'CG-5 USB-C hub', description: 'A separate five-port model with a lower data-transfer maximum. Fictional demonstration product, not for sale.', price: 2490, currency: 'INR', stock: 4, isActive: true, category: 'Connect', images: [media + 'cg5-hub.webp'],
    variantOptions: [{ name: 'Finish', values: ['Silver'] }], variants: [{ id: variantId(3), name: 'Silver', sku: 'NW-CG5-SI', price: 2490, stock: 4, options: { Finish: 'Silver' } }],
    electronics: ElectronicsFactsSchema.parse({ manufacturer: 'Nodeworks', model: 'CG-5', kind: 'hub', power_input_w: 65, data_rate_mbps: 480, length_mm: 100, video: { width_px: 3840, height_px: 2160, refresh_hz: 30 }, connectors: [{ kind: 'usb-c', role: 'host', count: 1 }, { kind: 'usb-c', role: 'power-input', count: 1 }, { kind: 'usb-c', role: 'data', count: 1 }, { kind: 'usb-a', role: 'data', count: 2 }, { kind: 'hdmi', role: 'video', count: 1 }], host_requirements: ['DisplayPort Alt Mode is required for HDMI output.'], box_contents: [{ label: 'CG-5 Silver hub with captive USB-C host cable (100 mm)', quantity: 1 }], compatible_devices: [], notes: 'Laptop pass-through output has not been supplied. The 65 W input must not be presented as laptop output.' }),
  },
  {
    id: productId(3), name: 'CH-65 dual USB-C charger', description: 'Independent dual USB-C charger fixture. Fictional demonstration product, not for sale.', price: 1890, currency: 'INR', stock: 5, isActive: true, category: 'Charge', images: [media + 'ch65-charger.webp'],
    variantOptions: [{ name: 'Plug', values: ['IN two-pin'] }], variants: [{ id: variantId(4), name: 'Graphite / IN two-pin', sku: 'NW-CH65-IN-GR', price: 1890, stock: 5, options: { Plug: 'IN two-pin' } }],
    electronics: ElectronicsFactsSchema.parse({ manufacturer: 'Nodeworks', model: 'CH-65', kind: 'charger', power_output_w: 65, connectors: [{ kind: 'usb-c', role: 'power-output', count: 2 }, { kind: 'ac-plug', role: 'power-input', count: 1 }], box_contents: [{ label: 'CH-65 Graphite charger, IN two-pin plug', quantity: 1 }], fact_sheet: sheet('NW-CH65-F1'), notes: '65 W is total output. Power split depends on connected devices. Cable not included. Device compatibility is unconfirmed.' }),
  },
  {
    id: productId(4), name: 'CL-100 USB-C cable · 1 m', description: 'A separately sold one-metre cable. Fictional demonstration product, not for sale.', price: 690, currency: 'INR', stock: 10, isActive: true, category: 'Charge', images: [media + 'cl100-cable.webp'],
    variantOptions: [{ name: 'Length', values: ['1 m'] }, { name: 'Finish', values: ['Graphite'] }], variants: [{ id: variantId(5), name: '1 m / Graphite', sku: 'NW-CL100-1M-GR', price: 690, stock: 10, options: { Length: '1 m', Finish: 'Graphite' } }],
    electronics: ElectronicsFactsSchema.parse({ manufacturer: 'Nodeworks', model: 'CL-100', kind: 'cable', power_capacity_w: 100, data_rate_mbps: 480, length_mm: 1000, connectors: [{ kind: 'usb-c', role: 'data', count: 2 }], box_contents: [{ label: 'CL-100 Graphite USB-C to USB-C cable, 1 m', quantity: 1 }], notes: 'USB 2.0 data. No video capability is claimed. Cable capacity is not a charger output or a laptop charging guarantee.' }),
  },
];

export const CIRCUIT_DEMO_COLLECTIONS = [
  { id: collectionId(1), title: 'Charge', handle: 'charge', description: 'Chargers and cables · fictional preview', image_url: media + 'ch65-charger.webp', product_count: 2 },
  { id: collectionId(2), title: 'Connect', handle: 'connect', description: 'Hubs and adapters · fictional preview', image_url: media + 'cg7-hub.webp', product_count: 2 },
  { id: collectionId(3), title: 'Listen', handle: 'listen', description: 'Empty-category recovery example · fictional preview', image_url: '', product_count: 0 },
  { id: collectionId(4), title: 'Work', handle: 'work', description: 'Empty-category recovery example · fictional preview', image_url: '', product_count: 0 },
];

/** Explicit synthetic collection membership; absent keys never mean the whole catalog. */
export const CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  [collectionId(1)]: [productId(3), productId(4)],
  [collectionId(2)]: [productId(1), productId(2)],
  [collectionId(3)]: [],
  [collectionId(4)]: [],
};

export function circuitDemoNavigation(basePath = '/store/urban-kicks-demo'): StoreNavigation {
  return { main: [{ id: 'circuit-demo-connect', label: 'Connect', href: `${basePath}/products?category=Connect`, isDefault: false, isVisible: true }, { id: 'circuit-demo-charge', label: 'Charge', href: `${basePath}/products?category=Charge`, isDefault: false, isVisible: true }, { id: 'circuit-demo-specs', label: 'Compatibility guide', href: `${basePath}/product/${productId(1)}#circuit-specifications`, isDefault: false, isVisible: true }], footer: [{ id: 'circuit-demo-products', label: 'Browse accessories', href: `${basePath}/products`, isDefault: false, isVisible: true }], policies: [] };
}
export const CIRCUIT_DEMO_NAVIGATION = circuitDemoNavigation();

/** Apply only to an explicitly selected Circuit v2 synthetic preview, never installation defaults. */
export function withCircuitDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const parsed = LiquidThemePackageBundleSchema.safeParse(input.liquidBundle);
  if (!parsed.success || parsed.data.package.slug !== 'letbuyy-forge' || parsed.data.package.version !== '2.0.0') return input;
  const bundle = structuredClone(parsed.data);
  for (const instance of Object.values(bundle.templates.index.sections)) {
    if (instance.type === 'category-grid') Object.assign(instance.settings, { collection1: collectionId(1), collection2: collectionId(2), collection3: collectionId(3), collection4: collectionId(4) });
    if (instance.type === 'hero-banner') Object.assign(instance.settings, { image: media + 'cg7-hub.webp', product1: productId(1), eyebrow: 'Featured model / CG-7', heading: 'A clearer connection for your desk.', subheading: 'One USB-C host. Seven useful ports. Check the exact host features before choosing.' });
    if (instance.type === 'trust-badges') Object.assign(instance.settings, { shippingText: 'Available shipping rates are checked at checkout. No delivery date is supplied in this demonstration.', returnsText: 'Contact the merchant for the applicable product return terms. No automatic approval is promised.', supportText: 'Bring the exact product and device model. Do not share your password or account codes.' });
  }
  for (const instance of Object.values(bundle.templates.product.sections)) if (instance.type === 'featured-products') Object.assign(instance.settings, { product1: productId(2), product2: productId(3), product3: productId(4) });
  return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
