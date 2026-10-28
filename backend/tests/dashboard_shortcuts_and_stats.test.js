import test from "node:test";
import assert from "node:assert/strict";

// Mirror standardized task completion helper
const isTaskCompleted = (task) => {
  if (!task) return false;
  const value = task.completed;
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "completed" || normalized === "1";
  }
  return false;
};

const parseSafeDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

const isTaskDueToday = (task, now = new Date()) => {
  if (isTaskCompleted(task)) return false;
  const d = parseSafeDate(task.dueDate);
  if (!d) return false;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return d >= start && d < end;
};

const isTaskOverdue = (task, now = new Date()) => {
  if (isTaskCompleted(task)) return false;
  const d = parseSafeDate(task.dueDate);
  if (!d) return false;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d < start;
};

test("Dashboard Metrics: Consistent completion helper handles all valid schemas", () => {
  assert.equal(isTaskCompleted({ completed: true }), true);
  assert.equal(isTaskCompleted({ completed: 1 }), true);
  assert.equal(isTaskCompleted({ completed: "Yes" }), true);
  assert.equal(isTaskCompleted({ completed: "true" }), true);
  assert.equal(isTaskCompleted({ completed: "completed" }), true);
  assert.equal(isTaskCompleted({ completed: "1" }), true);

  assert.equal(isTaskCompleted({ completed: false }), false);
  assert.equal(isTaskCompleted({ completed: 0 }), false);
  assert.equal(isTaskCompleted({ completed: "No" }), false);
  assert.equal(isTaskCompleted({ completed: "false" }), false);
  assert.equal(isTaskCompleted({ completed: null }), false);
  assert.equal(isTaskCompleted(null), false);
});

test("Dashboard Metrics: Completed tasks with past due dates are NEVER counted as overdue", () => {
  const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const completedTask = {
    title: "Completed Old Task",
    dueDate: pastDate,
    completed: true,
  };

  const pendingOverdueTask = {
    title: "Pending Overdue Task",
    dueDate: pastDate,
    completed: false,
  };

  assert.equal(isTaskOverdue(completedTask), false, "Completed task must never be overdue");
  assert.equal(isTaskOverdue(pendingOverdueTask), true, "Pending task past due is overdue");
});

test("Dashboard Metrics: Due Today only counts unfinished tasks requiring attention", () => {
  const todayDate = new Date().toISOString();

  const unfinishedDueToday = {
    title: "Prepare Report",
    dueDate: todayDate,
    completed: false,
  };

  const finishedDueToday = {
    title: "Morning Meeting",
    dueDate: todayDate,
    completed: true,
  };

  assert.equal(isTaskDueToday(unfinishedDueToday), true, "Unfinished task due today requires attention");
  assert.equal(isTaskDueToday(finishedDueToday), false, "Finished task due today does not require attention");
});

test("Dashboard Metrics: Progress percentage is mathematically safe and clamped", () => {
  const computeProgress = (completed, total) => {
    return total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : 0;
  };

  assert.equal(computeProgress(0, 0), 0, "0/0 returns 0 without NaN");
  assert.equal(computeProgress(1, 3), 33, "1/3 returns 33%");
  assert.equal(computeProgress(2, 3), 67, "2/3 returns 67%");
  assert.equal(computeProgress(3, 3), 100, "3/3 returns 100%");
  assert.equal(computeProgress(5, 3), 100, "Exceeding targets is clamped to 100%");
});

test("PendingPage: Overdue filter query param isolates overdue tasks", () => {
  const now = new Date();
  const pastDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).toISOString();
  const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();

  const tasks = [
    { _id: "1", title: "Overdue Task", dueDate: pastDate, completed: false },
    { _id: "2", title: "Finished Old Task", dueDate: pastDate, completed: true },
    { _id: "3", title: "Future Task", dueDate: futureDate, completed: false },
  ];

  const filterPending = (list, filterTab) => {
    return list.filter((t) => {
      if (filterTab === "pending" && isTaskCompleted(t)) return false;
      if (filterTab === "completed" && !isTaskCompleted(t)) return false;
      if (filterTab === "overdue" && !isTaskOverdue(t)) return false;
      return true;
    });
  };

  const overdueList = filterPending(tasks, "overdue");
  assert.equal(overdueList.length, 1);
  assert.equal(overdueList[0]._id, "1");
});
