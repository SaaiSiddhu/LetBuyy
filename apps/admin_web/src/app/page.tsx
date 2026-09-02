import { redirect } from "next/navigation";
import { getConsoleSessionFromCookies } from "@/lib/console-auth-server";

export default async function ConsolePage() {
  const session = await getConsoleSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (!session.mfaVerified) {
    redirect("/mfa");
  }

  redirect("/dashboard");
}
