import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getAccountsUrl } from "@/lib/public-urls";
import { MerchantAccountInbox } from "@/components/MerchantAccountInbox";
export default async function StoreAccountInboxPage() {
  const user = await getSessionUser();
  if (!user) redirect(getAccountsUrl("/lookup"));
  return <MerchantAccountInbox key={user.id} />;
}
