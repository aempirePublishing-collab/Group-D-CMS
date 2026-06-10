import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface OfflineIndicatorProps {
  token: string | null;
  onSyncSuccess?: () => void;
}

export default function OfflineIndicator({ token, onSyncSuccess }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [offlineNotesCount, setOfflineNotesCount] = useState<number>(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerNotesSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check for offline notes
    checkOfflineNotes();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [token]);

  // Read how many notes are currently unsynced in localStorage
  const checkOfflineNotes = () => {
    try {
      const dbNotesStr = localStorage.getItem("gdcms_offline_notes");
      if (dbNotesStr) {
        const notes = JSON.parse(dbNotesStr);
        setOfflineNotesCount(notes.length);
      } else {
        setOfflineNotesCount(0);
      }
    } catch (e) {
      setOfflineNotesCount(0);
    }
  };

  const triggerNotesSync = async () => {
    if (!token || !navigator.onLine) return;
    try {
      const dbNotesStr = localStorage.getItem("gdcms_offline_notes");
      if (!dbNotesStr) return;

      const offlineNotes = JSON.parse(dbNotesStr);
      if (offlineNotes.length === 0) return;

      setIsSyncing(true);

      const response = await fetch("/api/notes/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes: offlineNotes })
      });

      if (response.ok) {
        // Clear local queue upon successful sync
        localStorage.removeItem("gdcms_offline_notes");
        setOfflineNotesCount(0);
        if (onSyncSuccess) onSyncSuccess();
      }
    } catch (err) {
      console.error("Auto Sync sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Allow setting checker intervals
  useEffect(() => {
    const interval = setInterval(() => {
      checkOfflineNotes();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="offline-status-banner" className="transition-all duration-300">
      {!isOnline ? (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>Currently Offline. Any personal notes will be logged in offline cache storage and synced on reconnection.</span>
          </div>
          {offlineNotesCount > 0 && (
            <span className="bg-amber-800 text-amber-100 px-2 py-0.5 rounded-full text-xs font-semibold">
              {offlineNotesCount} pending syncs
            </span>
          )}
        </div>
      ) : offlineNotesCount > 0 ? (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>Network resumed! You have {offlineNotesCount} unsaved personal notebook drafts.</span>
          </div>
          <button
            onClick={triggerNotesSync}
            disabled={isSyncing}
            className="bg-white/15 hover:bg-white/25 active:bg-white/30 disabled:opacity-50 px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors pointer-events-auto cursor-pointer"
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>Sync Now</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
