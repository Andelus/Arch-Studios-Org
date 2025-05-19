import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function BillingPage() {
  // No need to destructure auth properties since we're just redirecting
  await auth();
  
  // Redirect to organization billing page
  redirect("/organization-billing");
}
