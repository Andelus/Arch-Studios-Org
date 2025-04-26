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
          className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        >
          <Navigation />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
