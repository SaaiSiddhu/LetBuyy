'use client'

import { useParams } from 'next/navigation'

interface StubPageProps {
    title: string
    description: string
    icon: string
}

export default function StubPage({ title, description, icon }: StubPageProps) {
    const { store } = useParams<{ store: string }>()

    return (
        <div className="p-8">
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-6">
                    <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-500" style={{ fontSize: '40px' }}>
                        {icon}
                    </span>
                </div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{title}</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-8">
                    {description}
                </p>
                <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-600">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>construction</span>
                    Coming soon for <span className="font-medium">{store}</span>
                </div>
            </div>
        </div>
    )
}
