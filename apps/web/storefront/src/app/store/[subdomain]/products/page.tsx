export default function StorefrontProductsPage() {
    return (
        <div className="mx-auto max-w-7xl px-4 py-12">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">All Products</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Browse our collection</p>

            {/* TODO: Product grid with filtering, sorting, pagination */}
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Product cards will be rendered here */}
            </div>
        </div>
    );
}
