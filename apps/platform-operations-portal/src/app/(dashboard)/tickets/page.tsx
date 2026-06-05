import { EmployeeModuleScreen } from '@/components/_local-ui/employee-module-screen';
import { loadEmployeeAnalytics, probeTicketInfrastructure } from '@/lib/api/employee-modules';

export default async function TicketsPage() {
    const [analytics, tickets] = await Promise.all([
        loadEmployeeAnalytics(),
        probeTicketInfrastructure(),
    ]);

    return (
        <EmployeeModuleScreen
            moduleKey="tickets"
            analytics={analytics.data}
            analyticsError={tickets.error || analytics.error}
        />
    );
}
