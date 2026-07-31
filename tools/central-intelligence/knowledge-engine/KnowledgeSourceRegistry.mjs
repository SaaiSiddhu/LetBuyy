/**
 * KnowledgeSourceRegistry — canonical registry of external documentation sources
 * that the LCIS Knowledge Engine crawls. Crawl4AI is a hidden implementation detail.
 */

const SOURCES = [
  {
    key: 'cloudflare',
    name: 'Cloudflare Developer Platform',
    collection: 'knowledge',
    refreshIntervalHours: 168,
    maxPages: 200,
    urls: [
      'https://developers.cloudflare.com/workers/',
      'https://developers.cloudflare.com/workers/runtime-apis/',
      'https://developers.cloudflare.com/queues/',
      'https://developers.cloudflare.com/queues/configuration/',
      'https://developers.cloudflare.com/kv/',
      'https://developers.cloudflare.com/kv/api/',
      'https://developers.cloudflare.com/r2/',
      'https://developers.cloudflare.com/r2/api/s3/api/',
      'https://developers.cloudflare.com/hyperdrive/',
      'https://developers.cloudflare.com/analytics/analytics-engine/',
    ],
  },
  {
    key: 'vercel',
    name: 'Vercel Platform',
    collection: 'knowledge',
    refreshIntervalHours: 168,
    maxPages: 150,
    urls: [
      'https://vercel.com/docs/deployments/overview',
      'https://vercel.com/docs/edge-network/overview',
      'https://vercel.com/docs/functions/serverless-functions',
      'https://vercel.com/docs/functions/edge-functions',
      'https://vercel.com/docs/storage/vercel-blob',
      'https://vercel.com/docs/environment-variables',
      'https://vercel.com/docs/deployments/build-step',
    ],
  },
  {
    key: 'supabase',
    name: 'Supabase',
    collection: 'knowledge',
    refreshIntervalHours: 72,
    maxPages: 200,
    urls: [
      'https://supabase.com/docs/guides/database/overview',
      'https://supabase.com/docs/guides/auth/row-level-security',
      'https://supabase.com/docs/guides/database/postgres/triggers',
      'https://supabase.com/docs/guides/database/functions',
      'https://supabase.com/docs/guides/auth',
      'https://supabase.com/docs/guides/auth/managing-user-data',
      'https://supabase.com/docs/reference/javascript/introduction',
      'https://supabase.com/docs/guides/realtime',
    ],
  },
  {
    key: 'nextjs',
    name: 'Next.js',
    collection: 'knowledge',
    refreshIntervalHours: 168,
    maxPages: 200,
    urls: [
      'https://nextjs.org/docs/app/building-your-application/routing',
      'https://nextjs.org/docs/app/building-your-application/data-fetching',
      'https://nextjs.org/docs/app/building-your-application/caching',
      'https://nextjs.org/docs/app/building-your-application/rendering',
      'https://nextjs.org/docs/app/api-reference/file-conventions/middleware',
      'https://nextjs.org/docs/app/building-your-application/deploying',
    ],
  },
  {
    key: 'opentelemetry',
    name: 'OpenTelemetry',
    collection: 'knowledge',
    refreshIntervalHours: 336,
    maxPages: 80,
    urls: [
      'https://opentelemetry.io/docs/what-is-opentelemetry/',
      'https://opentelemetry.io/docs/languages/js/',
      'https://opentelemetry.io/docs/languages/js/instrumentation/',
      'https://opentelemetry.io/docs/concepts/signals/traces/',
      'https://opentelemetry.io/docs/concepts/signals/metrics/',
      'https://opentelemetry.io/docs/collector/',
    ],
  },
  {
    key: 'security',
    name: 'Security Advisories',
    collection: 'security',
    refreshIntervalHours: 24,
    maxPages: 100,
    urls: [
      'https://github.com/advisories?query=type%3Areviewed+ecosystem%3Anpm',
      'https://github.com/advisories?query=type%3Areviewed+ecosystem%3Anpm+severity%3Acritical',
      'https://www.npmjs.com/advisories',
    ],
  },
];

class KnowledgeSourceRegistry {
  /** @returns {Array<object>} all registered source configs */
  getSources() {
    return SOURCES.map((s) => ({ ...s }));
  }

  /**
   * @param {string} key
   * @returns {object|null}
   */
  getSource(key) {
    return SOURCES.find((s) => s.key === key) ?? null;
  }

  /**
   * Register a new source at runtime (does not persist across restarts).
   * @param {{key:string,name:string,urls:string[],maxPages:number,refreshIntervalHours:number,collection:string}} config
   */
  registerSource(config) {
    const required = ['key', 'name', 'urls', 'maxPages', 'refreshIntervalHours', 'collection'];
    for (const field of required) {
      if (config[field] == null) throw new Error(`registerSource: missing required field '${field}'`);
    }
    if (this.getSource(config.key)) {
      throw new Error(`registerSource: source key '${config.key}' already registered`);
    }
    SOURCES.push({ ...config });
  }

  /** @returns {string[]} keys of all registered sources */
  getActiveSourceKeys() {
    return SOURCES.map((s) => s.key);
  }
}

export default new KnowledgeSourceRegistry();
