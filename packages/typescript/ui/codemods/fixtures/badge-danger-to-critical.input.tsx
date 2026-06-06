import { Badge } from '@letbuyy/ui';

export function RiskBadge() {
    return (
        <>
            <Badge label="Blocked" variant="danger" />
            <Badge label="Failed" variant={'danger'} />
        </>
    );
}
