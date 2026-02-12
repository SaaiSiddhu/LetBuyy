// Root page - placeholder for Cloud Run health checks
// Storefronts are ONLY accessible via subdomains: {store}.letbuyy.store
// Landing page is at letbuyy.store (store-builder-web static)
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white">
      <h1 className="text-3xl font-bold mb-4">LetBuyy Storefronts</h1>
      <p className="text-zinc-400 mb-6">Access stores via subdomain:</p>
      <div className="text-sm text-zinc-500 space-y-2">
        <p><code className="bg-zinc-800 px-2 py-1 rounded">yourstore.letbuyy.store</code></p>
      </div>
      <a
        href="https://letbuyy.store"
        className="mt-8 text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        ← Back to LetBuyy
      </a>
    </div>
  );
}

