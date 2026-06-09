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
type PillTone = 'success' | 'warning' | 'critical' | 'info';

export function ConsoleWorkspace(props: WorkspaceCopy) {
    return <InternalWorkspace {...props} />;
}

export function MetricGrid({ children }: { children: ReactNode }) {
    return <InternalMetricGrid>{children}</InternalMetricGrid>;
}

export function LeadershipMetric({
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
    action,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    return <InternalPanel title={title} description={description} action={action}>{children}</InternalPanel>;
}

export function ModuleGrid({ children }: { children: ReactNode }) {
    return <InternalModuleGrid density="leadership">{children}</InternalModuleGrid>;
}

export function ModuleCard({
    title,
    description,
    href,
    status,
    details,
}: {
    title: string;
    description: string;
    href: string;
    status: string;
    details: string;
}) {
    return <InternalModuleCard title={title} description={description} href={href} status={status} detail={details} />;
}

export function StatusPill({ value, tone }: { value: string; tone?: PillTone }) {
    return <InternalStatusPill value={value} tone={tone} />;
}

export function SkipBackendPanel({
    title,
    children,
}: {
    title: string;
    contract: string;
    children: ReactNode;
}) {
    return <InternalSkipBackendPanel title={title}>{children}</InternalSkipBackendPanel>;
}

export function EmptyDataState({ message }: { message: string }) {
    return <InternalEmptyDataState message={message} />;
}
