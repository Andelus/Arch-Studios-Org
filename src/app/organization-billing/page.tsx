import { redirect } from "next/navigation";
import { auth as getAuth } from "@clerk/nextjs/server";
import OrganizationBillingClient from "./OrganizationBillingClient";

export const metadata = {
  title: "Organization Billing | Arch Studios",
  description: "Manage your organization's subscription and billing settings.",
};

export default async function OrganizationBillingPage() {
  const authResponse = await getAuth();
  const { userId, orgId } = authResponse;

  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect("/sign-in");
  }

  // If user is not part of an organization, redirect to create organization page
  if (!orgId) {
    redirect("/setup-organization");
  }

  return (
    <main>
      <OrganizationBillingClient />
    </main>
  );
}
