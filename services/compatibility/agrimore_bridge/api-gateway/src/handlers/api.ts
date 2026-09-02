import { jsonResponse, HttpError } from '../runtime/errors';
import type { Env, RequestContext } from '../runtime/types';
import { forwardToUpstream } from '../upstream/forward';
import { hyperdriveRows } from '../upstream/hyperdrive';
import {
  invokeEdgeFunction,
  supabaseDelete,
  supabaseInsert,
  supabaseRpc,
  supabaseSelect,
  supabaseUpdate,
} from '../upstream/supabase';

type JsonObject = Record<string, unknown>;

type CartSnapshotItem = {
  readonly variantId: string;
  readonly productId: string | null;
  readonly quantity: number;
};

type CartSnapshot = {
  readonly id: string | null;
  readonly userId: string;
  readonly storeId: string | null;
  readonly items: readonly CartSnapshotItem[];
  readonly updatedAt: string;
};

export async function handleApiRequest(request: Request, env: Env, context: RequestContext): Promise<Response> {
  switch (context.route.policy.path) {
    case '/v1/catalog/categories':
      return ok({ categories: await getCategories(env, context) });
    case '/v1/catalog/home-feed':
      return ok(await getHomeFeed(request, env, context));
    case '/v1/catalog/products/:id':
      return ok({ product: await getProductDetail(request, env, context) });
    case '/v1/catalog/search':
      return ok({ products: await searchProducts(request, env, context) });
    case '/v1/catalog/recent-views':
      return ok({ products: await getRecentViews(env, context) });
    case '/v1/catalog/recent-views/:productId':
      return ok(await addRecentView(env, context));
    case '/v1/serviceability/public-zones':
      return ok({ zones: await getPublicZones(env, context) });
    case '/v1/me':
      return ok({ profile: await getProfile(env, context) });
    case '/v1/cart':
      if (request.method === 'GET') {
        return ok({ cart: await getCart(env, context) });
      }
      await clearCart(env, context);
      return ok({ success: true });
    case '/v1/cart/items':
      return ok({ cart: await upsertCartItem(request, env, context) });
    case '/v1/cart/items/:productId':
      return ok({ cart: await removeCartItem(env, context) });
    case '/v1/orders':
      if (request.method === 'POST') {
        return ok(await placeOrder(request, env, context));
      }
      return ok({ orders: await listOrders(request, env, context) });
    case '/v1/orders/:id':
      return ok(await getOrderDetail(env, context));
    case '/v1/orders/:id/cancel':
      return ok(await cancelOrder(request, env, context));
    case '/v1/addresses':
      if (request.method === 'POST') {
        return ok({ address: await createAddress(request, env, context) });
      }
      return ok({ addresses: await listAddresses(env, context) });
    case '/v1/addresses/:id':
      if (request.method === 'PUT') {
        return ok({ address: await updateAddress(request, env, context) });
      }
      await deleteAddress(env, context);
      return ok({ success: true });
    case '/v1/addresses/serviceability':
      return ok(await checkAddressServiceability(request, env, context));
    case '/v1/wallet':
      return ok(await getWallet(env, context));
    case '/v1/rider/profile':
      return ok({ profile: await getRiderProfile(env, context) });
    case '/v1/rider/status':
      return ok({ profile: await updateRiderStatus(request, env, context) });
    case '/v1/rider/deliveries':
      return ok({ deliveries: await listRiderDeliveries(request, env, context) });
    case '/v1/rider/deliveries/:id/accept':
      return ok(await acceptRiderDelivery(env, context));
    case '/v1/rider/deliveries/:id/status':
      return ok(await updateDeliveryStatus(request, env, context));
    case '/v1/rider/deliveries/:id/proof':
      return ok(await createProofUpload(request, env, context));
    case '/v1/rider/earnings':
      return ok(await getRiderEarnings(request, env, context));
    case '/v1/store/queue':
      return ok({ orders: await getStoreQueue(request, env, context) });
    case '/v1/store/orders/:id/picklist':
      return ok(await getStorePicklist(env, context));
    case '/v1/store/orders/:id/pick':
      return ok(await markStoreOrderPicking(request, env, context));
    case '/v1/store/orders/:id/pack':
      return ok(await markStoreOrderPacking(request, env, context));
    case '/v1/store/orders/:id/items/:itemId/confirm':
      return ok(await confirmPickedItem(request, env, context));
    case '/v1/store/orders/:id/ready':
      return ok(await markStoreOrderReady(request, env, context));
    case '/v1/store/inventory':
      return ok({ inventory: await getStoreInventory(request, env, context) });
    case '/v1/store/inventory/adjust':
      return ok(await adjustStoreInventory(request, env, context));
    case '/v1/seller/profile':
      return ok(await getSellerProfile(env, context));
    case '/v1/seller/onboarding':
      return ok(await submitSellerOnboarding(request, env, context));
    case '/v1/seller/catalog/products':
      if (request.method === 'POST') {
        return ok(await createSellerProduct(request, env, context));
      }
      return ok({ products: await listSellerProducts(env, context) });
    case '/v1/seller/catalog/products/:id':
      return ok(await updateSellerProduct(request, env, context));
    case '/v1/seller/orders':
      return ok({ orders: await listSellerOrders(request, env, context) });
    case '/v1/seller/payouts':
      return ok(await getSellerPayouts(env, context));
    case '/v1/seller/analytics':
      return ok(await getSellerAnalytics(env, context));
    case '/v1/admin/sellers/:sellerId/approve':
      return ok(await approveSeller(request, env, context));
    case '/v1/payments/create-order':
      return ok(await createRazorpayOrder(request, env));
    case '/v1/payments/webhook':
    case '/v1/webhooks/razorpay':
      return ok(await handleRazorpayWebhook(request, env, context));
    case '/v1/notifications/register-token':
      return ok({ device: await registerNotificationToken(request, env, context) });
    case '/v1/notifications':
      return ok({ notifications: await listNotifications(request, env, context) });
    case '/v1/ops/summary':
      return ok(await getOperationsSummary(request, env, context));
    case '/v1/ops/dispatch/control':
      return ok(await executeDispatchControl(request, env, context));
    default:
      return forwardToUpstream(request, env, context);
  }
}

async function getCategories(env: Env, context: RequestContext): Promise<unknown> {
  const hyperdrive = await hyperdriveRows(env, `
    select id, parent_id, name, slug, icon_url, sort_order, is_active, created_at, updated_at
    from catalog.categories
    where is_active = true
    order by sort_order asc, name asc
  `);
  if (hyperdrive) {
    return hyperdrive;
  }

  return supabaseSelect(env, context, 'catalog', 'categories', {
    select: 'id,parent_id,name,slug,icon_url,sort_order,is_active,created_at,updated_at',
    is_active: 'eq.true',
    order: 'sort_order.asc,name.asc',
  });
}

async function getHomeFeed(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const storeId = requireCatalogStoreId(request);
  const shelves = await supabaseSelect(env, context, 'catalog', 'home_feed_shelves', {
    select: '*',
    is_active: 'eq.true',
    store_id: `eq.${storeId}`,
    order: 'sort_order.asc',
    limit: 20,
  });
  const categories = await getCategories(env, context);
  const featuredProducts = await getStoreScopedProducts(env, context, storeId, { limit: 12 });
  return { shelves, categories, featuredProducts, banners: [] };
}

async function getProductDetail(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const id = context.route.params.id;
  const storeId = requireCatalogStoreId(request);
  const hyperdriveProduct = await hyperdriveRows<JsonObject>(env, `
    select *
    from catalog.products
    where id = $1 and is_active = true
    limit 1
  `, [id]);
  const product = hyperdriveProduct?.[0] ?? await supabaseSelect<JsonObject | null>(env, context, 'catalog', 'products', {
    select: '*',
    id: `eq.${id}`,
    is_active: 'eq.true',
  }, { maybeSingle: true });
  if (!product) {
    throw new HttpError(404, 'catalog.product_not_found', 'Product was not found.');
  }
  const variants = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'product_variants', {
    select: '*',
    product_id: `eq.${id}`,
    is_active: 'eq.true',
    order: 'created_at.asc',
  });
  const media = await supabaseSelect(env, context, 'catalog', 'product_media', {
    select: '*',
    product_id: `eq.${id}`,
    order: 'sort_order.asc',
  });
  const variantIds = variants.map((variant) => stringField(variant, 'id')).filter(isString);
  const inventory = variantIds.length === 0
    ? []
    : await supabaseSelect(env, context, 'commerce', 'inventory_items', {
        select: '*',
        store_id: `eq.${storeId}`,
        variant_id: `in.(${variantIds.join(',')})`,
        is_listed: 'eq.true',
      });
  return { ...product, variants, media, inventory };
}

async function searchProducts(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const storeId = requireCatalogStoreId(request);
  if (!query) {
    return [];
  }
  if (env.TYPESENSE_HOST && env.TYPESENSE_API_KEY) {
    const typesenseUrl = new URL(`/collections/products/documents/search`, env.TYPESENSE_HOST);
    typesenseUrl.searchParams.set('q', query);
    typesenseUrl.searchParams.set('query_by', 'name,description,category_name');
    if (storeId) {
      typesenseUrl.searchParams.set('filter_by', `store_ids:=${storeId}`);
    }
    const response = await fetch(typesenseUrl.toString(), {
      headers: { 'x-typesense-api-key': env.TYPESENSE_API_KEY },
    });
    if (response.ok) {
      const payload = (await response.json()) as { hits?: readonly { document: unknown }[] };
      return payload.hits?.map((hit) => hit.document) ?? [];
    }
  }

  return getStoreScopedProducts(env, context, storeId, { query, limit: 20 });
}

async function getRecentViews(env: Env, context: RequestContext): Promise<unknown> {
  const ids = await env.RECENT_VIEWS_KV?.get(recentViewsKey(context), 'json') as readonly string[] | null | undefined;
  if (!ids?.length) {
    return [];
  }
  return supabaseSelect(env, context, 'catalog', 'products', {
    select: '*',
    id: `in.(${ids.join(',')})`,
    is_active: 'eq.true',
  });
}

async function addRecentView(env: Env, context: RequestContext): Promise<JsonObject> {
  requireUser(context);
  const productId = context.route.params.productId;
  const key = recentViewsKey(context);
  const existing = (await env.RECENT_VIEWS_KV?.get(key, 'json') as readonly string[] | null | undefined) ?? [];
  const next = [productId, ...existing.filter((id) => id !== productId)].slice(0, 20);
  await env.RECENT_VIEWS_KV?.put(key, JSON.stringify(next), { expirationTtl: 60 * 60 * 24 * 90 });
  return { success: true, productId };
}

async function getPublicZones(env: Env, context: RequestContext): Promise<unknown> {
  return supabaseSelect(env, context, 'ops', 'service_zones', {
    select: 'id,city_id,name,is_active,created_at,updated_at',
    is_active: 'eq.true',
  });
}

async function getProfile(env: Env, context: RequestContext): Promise<unknown> {
  const userId = requireUser(context);
  const profile = await supabaseSelect<JsonObject | null>(env, context, 'app', 'profiles', {
    select: '*',
    id: `eq.${userId}`,
  }, { maybeSingle: true });
  if (!profile) {
    throw new HttpError(404, 'profile.not_found', 'Profile was not found.');
  }
  const roles = await supabaseSelect(env, context, 'app', 'user_roles', {
    select: 'role,scope_city_id,scope_store_id,granted_at',
    user_id: `eq.${userId}`,
    revoked_at: 'is.null',
  });
  return { ...profile, roles };
}

async function getCart(env: Env, context: RequestContext): Promise<CartSnapshot> {
  const userId = requireUser(context);
  const cached = await env.CART_KV?.get(cartKey(userId), 'json') as CartSnapshot | null | undefined;
  if (cached) {
    return cached;
  }

  const snapshot = await readPersistentCart(env, context, userId);
  await cacheCart(env, snapshot);
  return snapshot;
}

async function upsertCartItem(request: Request, env: Env, context: RequestContext): Promise<CartSnapshot> {
  const userId = requireUser(context);
  const body = await readJson<JsonObject>(request);
  const variantId = stringField(body, 'variant_id') ?? stringField(body, 'variantId') ?? stringField(body, 'product_id') ?? stringField(body, 'productId');
  const quantity = numberField(body, 'quantity', 1);
  if (!variantId || quantity <= 0) {
    throw new HttpError(400, 'cart.invalid_item', 'variant_id and positive quantity are required.');
  }

  const cart = await ensureActiveCart(env, context, userId, stringField(body, 'store_id') ?? stringField(body, 'storeId'));
  const existing = await supabaseSelect<JsonObject | null>(env, context, 'commerce', 'cart_items', {
    select: 'cart_id,variant_id,quantity,added_at,updated_at',
    cart_id: `eq.${cart.id}`,
    variant_id: `eq.${variantId}`,
  }, { maybeSingle: true });
  if (existing) {
    await supabaseUpdate(env, context, 'commerce', 'cart_items', {
      cart_id: `eq.${cart.id}`,
      variant_id: `eq.${variantId}`,
    }, { quantity });
  } else {
    await supabaseInsert(env, context, 'commerce', 'cart_items', {
      cart_id: cart.id,
      variant_id: variantId,
      quantity,
    });
  }

  const snapshot = await readPersistentCart(env, context, userId);
  await cacheCart(env, snapshot);
  return snapshot;
}

async function removeCartItem(env: Env, context: RequestContext): Promise<CartSnapshot> {
  const userId = requireUser(context);
  const variantId = context.route.params.productId;
  const cart = await readActiveCart(env, context, userId);
  if (cart?.id) {
    await supabaseDelete(env, context, 'commerce', 'cart_items', {
      cart_id: `eq.${cart.id}`,
      variant_id: `eq.${variantId}`,
    });
  }
  const snapshot = await readPersistentCart(env, context, userId);
  await cacheCart(env, snapshot);
  return snapshot;
}

async function clearCart(env: Env, context: RequestContext): Promise<void> {
  const userId = requireUser(context);
  const cart = await readActiveCart(env, context, userId);
  if (cart?.id) {
    await supabaseDelete(env, context, 'commerce', 'cart_items', {
      cart_id: `eq.${cart.id}`,
    });
  }
  await cacheCart(env, emptyCart(userId, cart));
}

async function placeOrder(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  const response = await invokeEdgeFunction(env, context, 'checkout-submit', body, { serviceRole: true });
  await clearCart(env, context);
  return response;
}

async function listOrders(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const userId = requireUser(context);
  const url = new URL(request.url);
  const adminAll = isAdmin(context) && url.searchParams.get('scope') === 'all';
  return supabaseSelect(env, context, 'commerce', 'orders', {
    select: '*',
    ...(adminAll ? {} : { user_id: `eq.${userId}` }),
    order: 'created_at.desc',
    limit: Number.parseInt(url.searchParams.get('limit') ?? '20', 10),
  });
}

async function getOrderDetail(env: Env, context: RequestContext): Promise<JsonObject> {
  const userId = requireUser(context);
  const orderId = context.route.params.id;
  const order = await supabaseSelect<JsonObject | null>(env, context, 'commerce', 'orders', {
    select: '*',
    id: `eq.${orderId}`,
    ...(isAdmin(context) ? {} : { user_id: `eq.${userId}` }),
  }, { maybeSingle: true });
  if (!order) {
    throw new HttpError(404, 'order.not_found', 'Order was not found.');
  }
  const items = await supabaseSelect(env, context, 'commerce', 'order_items', {
    select: '*',
    order_id: `eq.${orderId}`,
  });
  const delivery = await supabaseSelect(env, context, 'logistics', 'deliveries', {
    select: '*',
    order_id: `eq.${orderId}`,
  });
  const timeline = await supabaseSelect(env, context, 'commerce', 'order_status_events', {
    select: '*',
    order_id: `eq.${orderId}`,
    order: 'created_at.asc',
  });
  return { order, items, delivery, timeline };
}

async function cancelOrder(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  return invokeEdgeFunction(env, context, 'cancel-order', {
    ...(await readJson<JsonObject>(request)),
    order_id: context.route.params.id,
  }, { serviceRole: true });
}

async function listAddresses(env: Env, context: RequestContext): Promise<unknown> {
  return supabaseSelect(env, context, 'app', 'addresses', {
    select: '*',
    user_id: `eq.${requireUser(context)}`,
    order: 'is_default.desc,created_at.desc',
  });
}

async function createAddress(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = normalizeAddressBody(await readJson<JsonObject>(request), requireUser(context));
  return supabaseInsert(env, context, 'app', 'addresses', body);
}

async function updateAddress(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = normalizeAddressBody(await readJson<JsonObject>(request), requireUser(context), false);
  return supabaseUpdate(env, context, 'app', 'addresses', {
    id: `eq.${context.route.params.id}`,
    user_id: `eq.${requireUser(context)}`,
  }, body);
}

async function deleteAddress(env: Env, context: RequestContext): Promise<unknown> {
  return supabaseDelete(env, context, 'app', 'addresses', {
    id: `eq.${context.route.params.id}`,
    user_id: `eq.${requireUser(context)}`,
  });
}

async function checkAddressServiceability(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const body = await readJson<JsonObject>(request);
  const latitude = requiredNumber(body, 'latitude');
  const longitude = requiredNumber(body, 'longitude');
  const result = await supabaseRpc(env, context, 'ops', 'find_serviceable_store', {
    p_location: point(longitude, latitude),
    p_city_id: stringField(body, 'city_id') ?? null,
  });
  const rows = Array.isArray(result) ? result : [];
  return { serviceable: rows.length > 0, store: rows[0] ?? null };
}

async function getWallet(env: Env, context: RequestContext): Promise<JsonObject> {
  const userId = requireUser(context);
  const account = await supabaseSelect(env, context, 'commerce', 'wallet_accounts', {
    select: '*',
    user_id: `eq.${userId}`,
  }, { maybeSingle: true });
  const transactions = await supabaseSelect(env, context, 'commerce', 'ledger_entries', {
    select: '*',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: 20,
  });
  return { account, transactions };
}

async function getRiderProfile(env: Env, context: RequestContext): Promise<unknown> {
  return supabaseSelect(env, context, 'logistics', 'rider_profiles', {
    select: '*',
    user_id: `eq.${requireUser(context)}`,
  }, { maybeSingle: true });
}

async function updateRiderStatus(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  const status = body.online === true ? 'available' : stringField(body, 'status') ?? 'offline';
  return supabaseUpdate(env, context, 'logistics', 'rider_profiles', {
    user_id: `eq.${requireUser(context)}`,
  }, { status });
}

async function listRiderDeliveries(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  return supabaseSelect(env, context, 'logistics', 'deliveries', {
    select: '*',
    rider_id: `eq.${requireUser(context)}`,
    ...(status ? { status: `eq.${status}` } : {}),
    order: 'created_at.desc',
    limit: 50,
  });
}

async function acceptRiderDelivery(env: Env, context: RequestContext): Promise<unknown> {
  return invokeEdgeFunction(env, context, 'assign-rider', {
    delivery_id: context.route.params.id,
    accept: true,
  }, { serviceRole: true });
}

async function updateDeliveryStatus(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  const status = stringField(body, 'status');
  if (!status) {
    throw new HttpError(400, 'delivery.status_required', 'Delivery status is required.');
  }
  return supabaseUpdate(env, context, 'logistics', 'deliveries', {
    id: `eq.${context.route.params.id}`,
    rider_id: `eq.${requireUser(context)}`,
  }, { status });
}

async function createProofUpload(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const body = await readJson<JsonObject>(request);
  const contentType = stringField(body, 'content_type') ?? 'image/jpeg';
  if (env.MEDIA_GATEWAY_URL && env.MEDIA_SIGNING_SECRET) {
    const key = `delivery-proofs/${context.route.params.id}/${crypto.randomUUID()}.jpg`;
    const token = await signMediaUploadToken({
      key,
      contentType,
      purpose: 'delivery-proof',
      expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
    }, env.MEDIA_SIGNING_SECRET);
    return {
      key,
      uploadUrl: `${env.MEDIA_GATEWAY_URL.replace(/\/+$/, '')}/v1/media/upload/${token}`,
      contentType,
    };
  }
  if (!env.PROOF_UPLOADS) {
    return {
      success: false,
      skipped: true,
      reason: 'R2 proof upload bucket is not configured.',
      requiredEnv: ['PROOF_UPLOADS'],
    };
  }
  const key = `delivery-proofs/${context.route.params.id}/${crypto.randomUUID()}.jpg`;
  const uploadUrl = `${new URL(request.url).origin}/v1/rider/deliveries/${context.route.params.id}/proof/${encodeURIComponent(key)}`;
  return { key, uploadUrl, contentType };
}

async function getRiderEarnings(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') ?? 'today';
  const deliveries = await supabaseSelect(env, context, 'logistics', 'deliveries', {
    select: 'id,order_id,status,delivered_at,created_at',
    rider_id: `eq.${requireUser(context)}`,
    status: 'eq.delivered',
    order: 'delivered_at.desc',
    limit: 100,
  });
  return { period, totalEarnings: 0, totalOrders: Array.isArray(deliveries) ? deliveries.length : 0, deliveries };
}

async function getStoreQueue(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const storeId = await requireStoreId(request, env, context);
  return supabaseSelect(env, context, 'commerce', 'orders', {
    select: '*',
    store_id: `eq.${storeId}`,
    status: 'in.(confirmed,picking,packing,ready_for_pickup)',
    order: 'created_at.asc',
    limit: 50,
  });
}

async function getStorePicklist(env: Env, context: RequestContext): Promise<JsonObject> {
  const orderId = context.route.params.id;
  const order = await supabaseSelect<JsonObject | null>(env, context, 'commerce', 'orders', {
    select: '*',
    id: `eq.${orderId}`,
  }, { maybeSingle: true });
  if (!order) {
    throw new HttpError(404, 'store.order_not_found', 'Order was not found.');
  }
  const items = await supabaseSelect(env, context, 'commerce', 'order_items', {
    select: '*',
    order_id: `eq.${orderId}`,
  });
  return { order, items };
}

async function markStoreOrderPicking(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  return updateStoreOrderStatus(env, context, 'picking', body);
}

async function markStoreOrderPacking(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  return updateStoreOrderStatus(env, context, 'packing', body);
}

async function updateStoreOrderStatus(
  env: Env,
  context: RequestContext,
  status: string,
  body: JsonObject,
): Promise<unknown> {
  const expectedVersion = optionalNumber(body, 'expectedVersion');
  const update: JsonObject = { status };
  if (expectedVersion !== null) {
    update.version = expectedVersion + 1;
  }
  await supabaseInsert(env, context, 'commerce', 'order_status_events', {
    order_id: context.route.params.id,
    to_status: status,
    actor_id: context.auth?.userId,
    metadata: {
      reason: stringField(body, 'reason') ?? null,
      expected_version: expectedVersion ?? null,
    },
  });
  return supabaseUpdate(env, context, 'commerce', 'orders', {
    id: `eq.${context.route.params.id}`,
  }, update);
}

async function confirmPickedItem(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  return supabaseInsert(env, context, 'commerce', 'order_status_events', {
    order_id: context.route.params.id,
    to_status: 'picking',
    actor_id: context.auth?.userId,
    metadata: {
      item_id: context.route.params.itemId,
      picked_quantity: numberField(body, 'quantity', 1),
      confirmed: true,
    },
  });
}

async function markStoreOrderReady(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const orderId = context.route.params.id;
  await supabaseUpdate(env, context, 'commerce', 'orders', {
    id: `eq.${orderId}`,
  }, { status: 'ready_for_pickup' });
  return invokeEdgeFunction(env, context, 'assign-rider', {
    ...(await readJson<JsonObject>(request)),
    order_id: orderId,
  }, { serviceRole: true });
}

async function getStoreInventory(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const storeId = await requireStoreId(request, env, context);
  return supabaseSelect(env, context, 'commerce', 'inventory_items', {
    select: '*',
    store_id: `eq.${storeId}`,
    order: 'updated_at.desc',
    limit: 200,
  });
}

async function adjustStoreInventory(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  const storeId = stringField(body, 'store_id') ?? stringField(body, 'storeId') ?? await requireStoreId(request, env, context);
  const variantId = stringField(body, 'variant_id') ?? stringField(body, 'variantId');
  const delta = requiredNumber(body, 'delta');
  const reason = stringField(body, 'reason') ?? 'manual_adjustment';
  if (!variantId) {
    throw new HttpError(400, 'inventory.variant_required', 'variant_id is required.');
  }
  return supabaseRpc(env, context, 'commerce', 'adjust_inventory', {
    p_store_id: storeId,
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_reference_type: stringField(body, 'reference_type') ?? 'admin_adjustment',
    p_reference_id: stringField(body, 'reference_id') ?? null,
    p_actor_id: context.auth?.userId ?? null,
  }, { serviceRole: true });
}

async function getSellerProfile(env: Env, context: RequestContext): Promise<JsonObject> {
  const sellerId = requireSeller(context);
  const profile = await readSellerProfile(env, context, sellerId);
  const brandId = profile ? stringField(profile, 'brand_id') : null;
  const brand = brandId
    ? await supabaseSelect<JsonObject | null>(env, context, 'catalog', 'brands', {
        select: '*',
        id: `eq.${brandId}`,
      }, { serviceRole: true, maybeSingle: true })
    : null;
  return {
    profile,
    brand,
    onboardingRequired: !profile || stringField(profile, 'status') !== 'approved',
  };
}

async function submitSellerOnboarding(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const sellerId = requireSeller(context);
  const body = await readJson<JsonObject>(request);
  const businessName = requiredString(body, 'business_name', 'businessName');
  const brandName = stringField(body, 'brand_name') ?? stringField(body, 'brandName') ?? businessName;
  const existing = await readSellerProfile(env, context, sellerId);
  let brandId = existing ? stringField(existing, 'brand_id') : null;

  if (brandId) {
    await supabaseUpdate(env, context, 'catalog', 'brands', {
      id: `eq.${brandId}`,
      seller_user_id: `eq.${sellerId}`,
    }, {
      name: brandName,
      updated_at: new Date().toISOString(),
    }, { serviceRole: true });
  } else {
    const [brand] = await supabaseInsert<JsonObject[]>(env, context, 'catalog', 'brands', {
      name: brandName,
      slug: `${slugify(brandName)}-${sellerId.slice(0, 8)}`,
      seller_user_id: sellerId,
      is_active: false,
    }, { serviceRole: true });
    brandId = stringField(brand, 'id');
  }

  if (!brandId) {
    throw new HttpError(500, 'seller.brand_create_failed', 'Seller brand could not be created.');
  }

  const payload: JsonObject = {
    business_name: businessName,
    brand_id: brandId,
    gstin: normalizeUpper(body, 'gstin'),
    pan_last4: last4(normalizeUpper(body, 'pan') ?? normalizeUpper(body, 'pan_last4')),
    bank_account_last4: last4(stringField(body, 'bank_account') ?? stringField(body, 'bank_account_last4')),
    kyc_document_key: stringField(body, 'kyc_document_key') ?? stringField(body, 'kycDocumentKey'),
    bank_document_key: stringField(body, 'bank_document_key') ?? stringField(body, 'bankDocumentKey'),
    status: 'pending_review',
    rejection_reason: null,
  };

  if (existing) {
    await supabaseUpdate(env, context, 'catalog', 'seller_profiles', {
      user_id: `eq.${sellerId}`,
    }, payload, { serviceRole: true });
  } else {
    await supabaseInsert(env, context, 'catalog', 'seller_profiles', {
      user_id: sellerId,
      ...payload,
    }, { serviceRole: true });
  }

  return getSellerProfile(env, context);
}

async function listSellerProducts(env: Env, context: RequestContext): Promise<readonly JsonObject[]> {
  const sellerId = requireSeller(context);
  const profile = await readSellerProfile(env, context, sellerId);
  const brandId = profile ? stringField(profile, 'brand_id') : null;
  if (!brandId) {
    return [];
  }

  const products = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'products', {
    select: '*',
    brand_id: `eq.${brandId}`,
    order: 'updated_at.desc',
    limit: 200,
  }, { serviceRole: true });
  return hydrateSellerProducts(env, context, products);
}

async function createSellerProduct(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const sellerId = requireSeller(context);
  const body = await readJson<JsonObject>(request);
  const profile = await requireSellerProfile(env, context, sellerId);
  const brandId = requiredString(profile, 'brand_id');
  const categoryId = requiredString(body, 'category_id', 'categoryId');
  const productName = requiredString(body, 'name');
  const variantBody = objectField(body, 'variant');
  const sku = requiredString(variantBody, 'sku');
  const variantTitle = stringField(variantBody, 'title') ?? productName;
  const unitLabel = requiredString(variantBody, 'unit_label', 'unitLabel');
  const mrpPaise = requiredNumber(variantBody, 'mrp_paise');
  const salePricePaise = requiredNumber(variantBody, 'default_sale_price_paise');

  const [product] = await supabaseInsert<JsonObject[]>(env, context, 'catalog', 'products', {
    category_id: categoryId,
    brand_id: brandId,
    name: productName,
    slug: `${slugify(productName)}-${crypto.randomUUID().slice(0, 8)}`,
    description: stringField(body, 'description') ?? '',
    tax_code: stringField(body, 'tax_code') ?? stringField(body, 'taxCode'),
    search_keywords: arrayOfStrings(body.search_keywords ?? body.searchKeywords),
    is_active: false,
  }, { serviceRole: true });

  const productId = requiredString(product, 'id');
  const [variant] = await supabaseInsert<JsonObject[]>(env, context, 'catalog', 'product_variants', {
    product_id: productId,
    sku,
    title: variantTitle,
    unit_label: unitLabel,
    mrp: rupeesFromPaise(mrpPaise),
    default_sale_price: rupeesFromPaise(salePricePaise),
    barcode: stringField(variantBody, 'barcode'),
    weight_g: optionalNumber(variantBody, 'weight_g'),
    is_active: false,
  }, { serviceRole: true });

  const variantId = requiredString(variant, 'id');
  const mediaUrl = stringField(body, 'media_url') ?? stringField(body, 'mediaUrl');
  if (mediaUrl) {
    await supabaseInsert(env, context, 'catalog', 'product_media', {
      product_id: productId,
      url: mediaUrl,
      media_type: 'image',
      sort_order: 0,
    }, { serviceRole: true });
  }

  const availabilityRows = availabilityFromBody(body, variantId);
  if (availabilityRows.length > 0) {
    await supabaseInsert(env, context, 'commerce', 'inventory_items', availabilityRows, { serviceRole: true });
    await supabaseInsert(env, context, 'commerce', 'inventory_events', availabilityRows.map((row) => ({
      store_id: row.store_id,
      variant_id: variantId,
      event_type: 'seller.listing_requested',
      payload: { seller_id: sellerId, on_hand: row.on_hand, safety_stock: row.safety_stock },
    })), { serviceRole: true });
  }

  return {
    product,
    variant,
    availability: availabilityRows,
    reviewStatus: stringField(profile, 'status') === 'approved'
      ? 'pending_admin_approval'
      : 'seller_pending_approval',
  };
}

async function updateSellerProduct(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const sellerId = requireSeller(context);
  const body = await readJson<JsonObject>(request);
  const product = await requireSellerProduct(env, context, sellerId, context.route.params.id);
  const update: JsonObject = {};
  const name = stringField(body, 'name');
  const description = stringField(body, 'description');
  const taxCode = stringField(body, 'tax_code') ?? stringField(body, 'taxCode');
  if (name) update.name = name;
  if (description !== null) update.description = description;
  if (taxCode !== null) update.tax_code = taxCode;
  if (Object.keys(update).length === 0) {
    return { product, reviewStatus: product.is_active === true ? 'live' : 'pending_admin_approval' };
  }
  update.is_active = false;
  const [updated] = await supabaseUpdate<JsonObject[]>(env, context, 'catalog', 'products', {
    id: `eq.${context.route.params.id}`,
  }, update, { serviceRole: true });
  return { product: updated, reviewStatus: 'pending_admin_approval' };
}

async function listSellerOrders(request: Request, env: Env, context: RequestContext): Promise<readonly JsonObject[]> {
  const sellerId = requireSeller(context);
  const profile = await readSellerProfile(env, context, sellerId);
  const brandId = profile ? stringField(profile, 'brand_id') : null;
  if (!brandId) {
    return [];
  }
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const products = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'products', {
    select: 'id',
    brand_id: `eq.${brandId}`,
    limit: 500,
  }, { serviceRole: true });
  const productIds = products.map((product) => stringField(product, 'id')).filter(isString);
  if (productIds.length === 0) {
    return [];
  }
  const variants = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'product_variants', {
    select: 'id,product_id,sku,title',
    product_id: `in.(${productIds.join(',')})`,
    limit: 500,
  }, { serviceRole: true });
  const variantIds = variants.map((variant) => stringField(variant, 'id')).filter(isString);
  if (variantIds.length === 0) {
    return [];
  }
  const items = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'order_items', {
    select: '*',
    variant_id: `in.(${variantIds.join(',')})`,
    limit,
  }, { serviceRole: true });
  const orderIds = unique(items.map((item) => stringField(item, 'order_id')).filter(isString));
  if (orderIds.length === 0) {
    return [];
  }
  const orders = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'orders', {
    select: 'id,public_order_number,status,payment_status,payable_total,store_id,created_at,updated_at',
    id: `in.(${orderIds.join(',')})`,
    order: 'created_at.desc',
    limit,
  }, { serviceRole: true });
  return orders.map((order) => {
    const orderId = stringField(order, 'id');
    return {
      ...order,
      sellerItems: items.filter((item) => stringField(item, 'order_id') === orderId),
    };
  });
}

async function getSellerPayouts(env: Env, context: RequestContext): Promise<JsonObject> {
  const sellerId = requireSeller(context);
  const entries = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'ledger_entries', {
    select: '*',
    user_id: `eq.${sellerId}`,
    order: 'created_at.desc',
    limit: 100,
  }, { serviceRole: true });
  const netPaise = entries.reduce((sum, entry) => sum + Math.round(numberField(entry, 'amount', 0) * 100), 0);
  return {
    entries,
    netPayoutPaise: netPaise,
    nextSettlementAt: nextSettlementDate(),
  };
}

async function getSellerAnalytics(env: Env, context: RequestContext): Promise<JsonObject> {
  const sellerId = requireSeller(context);
  const products = await listSellerProducts(env, context);
  const orders = await listSellerOrders(new Request('https://agrimore.local/v1/seller/orders?limit=200'), env, context);
  const inventory = products.flatMap((product) => arrayOfObjects(product.availability));
  const listedStores = inventory.filter((item) => item.is_listed === true).length;
  const stockedStores = inventory.filter((item) =>
    numberField(item, 'on_hand', 0) - numberField(item, 'reserved', 0) - numberField(item, 'safety_stock', 0) > 0
  ).length;
  const gmvPaise = orders.reduce((sum, order) => sum + Math.round(numberField(order, 'payable_total', 0) * 100), 0);
  return {
    productCount: products.length,
    liveProductCount: products.filter((product) => product.is_active === true).length,
    pendingProductCount: products.filter((product) => product.is_active !== true).length,
    orderCount: orders.length,
    grossMerchandiseValuePaise: gmvPaise,
    availabilityRate: listedStores === 0 ? 0 : stockedStores / listedStores,
  };
}

async function approveSeller(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  if (!isAdmin(context)) {
    throw new HttpError(403, 'auth.permission_denied', 'Admin permission is required.');
  }
  const body = await readJson<JsonObject>(request);
  const sellerId = context.route.params.sellerId;
  const approved = body.approved !== false;
  const profile = await readSellerProfile(env, context, sellerId);
  if (!profile) {
    throw new HttpError(404, 'seller.not_found', 'Seller profile was not found.');
  }
  const brandId = stringField(profile, 'brand_id');
  if (!approved) {
    const [rejected] = await supabaseUpdate<JsonObject[]>(env, context, 'catalog', 'seller_profiles', {
      user_id: `eq.${sellerId}`,
    }, {
      status: 'rejected',
      rejection_reason: stringField(body, 'reason') ?? 'Rejected by admin review.',
      approved_by: null,
      approved_at: null,
    }, { serviceRole: true });
    return { profile: rejected, approved: false };
  }
  const [updatedProfile] = await supabaseUpdate<JsonObject[]>(env, context, 'catalog', 'seller_profiles', {
    user_id: `eq.${sellerId}`,
  }, {
    status: 'approved',
    rejection_reason: null,
    approved_by: context.auth?.userId,
    approved_at: new Date().toISOString(),
  }, { serviceRole: true });
  if (brandId) {
    await supabaseUpdate(env, context, 'catalog', 'brands', {
      id: `eq.${brandId}`,
    }, { is_active: true }, { serviceRole: true });
    const products = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'products', {
      select: 'id',
      brand_id: `eq.${brandId}`,
      limit: 500,
    }, { serviceRole: true });
    const productIds = products.map((product) => stringField(product, 'id')).filter(isString);
    if (productIds.length > 0) {
      await supabaseUpdate(env, context, 'catalog', 'products', {
        id: `in.(${productIds.join(',')})`,
      }, { is_active: true }, { serviceRole: true });
      await supabaseUpdate(env, context, 'catalog', 'product_variants', {
        product_id: `in.(${productIds.join(',')})`,
      }, { is_active: true }, { serviceRole: true });
      const variants = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'product_variants', {
        select: 'id',
        product_id: `in.(${productIds.join(',')})`,
        limit: 500,
      }, { serviceRole: true });
      const variantIds = variants.map((variant) => stringField(variant, 'id')).filter(isString);
      if (variantIds.length > 0) {
        await supabaseUpdate(env, context, 'commerce', 'inventory_items', {
          variant_id: `in.(${variantIds.join(',')})`,
        }, { is_listed: true }, { serviceRole: true });
      }
    }
  }
  return { profile: updatedProfile, approved: true };
}

async function createRazorpayOrder(request: Request, env: Env): Promise<JsonObject> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return {
      success: false,
      skipped: true,
      reason: 'Razorpay Worker secrets are not configured.',
      requiredEnv: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    };
  }
  const body = await readJson<JsonObject>(request);
  const amount = requiredNumber(body, 'amount');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: stringField(body, 'currency') ?? 'INR',
      receipt: stringField(body, 'receipt') ?? crypto.randomUUID(),
      notes: body.notes ?? {},
    }),
  });
  if (!response.ok) {
    throw new HttpError(response.status, 'payment.razorpay_order_failed', 'Razorpay order creation failed.');
  }
  return (await response.json()) as JsonObject;
}

async function handleRazorpayWebhook(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    return {
      success: false,
      skipped: true,
      reason: 'Razorpay webhook secret is not configured.',
      requiredEnv: ['RAZORPAY_WEBHOOK_SECRET'],
    };
  }
  const payload = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  const valid = await verifyWebhookHmac(payload, signature, env.RAZORPAY_WEBHOOK_SECRET);
  if (!valid) {
    throw new HttpError(401, 'payment.invalid_webhook_signature', 'Razorpay webhook signature is invalid.');
  }
  return invokeEdgeFunction(env, context, 'confirm-payment', JSON.parse(payload) as JsonObject, { serviceRole: true });
}

async function registerNotificationToken(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const body = await readJson<JsonObject>(request);
  const pushToken = stringField(body, 'push_token') ?? stringField(body, 'token');
  if (!pushToken) {
    throw new HttpError(400, 'notifications.token_required', 'push_token is required.');
  }
  return supabaseInsert(env, context, 'app', 'user_devices', {
    user_id: requireUser(context),
    platform: stringField(body, 'platform') ?? context.platform ?? 'unknown',
    push_token: pushToken,
    device_fingerprint: context.deviceId,
    app_version: context.appVersion,
    last_seen_at: new Date().toISOString(),
  });
}

async function listNotifications(request: Request, env: Env, context: RequestContext): Promise<unknown> {
  const url = new URL(request.url);
  return supabaseSelect(env, context, 'ops', 'notifications', {
    select: '*',
    user_id: `eq.${requireUser(context)}`,
    order: 'created_at.desc',
    limit: Number.parseInt(url.searchParams.get('limit') ?? '20', 10),
  });
}

async function getOperationsSummary(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const url = new URL(request.url);
  const cityId = url.searchParams.get('city_id') ?? null;
  const activeStatuses = 'in.(confirmed,picking,packing,ready_for_pickup,rider_assigned,picked_up,arriving)';
  const orders = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'orders', {
    select: 'id,status,total_amount,payable_amount,promised_eta_at,created_at,city_id,store_id',
    status: activeStatuses,
    ...(cityId ? { city_id: `eq.${cityId}` } : {}),
    order: 'created_at.desc',
    limit: 500,
  });
  const riders = await supabaseSelect<JsonObject[]>(env, context, 'logistics', 'rider_profiles', {
    select: 'id,status,city_id',
    ...(cityId ? { city_id: `eq.${cityId}` } : {}),
    limit: 500,
  });
  const inventory = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'inventory_items', {
    select: 'id,on_hand,reserved_qty,safety_stock,store_id',
    limit: 500,
  });
  const now = Date.now();
  const delayedOrders = orders.filter((order) => {
    const promised = stringField(order, 'promised_eta_at');
    return promised ? Date.parse(promised) < now : false;
  }).length;
  const availableRiders = riders.filter((rider) => stringField(rider, 'status') === 'available').length;
  const busyRiders = riders.filter((rider) => ['assigned', 'on_trip'].includes(stringField(rider, 'status') ?? '')).length;
  const stockoutCount = inventory.filter((item) => {
    const onHand = numberField(item, 'on_hand', 0);
    const reserved = numberField(item, 'reserved_qty', 0);
    const safety = numberField(item, 'safety_stock', 0);
    return onHand - reserved - safety <= 0;
  }).length;
  const gmvPaise = orders.reduce((sum, order) => {
    return sum + numberField(order, 'payable_amount', numberField(order, 'total_amount', 0));
  }, 0);
  return {
    cityId,
    activeOrders: orders.length,
    delayedOrders,
    availableRiders,
    busyRiders,
    stockoutCount,
    grossMerchandiseValuePaise: Math.round(gmvPaise),
    metrics: [
      { name: 'orders_per_minute', value: orders.length / 5, unit: 'orders/min', observedAt: new Date().toISOString() },
      { name: 'delayed_orders', value: delayedOrders, unit: 'orders', observedAt: new Date().toISOString() },
      { name: 'online_riders', value: availableRiders + busyRiders, unit: 'riders', observedAt: new Date().toISOString() },
    ],
  };
}

async function executeDispatchControl(request: Request, env: Env, context: RequestContext): Promise<JsonObject> {
  const body = await readJson<JsonObject>(request);
  const action = stringField(body, 'action') ?? 'dispatch_control';
  const reason = stringField(body, 'reason') ?? 'admin_action';
  const cityId = stringField(body, 'cityId') ?? stringField(body, 'city_id') ?? null;
  await supabaseInsert(env, context, 'ops', 'audit_logs', {
    actor_id: context.auth?.userId ?? null,
    actor_role: context.auth?.roles[0] ?? 'admin',
    action,
    entity_type: 'dispatch_control',
    entity_id: cityId,
    after_state: { action, reason, city_id: cityId },
    trace_id: context.ids.traceId,
  });
  return { action, reason, cityId, accepted: true };
}

async function getStoreScopedProducts(
  env: Env,
  context: RequestContext,
  storeId: string,
  options: { readonly query?: string; readonly limit: number },
): Promise<readonly JsonObject[]> {
  const inventory = await getAvailableInventory(env, context, storeId, 200);
  const variantIds = inventory.map((item) => stringField(item, 'variant_id')).filter(isString);
  if (variantIds.length === 0) {
    return [];
  }

  const variants = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'product_variants', {
    select: 'id,product_id,sku,title,unit_label,mrp,default_sale_price,barcode,weight_g,is_active,updated_at',
    id: `in.(${variantIds.join(',')})`,
    is_active: 'eq.true',
    limit: Math.max(variantIds.length, 1),
  });
  const productIds = unique(variants.map((variant) => stringField(variant, 'product_id')).filter(isString));
  if (productIds.length === 0) {
    return [];
  }

  const products = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'products', {
    select: 'id,category_id,brand_id,name,slug,description,tax_code,search_keywords,is_active,updated_at',
    id: `in.(${productIds.join(',')})`,
    is_active: 'eq.true',
    ...(options.query ? { or: `(name.ilike.*${escapeLike(options.query)}*,description.ilike.*${escapeLike(options.query)}*)` } : {}),
    order: 'updated_at.desc',
    limit: options.limit,
  });

  return products.map((product) => {
    const productId = stringField(product, 'id');
    const productVariants = variants.filter((variant) => stringField(variant, 'product_id') === productId);
    const productVariantIds = new Set(productVariants.map((variant) => stringField(variant, 'id')).filter(isString));
    return {
      ...product,
      variants: productVariants,
      inventory: inventory.filter((item) => productVariantIds.has(stringField(item, 'variant_id') ?? '')),
    };
  });
}

async function getAvailableInventory(
  env: Env,
  context: RequestContext,
  storeId: string,
  limit: number,
): Promise<readonly JsonObject[]> {
  const hyperdrive = await hyperdriveRows<JsonObject>(env, `
    select store_id, variant_id, on_hand, reserved, safety_stock, is_listed, updated_at
    from commerce.inventory_items
    where store_id = $1
      and is_listed = true
      and (on_hand - reserved - safety_stock) > 0
    order by updated_at desc
    limit $2
  `, [storeId, limit]);
  if (hyperdrive) {
    return hyperdrive;
  }

  const rows = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'inventory_items', {
    select: 'store_id,variant_id,on_hand,reserved,safety_stock,is_listed,updated_at',
    store_id: `eq.${storeId}`,
    is_listed: 'eq.true',
    order: 'updated_at.desc',
    limit,
  });
  return rows.filter((row) => {
    const onHand = numberField(row, 'on_hand', 0);
    const reserved = numberField(row, 'reserved', 0);
    const safetyStock = numberField(row, 'safety_stock', 0);
    return onHand - reserved - safetyStock > 0;
  });
}

async function readPersistentCart(env: Env, context: RequestContext, userId: string): Promise<CartSnapshot> {
  const cart = await readActiveCart(env, context, userId);
  if (!cart?.id) {
    return emptyCart(userId, null);
  }
  const items = await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'cart_items', {
    select: 'cart_id,variant_id,quantity,added_at,updated_at',
    cart_id: `eq.${cart.id}`,
    order: 'updated_at.desc',
  });
  return toCartSnapshot(userId, cart, items);
}

async function ensureActiveCart(
  env: Env,
  context: RequestContext,
  userId: string,
  storeId: string | null,
): Promise<JsonObject & { readonly id: string }> {
  const existing = await readActiveCart(env, context, userId);
  if (existing?.id) {
    if (storeId && stringField(existing, 'store_id') !== storeId) {
      const [updated] = await supabaseUpdate<JsonObject[]>(env, context, 'commerce', 'carts', {
        id: `eq.${existing.id}`,
      }, { store_id: storeId });
      const next = updated ?? existing;
      return { ...next, id: stringField(next, 'id') ?? existing.id };
    }
    return { ...existing, id: existing.id };
  }

  const [created] = await supabaseInsert<JsonObject[]>(env, context, 'commerce', 'carts', {
    user_id: userId,
    ...(storeId ? { store_id: storeId } : {}),
    status: 'active',
  });
  const id = stringField(created, 'id');
  if (!id) {
    throw new HttpError(500, 'cart.create_failed', 'Cart could not be created.');
  }
  return { ...created, id };
}

async function readActiveCart(
  env: Env,
  context: RequestContext,
  userId: string,
): Promise<(JsonObject & { readonly id: string }) | null> {
  const cart = await supabaseSelect<JsonObject | null>(env, context, 'commerce', 'carts', {
    select: '*',
    user_id: `eq.${userId}`,
    status: 'eq.active',
    order: 'updated_at.desc',
    limit: 1,
  }, { maybeSingle: true });
  const id = cart ? stringField(cart, 'id') : null;
  return cart && id ? { ...cart, id } : null;
}

async function cacheCart(env: Env, cart: CartSnapshot): Promise<void> {
  await env.CART_KV?.put(cartKey(cart.userId), JSON.stringify(cart), { expirationTtl: 60 * 60 * 24 * 14 });
}

function emptyCart(userId: string, cart: JsonObject | null): CartSnapshot {
  return {
    id: cart ? stringField(cart, 'id') : null,
    userId,
    storeId: cart ? stringField(cart, 'store_id') : null,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

function toCartSnapshot(userId: string, cart: JsonObject, items: readonly JsonObject[]): CartSnapshot {
  return {
    id: stringField(cart, 'id'),
    userId,
    storeId: stringField(cart, 'store_id'),
    updatedAt: stringField(cart, 'updated_at') ?? new Date().toISOString(),
    items: items.map((item) => ({
      variantId: stringField(item, 'variant_id') ?? '',
      productId: null,
      quantity: numberField(item, 'quantity', 0),
    })).filter((item) => item.variantId && item.quantity > 0),
  };
}

function requireCatalogStoreId(request: Request): string {
  const storeId = new URL(request.url).searchParams.get('store_id');
  if (!storeId) {
    throw new HttpError(400, 'catalog.store_scope_required', 'store_id is required for catalog reads.');
  }
  return storeId;
}

async function requireStoreId(request: Request, env: Env, context: RequestContext): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('store_id');
  if (fromQuery) {
    return fromQuery;
  }
  const role = await supabaseSelect<JsonObject | null>(env, context, 'app', 'user_roles', {
    select: 'scope_store_id',
    user_id: `eq.${requireUser(context)}`,
    role: 'eq.store_operator',
    revoked_at: 'is.null',
    limit: 1,
  }, { maybeSingle: true });
  const storeId = typeof role?.scope_store_id === 'string' ? role.scope_store_id : null;
  if (!storeId) {
    throw new HttpError(403, 'store.scope_required', 'A store scope is required.');
  }
  return storeId;
}

async function readSellerProfile(env: Env, context: RequestContext, sellerId: string): Promise<JsonObject | null> {
  return supabaseSelect<JsonObject | null>(env, context, 'catalog', 'seller_profiles', {
    select: '*',
    user_id: `eq.${sellerId}`,
  }, { serviceRole: true, maybeSingle: true });
}

async function requireSellerProfile(env: Env, context: RequestContext, sellerId: string): Promise<JsonObject> {
  const profile = await readSellerProfile(env, context, sellerId);
  if (!profile || !stringField(profile, 'brand_id')) {
    throw new HttpError(409, 'seller.onboarding_required', 'Seller onboarding must be submitted before catalog changes.');
  }
  return profile;
}

async function requireSellerProduct(
  env: Env,
  context: RequestContext,
  sellerId: string,
  productId: string,
): Promise<JsonObject> {
  const profile = await requireSellerProfile(env, context, sellerId);
  const brandId = requiredString(profile, 'brand_id');
  const product = await supabaseSelect<JsonObject | null>(env, context, 'catalog', 'products', {
    select: '*',
    id: `eq.${productId}`,
    brand_id: `eq.${brandId}`,
  }, { serviceRole: true, maybeSingle: true });
  if (!product) {
    throw new HttpError(404, 'seller.product_not_found', 'Seller product was not found.');
  }
  return product;
}

async function hydrateSellerProducts(
  env: Env,
  context: RequestContext,
  products: readonly JsonObject[],
): Promise<readonly JsonObject[]> {
  const productIds = products.map((product) => stringField(product, 'id')).filter(isString);
  if (productIds.length === 0) {
    return [];
  }
  const variants = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'product_variants', {
    select: '*',
    product_id: `in.(${productIds.join(',')})`,
    order: 'updated_at.desc',
    limit: 500,
  }, { serviceRole: true });
  const media = await supabaseSelect<JsonObject[]>(env, context, 'catalog', 'product_media', {
    select: '*',
    product_id: `in.(${productIds.join(',')})`,
    order: 'sort_order.asc',
    limit: 500,
  }, { serviceRole: true });
  const variantIds = variants.map((variant) => stringField(variant, 'id')).filter(isString);
  const inventory = variantIds.length === 0
    ? []
    : await supabaseSelect<JsonObject[]>(env, context, 'commerce', 'inventory_items', {
        select: '*',
        variant_id: `in.(${variantIds.join(',')})`,
        order: 'updated_at.desc',
        limit: 1000,
      }, { serviceRole: true });

  return products.map((product) => {
    const productId = stringField(product, 'id');
    const productVariants = variants.filter((variant) => stringField(variant, 'product_id') === productId);
    const productVariantIds = new Set(productVariants.map((variant) => stringField(variant, 'id')).filter(isString));
    return {
      ...product,
      variants: productVariants,
      media: media.filter((item) => stringField(item, 'product_id') === productId),
      availability: inventory.filter((item) => productVariantIds.has(stringField(item, 'variant_id') ?? '')),
      reviewStatus: product.is_active === true ? 'live' : 'pending_admin_approval',
    };
  });
}

function normalizeAddressBody(body: JsonObject, userId: string, includeRequired = true): JsonObject {
  const latitude = includeRequired ? requiredNumber(body, 'latitude') : optionalNumber(body, 'latitude');
  const longitude = includeRequired ? requiredNumber(body, 'longitude') : optionalNumber(body, 'longitude');
  const normalized: JsonObject = {
    user_id: userId,
    label: stringField(body, 'label') ?? 'Home',
    line1: stringField(body, 'line1') ?? stringField(body, 'address_line1') ?? '',
    line2: stringField(body, 'line2') ?? stringField(body, 'address_line2'),
    city: stringField(body, 'city') ?? '',
    state: stringField(body, 'state') ?? '',
    postal_code: stringField(body, 'postal_code') ?? stringField(body, 'postalCode') ?? '',
    is_default: body.is_default === true || body.isDefault === true,
  };
  if (latitude !== null && longitude !== null) {
    normalized.location = point(longitude, latitude);
  }
  return normalized;
}

async function readJson<T extends JsonObject>(request: Request): Promise<T> {
  try {
    const body = (await request.clone().json()) as JsonObject;
    return (isObject(body.payload) ? body.payload : body) as T;
  } catch {
    return {} as T;
  }
}

function ok(payload: unknown, init: ResponseInit = {}): Response {
  if (isObject(payload) && 'success' in payload) {
    return jsonResponse(payload, init);
  }
  return jsonResponse({ success: true, data: payload }, init);
}

function requireUser(context: RequestContext): string {
  if (!context.auth?.userId) {
    throw new HttpError(401, 'auth.unauthenticated', 'Authentication is required.');
  }
  return context.auth.userId;
}

function requireSeller(context: RequestContext): string {
  const userId = requireUser(context);
  if (!context.auth?.roles.includes('seller')) {
    throw new HttpError(403, 'auth.permission_denied', 'Seller permission is required.');
  }
  return userId;
}

function isAdmin(context: RequestContext): boolean {
  return context.auth?.roles.some((role) => role === 'admin' || role === 'super_admin') ?? false;
}

function cartKey(userId: string): string {
  return `cart:${userId}`;
}

function recentViewsKey(context: RequestContext): string {
  return `recent:${requireUser(context)}`;
}

function stringField(body: JsonObject, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredString(body: JsonObject, key: string, fallbackKey?: string): string {
  const value = stringField(body, key) ?? (fallbackKey ? stringField(body, fallbackKey) : null);
  if (!value) {
    throw new HttpError(400, 'request.string_required', `${key} is required.`);
  }
  return value;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function numberField(body: JsonObject, key: string, fallback: number): number {
  const value = body[key];
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(number) ? number : fallback;
}

function requiredNumber(body: JsonObject, key: string): number {
  const value = optionalNumber(body, key);
  if (value === null) {
    throw new HttpError(400, 'request.number_required', `${key} must be a number.`);
  }
  return value;
}

function optionalNumber(body: JsonObject, key: string): number | null {
  const value = body[key];
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function objectField(body: JsonObject, key: string): JsonObject {
  const value = body[key];
  return isObject(value) ? value : {};
}

function arrayOfObjects(value: unknown): readonly JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function arrayOfStrings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function availabilityFromBody(body: JsonObject, variantId: string): JsonObject[] {
  const entries = arrayOfObjects(body.store_availability ?? body.storeAvailability ?? body.availability);
  const fallbackStoreId = stringField(body, 'store_id') ?? stringField(body, 'storeId');
  const rows = entries.length > 0
    ? entries
    : fallbackStoreId
      ? [{ store_id: fallbackStoreId, on_hand: numberField(body, 'on_hand', 0), safety_stock: numberField(body, 'safety_stock', 0) }]
      : [];
  return rows.map((entry) => ({
    store_id: requiredString(entry, 'store_id', 'storeId'),
    variant_id: variantId,
    on_hand: Math.max(0, Math.trunc(numberField(entry, 'on_hand', 0))),
    reserved: 0,
    safety_stock: Math.max(0, Math.trunc(numberField(entry, 'safety_stock', 0))),
    is_listed: false,
  }));
}

function normalizeUpper(body: JsonObject, key: string): string | null {
  return stringField(body, key)?.replaceAll(/\s+/g, '').toUpperCase() ?? null;
}

function last4(value: string | null): string | null {
  return value && value.length >= 4 ? value.slice(-4).toUpperCase() : value;
}

function rupeesFromPaise(value: number): number {
  return Number((value / 100).toFixed(2));
}

function nextSettlementDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 15);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function point(longitude: number, latitude: number): string {
  return `POINT(${longitude} ${latitude})`;
}

function escapeLike(value: string): string {
  return value.replaceAll('*', '').replaceAll('%', '').replaceAll(',', ' ');
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'seller-brand';
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function verifyWebhookHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, signature);
}

async function signMediaUploadToken(
  payload: { readonly key: string; readonly contentType: string; readonly purpose: string; readonly expiresAt: number },
  secret: string,
): Promise<string> {
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
