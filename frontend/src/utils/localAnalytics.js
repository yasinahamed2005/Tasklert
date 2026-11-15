/**
 * Local Offline Analytics Calculator
 * Computes productivity aggregates, completion rates, priority breakdowns,
 * and daily timelines directly from IndexedDB when disconnected from the backend.
 */

const isCompletedTask = (task) => {
  if (!task) return false;
  const val = task.completed;
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const norm = val.trim().toLowerCase();
    return norm === "yes" || norm === "true" || norm === "completed" || norm === "1";
  }
  return false;
};

export const parseLocalRange = (range = "30d", customStart, customEnd) => {
  const now = new Date();
  let start;
  let end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (range === "7d") {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === "30d") {
    start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (range === "90d") {
    start = new Date(now);
    start.setDate(now.getDate() - 89);
    start.setHours(0, 0, 0, 0);
  } else if (range === "custom" && customStart && customEnd) {
    start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

export const computeLocalAnalytics = (tasks = [], focusSessions = [], range = "30d", customStart, customEnd) => {
  const { start, end } = parseLocalRange(range, customStart, customEnd);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const startTime = start.getTime();
  const endTime = end.getTime();

  // Filter non-deleted tasks
  const activeTasks = tasks.filter((t) => !t.isDeleted);

  let createdInPeriod = 0;
  let completedInPeriod = 0;
  let pendingInPeriod = 0;
  let allPending = 0;
  let overdueTasks = 0;

  const priorityBreakdown = {
    High: { total: 0, completed: 0, pending: 0 },
    Medium: { total: 0, completed: 0, pending: 0 },
    Low: { total: 0, completed: 0, pending: 0 },
  };

  // Pre-populate daily timeline buckets
  const timelineBuckets = {};
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().split("T")[0];
    timelineBuckets[key] = { date: key, created: 0, completed: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }

  activeTasks.forEach((task) => {
    const isComp = isCompletedTask(task);
    const createdAtTime = task.createdAt ? new Date(task.createdAt).getTime() : 0;
    const completedAtTime = task.completedAt
      ? new Date(task.completedAt).getTime()
      : isComp && task.updatedAt
      ? new Date(task.updatedAt).getTime()
      : 0;

    const prio = task.priority === "High" || task.priority === "Medium" ? task.priority : "Low";

    if (!isComp) {
      allPending++;
      const dueStr = task.dueDate ? task.dueDate.split("T")[0] : null;
      if (dueStr && dueStr < todayStr) {
        overdueTasks++;
      }
    }

    // In-period checks
    const wasCreatedInPeriod = createdAtTime >= startTime && createdAtTime <= endTime;
    const wasCompletedInPeriod = isComp && completedAtTime >= startTime && completedAtTime <= endTime;

    if (wasCreatedInPeriod) {
      createdInPeriod++;
      priorityBreakdown[prio].total++;
      if (isComp) {
        priorityBreakdown[prio].completed++;
      } else {
        pendingInPeriod++;
        priorityBreakdown[prio].pending++;
      }

      const cDateKey = new Date(createdAtTime).toISOString().split("T")[0];
      if (timelineBuckets[cDateKey]) {
        timelineBuckets[cDateKey].created++;
      }
    }

    if (wasCompletedInPeriod) {
      completedInPeriod++;
      const compDateKey = new Date(completedAtTime).toISOString().split("T")[0];
      if (timelineBuckets[compDateKey]) {
        timelineBuckets[compDateKey].completed++;
      }
    }
  });

  // Calculate focus minutes in period
  let focusMinutes = 0;
  (focusSessions || []).forEach((session) => {
    const sessionTime = session.startedAt ? new Date(session.startedAt).getTime() : 0;
    if (sessionTime >= startTime && sessionTime <= endTime) {
      const sec = Number(session.actualElapsedSeconds || session.plannedDuration || 0);
      focusMinutes += sec / 60;
    }
  });

  const completionDenominator = completedInPeriod + pendingInPeriod;
  const completionRate =
    completionDenominator > 0
      ? Math.round((completedInPeriod / completionDenominator) * 100)
      : 0;

  const timeline = Object.values(timelineBuckets).sort((a, b) => a.date.localeCompare(b.date));

  return {
    success: true,
    isOffline: true,
    hasActivity: activeTasks.length > 0,
    summary: {
      createdInPeriod,
      completedInPeriod,
      pendingInPeriod,
      pendingTasks: allPending,
      overdueTasks,
      totalLifetimeTasks: activeTasks.length,
      completionRate,
      focusMinutes: Math.round(focusMinutes),
      comparison: {
        hasPrevData: false,
        createdChangePct: 0,
        completedChangePct: 0,
      },
    },
    priorityBreakdown,
    timeline,
  };
};
