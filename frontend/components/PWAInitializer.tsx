"use client";

import { useEffect } from "react";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { cleanOldRuns } from "@/lib/localdb";

export default function PWAInitializer() {
  useBackgroundSync();
  
  useEffect(() => {
    // Run database cleanup job on app mount
    cleanOldRuns(30);
  }, []);

  return null;
}
