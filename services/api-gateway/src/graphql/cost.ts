export interface GraphQLCostInput {
  query: string;
  variables?: Record<string, unknown> | null;
  surface: 'admin' | 'storefront';
}

const CONNECTION_FIELDS = [
  'products',
  'orders',
  'customers',
  'collections',
  'inventoryLevels',
  'themes',
  'marketplaceApps',
  'installedApps',
  'pages',
  'policies',
  'blogPosts',
  'reviews',
  'bulkOperations',
] as const;

const HEAVY_ADMIN_FIELDS = [
  'analyticsDashboard',
  'formSubmissions',
  'shippingRates',
  'taxRates',
] as const;

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length;
}

function compactDocument(query: string): string {
  return query
    .replace(/#[^\n\r]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readLimitFromVariables(variables: Record<string, unknown> | null | undefined, fieldName: string): number {
  const directFirst = numericValue(variables?.first);
  if (directFirst !== null) return directFirst;

  const fieldVariables = recordValue(variables?.[fieldName]);
  const nestedFirst = numericValue(fieldVariables?.first);
  if (nestedFirst !== null) return nestedFirst;

  const connection = recordValue(variables?.connection);
  const connectionFirst = numericValue(connection?.first);
  if (connectionFirst !== null) return connectionFirst;

  return 20;
}

function readLimitFromDocument(document: string, fieldName: string): number | null {
  const match = new RegExp(`\\b${fieldName}\\s*\\([^)]*\\bfirst\\s*:\\s*(\\d+)`, 'i').exec(document);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasField(document: string, fieldName: string): boolean {
  return new RegExp(`\\b${fieldName}\\b`).test(document);
}

export function calculateGraphQLQueryCost(input: GraphQLCostInput): number {
  const document = compactDocument(input.query);
  if (!document) return 1;

  let cost = input.surface === 'admin' ? 2 : 1;
  const selectedFieldCount = countMatches(document, /\b[a-zA-Z_][a-zA-Z0-9_]*\s*(?:\(|\{)/g);
  cost += Math.ceil(selectedFieldCount / 8);

  if (/\bmutation\b/i.test(document)) cost += 15;
  if (/\bbulkOperationRunQuery\b/.test(document)) cost += 25;
  if (/\bbulkOperationRunMutation\b/.test(document)) cost += 50;

  for (const fieldName of CONNECTION_FIELDS) {
    if (!hasField(document, fieldName)) continue;
    const limit = readLimitFromDocument(document, fieldName)
      ?? readLimitFromVariables(input.variables, fieldName);
    cost += 2 + Math.max(0, Math.ceil(Math.min(limit, 250) / 50) - 1);
  }

  for (const fieldName of HEAVY_ADMIN_FIELDS) {
    if (hasField(document, fieldName)) cost += 15;
  }

  if (/\b(include|expand|nodes|edges)\b/.test(document)) cost += 2;

  return Math.max(1, Math.min(cost, 250));
}
