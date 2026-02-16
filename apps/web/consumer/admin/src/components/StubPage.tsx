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
        <div className="stub-page">
            <div className="stub-page-inner">
                {/* Icon container with gradient */}
                <div className="stub-page-icon-ring">
                    <div className="stub-page-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
                            {icon}
                        </span>
                    </div>
                </div>

                {/* Title & description */}
                <h1 className="stub-page-title">{title}</h1>
                <p className="stub-page-description">{description}</p>

                {/* Coming soon badge */}
                <div className="stub-page-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
                    Coming Soon
                </div>

                {/* Store context */}
                <p className="stub-page-store">
                    This feature is being built for <strong>{store}</strong>
                </p>
            </div>
        </div>
    )
}
