import type { Metadata } from "next";
import { GeistSans, GeistMono } from 'geist/font';
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";
import { SupabaseAuthSync } from "../lib/auth-sync";
import DebugProvider from "./debug-provider";

export const metadata: Metadata = {
  title: "Chateaux AI",
  description: "Create at the speed of imagination.",
  icons: {
    icon: '/ChatGPT Image May 18, 2025, 06_14_20 AM.png',
    shortcut: '/ChatGPT Image May 18, 2025, 06_14_20 AM.png',
    apple: '/ChatGPT Image May 18, 2025, 06_14_20 AM.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="w-full">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased min-h-screen w-full flex flex-col`}>
        <SupabaseAuthSync>
          <ThemeProvider>{children}</ThemeProvider>
          <DebugProvider />
        </SupabaseAuthSync>
      </body>
    </html>
  );
}
