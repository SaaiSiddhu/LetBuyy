import { redirect } from "next/navigation";

export default function ConsolePage() {
  // TODO: Check session → redirect to dashboard or login
  redirect("/login");
}
