import { Badge } from '@letbuyy/ui';

export function RiskBadge() {
    return (
        <>
            <Badge label="Blocked" variant="critical" />
            <Badge label="Failed" variant={'critical'} />
        </>
    );
}
