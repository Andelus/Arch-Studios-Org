"use client";

import { useState, useEffect } from "react";
import { TeamProvider } from "@/contexts/TeamContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import WorkspaceContent from "./WorkspaceContent";

export default function WorkspacePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  
  // Initialize without hardcoded project ID
  // We'll let WorkspaceContent handle selecting the first available project naturally
  
  return (
    <TeamProvider initialProjectId={selectedProjectId}>
      <WorkspaceProvider initialProjectId={selectedProjectId}>
        <WorkspaceContent />
      </WorkspaceProvider>
    </TeamProvider>
  );
}