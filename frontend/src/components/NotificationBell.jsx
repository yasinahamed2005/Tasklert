import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Settings, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useNavigate } from "react-router-dom";

const badgeLabel = (count) => (count > 99 ? "99+" : String(count));

const kindLabel = (kind) => {
  if (kind === "due_today") return "Due today";
  if (kind === "overdue") return "Overdue";
  return "Reminder";
};

const NotificationBell = ({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onClearAll,
}) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-full hover:bg-[color:var(--primary-50)] transition"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[color:var(--primary)]" />
        {unreadCount > 0 && (
          <span className="notif-badge">{badgeLabel(unreadCount)}</span>
        )}
      </button>

      {open && (
        <div
          className="notif-panel animate-fadeIn"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">
              Notifications
            </h4>
            {notifications.length > 0 && (
              <button
                onClick={() => onClearAll?.()}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">
              No notifications yet
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {notifications.map((item) => (
                <div
                  key={item._id}
                  className={`notif-item ${item.read ? "is-read" : ""} notif-kind-${item.kind || "reminder"} group relative flex items-start justify-between gap-2`}
                >
                  <button
                    type="button"
                    onClick={() => onMarkRead?.(item._id)}
                    className="flex-1 text-left cursor-pointer min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="notif-title">{item.title}</span>
                      <span className="notif-kind">{kindLabel(item.kind)}</span>
                    </div>
                    <p className="notif-message">{item.message}</p>
                    <p className="notif-time">
                      {item.createdAt
                        ? formatDistanceToNowStrict(new Date(item.createdAt), {
                            addSuffix: true,
                          })
                        : "Just now"}
                    </p>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item._id);
                      }}
                      className="text-gray-300 hover:text-red-500 p-1 rounded-md transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 mt-2 border-t border-purple-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-semibold cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Alarms & Device Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
