"use client";

import { TeamProvider } from "@/contexts/TeamContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { useState, useEffect } from "react";

// Import directly from page.tsx to avoid circular dependency
import WorkspacePage from "./page";

export default function WorkspaceWrapper() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  
  // In a real app, we'd get the selected project from URL or local storage
  useEffect(() => {
    // Default to first project for now
    setSelectedProjectId('proj-1');
  }, []);
  
  return (
    <TeamProvider initialProjectId={selectedProjectId}>
      <WorkspaceProvider initialProjectId={selectedProjectId}>
        <WorkspacePage />
      </WorkspaceProvider>
    </TeamProvider>
  );
}
