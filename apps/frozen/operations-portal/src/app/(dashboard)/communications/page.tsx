import { EmployeeModuleScreen } from '@/components/_local-ui/employee-module-screen';
import { loadEmployeeAnalytics } from '@/lib/api/employee-modules';

export default async function CommunicationsPage() {
    const analytics = await loadEmployeeAnalytics();

    return (
        <EmployeeModuleScreen
            moduleKey="communications"
            analytics={analytics.data}
            analyticsError={analytics.error}
        />
    );
}
