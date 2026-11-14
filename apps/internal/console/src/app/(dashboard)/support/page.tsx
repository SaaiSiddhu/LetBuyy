import {
    ConsoleWorkspace,
    Panel,
} from '@/components/_local-ui/console-workspace';
import { SupportDesk } from './support-desk';
export default function SupportPage() {
    return (
        <ConsoleWorkspace
            eyebrow="Merchant operations"
            title="Support"
            description="Investigate merchant requests, follow conversations and resolve support tickets."
        >
            <Panel
                title="Ticket workspace"
                description="Public replies and internal notes have different audiences. Saving a reply does not imply notification delivery."
            >
                <SupportDesk />
            </Panel>
        </ConsoleWorkspace>
    );
}
