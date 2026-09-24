import { EmployeeModuleScreen } from '@/components/_local-ui/employee-module-screen';
import { loadEmployeeAnalytics } from '@/lib/api/employee-modules';

export default async function RetentionPage() {
    const analytics = await loadEmployeeAnalytics();

    return (
        <EmployeeModuleScreen
            moduleKey="retention"
            analytics={analytics.data}
            analyticsError={analytics.error}
        />
    );
}
