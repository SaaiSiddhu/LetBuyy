'use client'

import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

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
                        <MaterialIcon name={icon} size={32} />
                    </div>
                </div>

                {/* Title & description */}
                <h1 className="stub-page-title">{title}</h1>
                <p className="stub-page-description">{description}</p>

                {/* Coming soon badge */}
                <div className="stub-page-badge">
                    <MaterialIcon name="schedule" size={14} />
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
