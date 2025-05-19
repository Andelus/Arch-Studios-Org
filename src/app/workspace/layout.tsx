import { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Workspace - Arch Studios",
  description: "Collaborate with your team in real-time",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      {children}
    </main>
  );
}
