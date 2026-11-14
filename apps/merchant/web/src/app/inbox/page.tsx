import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getAccountsUrl } from "@/lib/public-urls";
import { MerchantAccountInbox } from "@/components/MerchantAccountInbox";
export default async function AccountInboxPage() {
  const user = await getSessionUser();
  if (!user) redirect(getAccountsUrl("/lookup"));
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <Link className="underline" href="/stores">
        Your stores
      </Link>
      <MerchantAccountInbox key={user.id} />
    </main>
  );
}
