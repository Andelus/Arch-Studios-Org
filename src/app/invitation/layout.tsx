import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Invitation - Arch Studios",
  description: "Accept your invitation to join an Arch Studios project",
};

export default function InvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gray-50">
      {children}
    </main>
  );
}
