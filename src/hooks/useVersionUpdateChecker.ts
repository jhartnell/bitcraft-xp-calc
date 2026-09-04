import { useState, useEffect, useCallback, useRef } from 'react';

interface VersionInfo {
  version: string;
  buildTime?: number;
  builtAt?: string;
}

export interface UseVersionUpdateCheckerReturn {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  checkNow: () => Promise<boolean>;
  reload: () => void;
  dismiss: () => void;
}

export async function checkForAppUpdate(
  currentVersion: string,
  fetchFn: typeof fetch = fetch
): Promise<{ hasUpdate: boolean; latestVersion: string | null }> {
  try {
    const res = await fetchFn(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!res.ok) {
      return { hasUpdate: false, latestVersion: null };
    }

    const data: VersionInfo = await res.json();
    if (data.version && data.version !== currentVersion) {
      return { hasUpdate: true, latestVersion: data.version };
    }
  } catch {
    // Ignore network errors during background check
  }

  return { hasUpdate: false, latestVersion: null };
}

export function useVersionUpdateChecker(
  pollIntervalMs: number = 60_000
): UseVersionUpdateCheckerReturn {
  const currentVersion = (import.meta.env.VITE_APP_VERSION as string) || '1.8.4';
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const dismissedUntilRef = useRef<number>(0);

  const checkNow = useCallback(async (): Promise<boolean> => {
    // If dismissed recently, don't re-trigger notification
    if (Date.now() < dismissedUntilRef.current) {
      return false;
    }

    const result = await checkForAppUpdate(currentVersion);
    if (result.hasUpdate && result.latestVersion) {
      setHasUpdate(true);
      setLatestVersion(result.latestVersion);
      return true;
    }

    return false;
  }, [currentVersion]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    setHasUpdate(false);
    // Snooze notifications for 15 minutes
    dismissedUntilRef.current = Date.now() + 15 * 60 * 1000;
  }, []);

  useEffect(() => {
    // Initial check after 5s
    const initialTimer = setTimeout(() => {
      checkNow();
    }, 5000);

    // Periodic polling
    const intervalTimer = setInterval(() => {
      checkNow();
    }, pollIntervalMs);

    // Check when user focuses the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkNow();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [checkNow, pollIntervalMs]);

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    checkNow,
    reload,
    dismiss,
  };
}
