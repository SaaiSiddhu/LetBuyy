import Link from 'next/link'
import { Check } from '@letbuyy/ui'

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-zinc-50 py-20 dark:bg-zinc-950">
            <div className="mx-auto max-w-6xl px-4">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
                        Simple, transparent pricing
                    </h1>
                    <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
                        Start free. Scale as you grow.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                    <PricingCard
                        plan="Free"
                        price="$0"
                        period="/mo"
                        features={["1 site", "10 products", "LetBuyy subdomain", "2% transaction fee"]}
                        cta="Get Started"
                        href="/signup"
                        popular={false}
                    />
                    <PricingCard
                        plan="Starter"
                        price="$9"
                        period="/mo"
                        features={["3 sites", "100 products", "Custom domain", "1% transaction fee", "Email support"]}
                        cta="Start Trial"
                        href="/signup?plan=starter"
                        popular={false}
                    />
                    <PricingCard
                        plan="Business"
                        price="$29"
                        period="/mo"
                        features={["10 sites", "1,000 products", "Custom domain", "0% transaction fee", "Priority support", "Analytics"]}
                        cta="Start Trial"
                        href="/signup?plan=business"
                        popular={true}
                    />
                    <PricingCard
                        plan="Enterprise"
                        price="$99"
                        period="/mo"
                        features={["Unlimited sites", "Unlimited products", "Custom domain", "0% transaction fee", "Dedicated support", "White-label", "API access"]}
                        cta="Contact Sales"
                        href="mailto:sales@letbuyy.store"
                        popular={false}
                    />
                </div>
            </div>
        </div>
    );
}

function PricingCard({
    plan,
    price,
    period,
    features,
    cta,
    href,
    popular,
}: {
    plan: string;
    price: string;
    period: string;
    features: string[];
    cta: string;
    href: string;
    popular: boolean;
}) {
    return (
        <div
            className={`relative rounded-2xl border p-8 ${popular
                ? "border-blue-500 bg-white shadow-lg dark:bg-zinc-900"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
        >
            {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                    Most Popular
                </span>
            )}
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{plan}</h3>
            <div className="mt-4">
                <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{price}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{period}</span>
            </div>
            <ul className="mt-6 space-y-3">
                {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        {feature}
                    </li>
                ))}
            </ul>
            <Link
                href={href}
                className={`mt-8 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
            >
                {cta}
            </Link>
        </div>
    );
}
