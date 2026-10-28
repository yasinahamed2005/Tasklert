import { AlertTriangle, Calendar, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isTaskDueToday, isTaskOverdue } from "../assets/dummy";

const AlertsPanel = ({ tasks = [] }) => {
  const navigate = useNavigate();

  const dueToday = tasks.filter(isTaskDueToday);
  const overdue = tasks.filter(isTaskOverdue);

  return (
    <div className="space-y-3">
      {/* Due Today Card with Calendar Shortcut */}
      <div className="alert-card alert-card-today">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="alert-title">Due Today</p>
            <p className="alert-count">{dueToday.length} tasks</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/calendar")}
            title="Open calendar"
            aria-label="Open calendar"
            className="alert-icon hover:opacity-90 active:scale-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] shrink-0"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
        <div className="alert-list">
          {dueToday.length === 0 ? (
            <p className="alert-empty">No tasks due today.</p>
          ) : (
            dueToday.slice(0, 3).map((task) => (
              <p key={task._id || task.id} className="alert-item">
                {task.title}
              </p>
            ))
          )}
        </div>
      </div>

      {/* Overdue Tasks Card with Pending View Shortcut */}
      <div className="alert-card alert-card-overdue">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="alert-title">Overdue Tasks</p>
            <p className="alert-count">{overdue.length} tasks</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/pending?filter=overdue")}
            title="View overdue tasks"
            aria-label="View overdue tasks"
            className="alert-icon hover:opacity-90 active:scale-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0"
            style={{
              background: "color-mix(in srgb, #ef4444 16%, white)",
              color: "#dc2626",
            }}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="alert-list">
          {overdue.length === 0 ? (
            <p className="alert-empty">No overdue tasks.</p>
          ) : (
            overdue.slice(0, 3).map((task) => (
              <p key={task._id || task.id} className="alert-item">
                {task.title}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsPanel;
