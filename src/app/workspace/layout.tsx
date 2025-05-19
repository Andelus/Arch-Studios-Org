"use client";

import "../globals.css";
import { TeamProvider } from "@/contexts/TeamContext";
import AuthNotificationHandler from "@/components/AuthNotificationHandler";
import NotificationCenter from "@/components/NotificationCenter";
import { useNotifications } from "@/hooks/useNotifications";

// Metadata moved to a separate server component file since this is now a client component

// Create a NotificationProvider for the workspace
function NotificationProvider({ children }: { children: React.ReactNode }) {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  } = useNotifications();

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-50">
        <NotificationCenter
          notifications={notifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDismiss={dismissNotification}
        />
      </div>
    </>
  );
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeamProvider>
      <NotificationProvider>
        <AuthNotificationHandler />
        <main>{children}</main>
      </NotificationProvider>
    </TeamProvider>
  );
}
