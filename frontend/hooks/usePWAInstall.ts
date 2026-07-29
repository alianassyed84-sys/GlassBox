import { useEffect, useState } from "react";

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkPrompt = () => {
      if ((window as any).deferredPrompt) {
        setIsInstallable(true);
      } else {
        setIsInstallable(false);
      }
    };

    checkPrompt();

    const handlePrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setIsInstallable(true);
    };

    const handleInstalled = () => {
      (window as any).deferredPrompt = null;
      setIsInstallable(false);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    // Polling backup to catch updates
    const interval = setInterval(checkPrompt, 1000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      clearInterval(interval);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) return false;

    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);

    (window as any).deferredPrompt = null;
    setIsInstallable(false);
    return outcome === "accepted";
  };

  return { isInstallable, installApp };
}
