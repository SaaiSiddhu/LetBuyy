import type { ReactNode } from 'react';
import {
    InternalEmptyDataState,
    InternalMetric,
    InternalMetricGrid,
    InternalModuleCard,
    InternalModuleGrid,
    InternalPanel,
    InternalSkipBackendPanel,
    InternalStatusPill,
    InternalWorkspace,
} from '@letbuyy/ui';

type WorkspaceCopy = {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
};

type MetricTone = 'neutral' | 'success' | 'warning' | 'critical';

export function OpsWorkspace(props: WorkspaceCopy) {
    return <InternalWorkspace {...props} />;
}

export function MetricGrid({ children }: { children: ReactNode }) {
    return <InternalMetricGrid>{children}</InternalMetricGrid>;
}

export function OpsMetric({
    label,
    value,
    detail,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    detail?: string;
    tone?: MetricTone;
}) {
    return <InternalMetric label={label} value={value} detail={detail} tone={tone} />;
}

export function Panel({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return <InternalPanel title={title} description={description}>{children}</InternalPanel>;
}

export function ModuleGrid({ children }: { children: ReactNode }) {
    return <InternalModuleGrid density="operations">{children}</InternalModuleGrid>;
}

export function ModuleCard({
    title,
    description,
    href,
    status,
    detail,
}: {
    title: string;
    description: string;
    href: string;
    status: string;
    detail: string;
}) {
    return (
        <InternalModuleCard
            title={title}
            description={description}
            href={href}
            status={status}
            detail={detail}
            defaultStatusTone="warning"
        />
    );
}

export function StatusPill({ value }: { value: string }) {
    return <InternalStatusPill value={value} defaultTone="warning" />;
}

export function SkipBackendPanel({
    title,
    contract,
    children,
}: {
    title: string;
    contract: string;
    children: ReactNode;
}) {
    return <InternalSkipBackendPanel title={title} contract={contract}>{children}</InternalSkipBackendPanel>;
}

export function EmptyDataState({ message }: { message: string }) {
    return <InternalEmptyDataState message={message} />;
}
