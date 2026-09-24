import { EmployeeModuleScreen } from '@/components/_local-ui/employee-module-screen';
import { loadEmployeeAnalytics } from '@/lib/api/employee-modules';

export default async function OnboardingPage() {
    const analytics = await loadEmployeeAnalytics();

    return (
        <EmployeeModuleScreen
            moduleKey="onboarding"
            analytics={analytics.data}
            analyticsError={analytics.error}
        />
    );
}
