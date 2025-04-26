import type { Metadata } from "next";
import { GeistSans, GeistMono } from 'geist/font';
import Navigation from "@/components/Navigation";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: "Chateaux AI",
  description: "Create at the speed of imagination.",
  icons: {
    icon: '/new-favicon.jpg',
    shortcut: '/new-favicon.jpg',
    apple: '/new-favicon.jpg',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${GeistSans.variable} ${GeistMono.variable} antialiased min-h-screen flex flex-col`}
        >
          <Navigation />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
