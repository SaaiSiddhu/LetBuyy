import {
  ConsoleWorkspace,
  Panel,
} from "@/components/_local-ui/console-workspace";
import { MerchantMessageWorkspace } from "./workspace";
export default function MerchantMessagesPage() {
  return (
    <ConsoleWorkspace
      eyebrow="Merchant communication"
      title="Merchant messages"
      description="Publish messages from LetBuyy to merchant account inboxes. Review the saved content and exact audience before publishing."
    >
      <Panel
        title="Drafts and published messages"
        description="Platform super admins manage campaigns, offers, regulations and product updates here. Publication adds an account inbox message; it does not send email, SMS or WhatsApp."
      >
        <MerchantMessageWorkspace />
      </Panel>
    </ConsoleWorkspace>
  );
}
