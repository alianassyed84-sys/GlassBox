import { useEffect } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import { getPendingActions, deletePendingAction } from "@/lib/localdb";
import { useGlassboxStore } from "@/lib/store";

export function useBackgroundSync() {
  const { isOnline } = useNetworkStatus();
  const { addToast } = useGlassboxStore();

  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      try {
        const pending = await getPendingActions();
        if (pending.length === 0) return;

        console.log(`Processing ${pending.length} pending offline actions...`);
        for (const action of pending) {
          // Simulate sync delay
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          if (action.type === "share-fix") {
            addToast("Your Fix Card was shared", "success");
          } else if (action.type === "share-report") {
            addToast("Your Report Card was shared", "success");
          } else if (action.type === "share-run") {
            addToast("Your run trace link was shared", "success");
          }
          
          if (action.id !== undefined) {
            await deletePendingAction(action.id);
          }
        }
      } catch (err) {
        console.error("Failed to process background sync queue:", err);
      }
    };

    processQueue();
  }, [isOnline, addToast]);
}
