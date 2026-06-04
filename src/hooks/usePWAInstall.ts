import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export function usePWAInstall() {
  const [isReadyToInstall, setIsReadyToInstall] = useState(
    !!(window as any).deferredPWAInstallPrompt
  );
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );

  useEffect(() => {
    // Capture inline beforeinstallprompt if fired while component is alive
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      setIsReadyToInstall(true);
    };

    const handlePromptAvailable = () => {
      setIsReadyToInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsReadyToInstall(false);
      toast.success('Packer Tools has been successfully installed to your homescreen!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Monitor matching media changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const triggerInstall = async () => {
    const promptEvent = (window as any).deferredPWAInstallPrompt;
    if (!promptEvent) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast.info("To install on iOS: Tap the Safari share button (📤 icon), then select 'Add to Home Screen' (➕ icon).", {
          duration: 7000
        });
      } else {
        toast.info("Install criteria under review by the browser. You can install directly via your browser's menu (e.g. 'Install app' or 'Add to Home screen').", {
          duration: 6000
        });
      }
      return;
    }

    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        toast.success('Packer Tools is installing onto your home screen!');
        setIsInstalled(true);
        setIsReadyToInstall(false);
        (window as any).deferredPWAInstallPrompt = null;
      } else {
        toast.info('Installation deferred. You can install Packer Tools anytime.');
      }
    } catch (err) {
      console.error('[PWA] Installation prompt failed:', err);
      toast.error('An error occurred triggered by mobile browser security policy.');
    }
  };

  return {
    isReadyToInstall,
    isInstalled,
    triggerInstall
  };
}
