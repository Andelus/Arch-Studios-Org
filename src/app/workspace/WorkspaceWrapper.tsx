"use client";

import { TeamProvider } from "@/contexts/TeamContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { useState, useEffect } from "react";

// Import directly from page.tsx to avoid circular dependency
import WorkspacePage from "./page";

export default function WorkspaceWrapper() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  
  // We'll let the WorkspaceContent component handle project selection naturally
  // based on available projects rather than hardcoding a non-existent project ID
  
  return (
    <TeamProvider initialProjectId={selectedProjectId}>
      <WorkspaceProvider initialProjectId={selectedProjectId}>
        <WorkspacePage />
      </WorkspaceProvider>
    </TeamProvider>
  );
}
