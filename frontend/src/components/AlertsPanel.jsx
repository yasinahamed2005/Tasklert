import { AlertTriangle, CalendarClock } from "lucide-react";
import { isToday } from "date-fns";

const isCompleted = (task) => {
  const value = task?.completed;
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "completed";
  }
  return false;
};

const AlertsPanel = ({ tasks = [] }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueToday = tasks.filter(
    (task) =>
      task.dueDate &&
      isToday(new Date(task.dueDate)) &&
      !isCompleted(task)
  );

  const overdue = tasks.filter((task) => {
    if (!task.dueDate || isCompleted(task)) return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  });

  return (
    <div className="space-y-3">
      <div className="alert-card alert-card-today">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="alert-title">Due Today</p>
            <p className="alert-count">{dueToday.length} tasks</p>
          </div>
          <div className="alert-icon">
            <CalendarClock className="w-4 h-4" />
          </div>
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

      <div
        className="alert-card alert-card-overdue"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="alert-title">Overdue Tasks</p>
            <p className="alert-count">{overdue.length} tasks</p>
          </div>
          <div className="alert-icon">
            <AlertTriangle className="w-4 h-4" />
          </div>
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
