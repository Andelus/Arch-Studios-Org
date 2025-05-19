import { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Analytics - Arch Studios",
  description: "Analytics and insights for your organization",
};

export default function AnalyticsLayout({
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
