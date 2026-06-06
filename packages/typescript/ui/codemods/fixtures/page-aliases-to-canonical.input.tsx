import { PageActions, PageShell, TableFilterBar } from '@letbuyy/ui';

export function AliasSurface() {
    return (
        <PageShell title="Orders">
            <PageActions>Save</PageActions>
            <TableFilterBar search="Search" />
        </PageShell>
    );
}
