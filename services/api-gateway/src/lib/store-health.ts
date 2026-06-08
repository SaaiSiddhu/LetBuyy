export type StoreHealthPillarStatus = 'ready' | 'attention' | 'blocked' | 'unknown';

export type StoreHealthPillar = {
    id: string;
    label: string;
    score: number;
    status: StoreHealthPillarStatus;
    summary: string;
    action_label?: string | null;
    route?: string | null;
    metrics?: Record<string, unknown>;
};

function healthStatus(score: number): StoreHealthPillarStatus {
    if (score >= 85) return 'ready';
    if (score >= 50) return 'attention';
    return 'blocked';
}

export function healthPillar(
    input: Omit<StoreHealthPillar, 'status'> & { status?: StoreHealthPillarStatus },
): StoreHealthPillar {
    return {
        ...input,
        score: Math.max(0, Math.min(100, Math.round(input.score))),
        status: input.status || healthStatus(input.score),
        metrics: input.metrics || {},
    };
}
