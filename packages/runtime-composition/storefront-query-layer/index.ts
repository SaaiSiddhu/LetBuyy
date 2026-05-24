import type { CartItem, OrderModel } from '@letbuyy/checkout-core';
import type { ProductModel } from '@letbuyy/commerce-core';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { StoreTemplateConfig } from '@letbuyy/theme-engine';
import type { RuntimeProjection } from '../src/projection';
import { executeRuntimeAggregation, type RuntimeQueryContext } from '../src/query-runtime';

export interface StorefrontQueryLayerInput {
  subdomain: string;
  path: string;
  previewToken?: string;
  customerId?: string;
}

export interface StorefrontProjection {
  store: StoreModel;
  template: StoreTemplateConfig;
  products?: ProductModel[];
  cart?: CartItem[];
  order?: OrderModel;
  content?: Record<string, unknown>;
}

export type StorefrontRuntimeProjection = RuntimeProjection<StorefrontProjection>;

export interface StorefrontRuntimeLoaders {
  loadStore(input: StorefrontQueryLayerInput): Promise<StoreModel | null>;
  loadTemplate(store: StoreModel, input: StorefrontQueryLayerInput): Promise<StoreTemplateConfig>;
  loadProducts?(store: StoreModel, input: StorefrontQueryLayerInput): Promise<ProductModel[]>;
  loadContent?(store: StoreModel, input: StorefrontQueryLayerInput): Promise<Record<string, unknown> | undefined>;
}

interface StorefrontAggregationState {
  input: StorefrontQueryLayerInput;
  store: StoreModel | null;
  template: StoreTemplateConfig | null;
  products?: ProductModel[];
  content?: Record<string, unknown>;
}

export async function composeStorefrontRuntimeProjection(
  input: StorefrontQueryLayerInput,
  context: RuntimeQueryContext,
  loaders: StorefrontRuntimeLoaders,
): Promise<StorefrontRuntimeProjection | null> {
  const projection = await executeRuntimeAggregation<StorefrontAggregationState, StorefrontProjection>({
    name: 'storefront.runtime-projection',
    version: '1.0.0',
    steps: [
      {
        name: 'load-store',
        execute: async (state) => ({
          ...state,
          store: await loaders.loadStore(state.input),
        }),
      },
      {
        name: 'load-template',
        execute: async (state) => ({
          ...state,
          template: state.store ? await loaders.loadTemplate(state.store, state.input) : null,
        }),
      },
      {
        name: 'load-products',
        execute: async (state) => ({
          ...state,
          products: state.store && loaders.loadProducts ? await loaders.loadProducts(state.store, state.input) : undefined,
        }),
      },
      {
        name: 'load-content',
        execute: async (state) => ({
          ...state,
          content: state.store && loaders.loadContent ? await loaders.loadContent(state.store, state.input) : undefined,
        }),
      },
    ],
    project: (state) => ({
      projectionName: 'storefront.runtime-projection',
      projectionVersion: 1,
      cachePolicy: {
        key: `storefront:${input.subdomain}:${input.path}:${input.previewToken ? 'preview' : 'published'}`,
        tenantScoped: true,
        ttlSeconds: input.previewToken ? 0 : 60,
        staleWhileRevalidateSeconds: input.previewToken ? 0 : 300,
        tags: [
          `store:${state.store?.id || input.subdomain}`,
          `route:${input.path}`,
          input.previewToken ? 'preview:theme' : 'published:theme',
        ],
      },
      data: {
        store: state.store as StoreModel,
        template: state.template as StoreTemplateConfig,
        products: state.products,
        content: state.content,
      },
    }),
  }, { input, store: null, template: null }, context);

  return projection.data.store && projection.data.template ? projection : null;
}
