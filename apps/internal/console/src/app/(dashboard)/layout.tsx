import { requireConsoleSession } from '@/lib/console-auth-server';
import { isAppPlatformEnabled } from '@/lib/app-platform-flag';
import { ConsoleShell } from '@/components/ConsoleShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await requireConsoleSession({ mfa: true });
    return <ConsoleShell appPlatformEnabled={isAppPlatformEnabled()} email={session.email} local={process.env.NODE_ENV === 'development'}>{children}</ConsoleShell>;
}
