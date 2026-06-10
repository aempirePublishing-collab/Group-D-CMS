import { useState, useEffect } from "react";
import { Bell, BellRing, Settings, Check, Trash2, ShieldAlert } from "lucide-react";
import { NotificationItem } from "../types";

interface NotificationBellProps {
  token: string | null;
  notifications: NotificationItem[];
  onRefresh: () => void;
  onSelectTab?: (tab: "dashboard" | "materials" | "assignments" | "notes" | "security") => void;
}

export default function NotificationBell({ token, notifications, onRefresh, onSelectTab }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" ? Notification.permission : "default"
  );

  // Monitor notifications and run push triggers for unread notifications
  useEffect(() => {
    if (notifications.length === 0) return;

    // Filter unread notifications created in the last 15 seconds to trigger browser pushes
    const recentUnread = notifications.filter(
      notif => !notif.isRead && (new Date().getTime() - new Date(notif.createdAt).getTime()) < 15000
    );

    if (recentUnread.length > 0 && permission === "granted") {
      recentUnread.forEach(notif => {
        try {
          // Trigger browser default push notifications
          new Notification(notif.title, {
            body: notif.message,
            icon: "/favicon.ico"
          });
        } catch (err) {
          console.warn("Browser rejected automatic push launch:", err);
        }
      });
    }
  }, [notifications, permission]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support physical desktop push notifications.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        new Notification("GDCMS Push Activated ✔️", {
          body: "You will now receive instant push alerts for grades, assignments and course updates."
        });
      }
    } catch (e) {
      console.error("Denied permissions:", e);
    }
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead && token) {
      try {
        await fetch(`/api/notifications/${notif.id}/read`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        onRefresh();
      } catch (e) {
        console.error("Failed to mark individual notification as read:", e);
      }
    }

    if (onSelectTab) {
      if (notif.type === "material") {
        onSelectTab("materials");
      } else if (notif.type === "assignment" || notif.type === "grade") {
        onSelectTab("assignments");
      }
    }
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none hover:bg-slate-100 rounded-full cursor-pointer relative transition-all"
        title="View Notifications"
      >
        {unreadCount > 0 ? (
          <>
            <BellRing className="w-5 h-5 text-indigo-600 animate-swing" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-5 h-5" />
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="absolute right-[-16px] sm:right-0 mt-2.5 w-[85vw] xs:w-80 sm:w-96 max-w-[360px] sm:max-w-none bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Notification Hub</span>
              {unreadCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 font-medium text-[11px] px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h4>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Web Push configuration bar */}
          <div className="px-4 py-2.5 bg-indigo-50/50 flex flex-col gap-1 text-[11px]">
            {permission !== "granted" ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Desktop Push Alert is disabled</span>
                <button
                  onClick={requestNotificationPermission}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded text-[10px] cursor-pointer transition-colors"
                >
                  Enable Push
                </button>
              </div>
            ) : (
              <div className="flex items-center text-emerald-700 font-medium gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Browser Push Notifications enabled</span>
              </div>
            )}
          </div>

          {/* List items */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto stroke-1.5 opacity-60 mb-2" />
                <p className="text-xs font-medium">No alerts or updates found.</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 transition-colors cursor-pointer hover:bg-slate-50 border-l-2 text-left ${
                    notif.isRead 
                      ? "bg-white border-transparent" 
                      : "bg-indigo-50/30 font-semibold border-indigo-605 border-indigo-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800">{notif.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })} - {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {!notif.isRead && (
                      <span className="w-2 h-2 bg-indigo-600 rounded-full mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer toggle display */}
          <div className="p-2.5 bg-slate-50 text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Close Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
