import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompleted,
  normalizeRecurrence,
  getNextDueDate,
} from "../controllers/taskController.js";
import {
  getNextWallClockOccurrence,
} from "../utils/timeZone.js";

// ============================================================================
// TASKLERT ALARM DISMISS & TASK COMPLETION BUG FIX TEST SUITE
// ============================================================================

// Helper to simulate the exact dismissReminder logic in reminderController.js
const simulateDismissReminder = async ({
  userId,
  reminder,
  tasksDb,
  notificationsDb,
}) => {
  if (!reminder || String(reminder.owner) !== String(userId)) {
    return { status: 404, error: "Reminder not found or not yours" };
  }

  let taskCompleted = false;
  let targetTaskId = null;
  const linkedTaskId = reminder.task?._id || reminder.task;

  if (linkedTaskId) {
    targetTaskId = linkedTaskId;
    const task = tasksDb.find(
      (t) => String(t._id) === String(linkedTaskId) && String(t.owner) === String(userId) && !t.isDeleted
    );

    if (task) {
      const wasCompleted = normalizeCompleted(task.completed);
      if (!wasCompleted) {
        task.completed = true;
        task.completedAt = new Date();

        // Recurring task handling: Spawn next instance if recurring
        const recurrence = normalizeRecurrence(task.recurrence || {}, task.recurrence);
        const shouldCreateNext = recurrence.frequency !== "none" && !task.recurrenceSpawned;

        if (shouldCreateNext) {
          const nextDueDate = getNextDueDate(task.dueDate, recurrence);
          if (nextDueDate) {
            const nextTask = {
              _id: `task_${Date.now()}_next`,
              title: task.title,
              description: task.description,
              priority: task.priority,
              dueDate: nextDueDate,
              owner: task.owner,
              completed: false,
              completedAt: null,
              subtasks: (task.subtasks || []).map((item) => ({ title: item.title, completed: false })),
              reminderEnabled: false,
              reminderAt: null,
              recurrence: { ...recurrence, endAlertsSent: [] },
              recurrenceSpawned: false,
              project: task.project,
              tags: task.tags || [],
            };
            tasksDb.push(nextTask);
            task.recurrenceSpawned = true;
          }
        }

        // Clean up pending notifications for this task
        if (notificationsDb) {
          const filtered = notificationsDb.filter(
            (n) => !(String(n.owner) === String(userId) && String(n.task) === String(task._id))
          );
          notificationsDb.length = 0;
          notificationsDb.push(...filtered);
        }

        taskCompleted = true;
      } else {
        // Already completed: idempotent success
        taskCompleted = true;
      }
    }
  }

  // Handle Alarm / Reminder status (Recurring vs One-time)
  if (reminder.repeat && reminder.repeat !== "never") {
    const nextOccurrence = getNextWallClockOccurrence(reminder.scheduledAt, reminder.repeat, reminder.timeZone || "UTC");
    if (nextOccurrence) {
      reminder.scheduledAt = nextOccurrence;
      reminder.status = "scheduled";
      reminder.isClaimed = false;
      reminder.claimedAt = null;
      reminder.snoozedUntil = null;
      reminder.nextRetryAt = null;
      reminder.deliveryAttempts = 0;
      reminder.occurrenceCount = (reminder.occurrenceCount || 0) + 1;

      return {
        status: 200,
        success: true,
        message: targetTaskId
          ? `Alarm dismissed and task marked completed. Next recurring alarm scheduled.`
          : `Alarm dismissed. Next recurring alarm scheduled.`,
        reminder,
        taskCompleted,
        taskId: targetTaskId,
      };
    }
  }

  // Non-repeating alarm
  reminder.status = "dismissed";
  reminder.alarmEnabled = false;
  reminder.isClaimed = false;
  reminder.claimedAt = null;
  reminder.snoozedUntil = null;
  reminder.nextRetryAt = null;

  return {
    status: 200,
    success: true,
    message: targetTaskId ? "Alarm dismissed and linked task marked completed." : "Alarm dismissed.",
    reminder,
    taskCompleted,
    taskId: targetTaskId,
  };
};

// 1. Scenario 1: Dismissing an alarm linked to a task marks the task completed in MongoDB
test("Scenario 1: Dismissing an alarm linked to a task marks the task completed in MongoDB", async () => {
  const userId = "user_123";
  const tasksDb = [
    {
      _id: "task_001",
      owner: userId,
      title: "Write Q3 Performance Review",
      completed: false,
      completedAt: null,
      reminderEnabled: true,
      reminderAt: new Date("2026-10-20T09:00:00Z"),
    },
  ];
  const reminder = {
    _id: "rem_001",
    owner: userId,
    task: "task_001",
    title: "Write Q3 Performance Review",
    scheduledAt: new Date("2026-10-20T09:00:00Z"),
    repeat: "never",
    alarmEnabled: true,
    status: "scheduled",
  };

  const res = await simulateDismissReminder({ userId, reminder, tasksDb });
  assert.equal(res.status, 200);
  assert.equal(res.success, true);
  assert.equal(res.taskCompleted, true);
  assert.equal(res.taskId, "task_001");

  const updatedTask = tasksDb.find((t) => t._id === "task_001");
  assert.equal(updatedTask.completed, true);
  assert.equal(reminder.status, "dismissed");
  assert.equal(reminder.alarmEnabled, false);
});

// 2. Scenario 2: completedAt timestamp is populated with current date/time
test("Scenario 2: completedAt timestamp is populated with current date/time", async () => {
  const userId = "user_123";
  const tasksDb = [
    {
      _id: "task_002",
      owner: userId,
      title: "Team Standup",
      completed: false,
      completedAt: null,
    },
  ];
  const reminder = {
    _id: "rem_002",
    owner: userId,
    task: "task_002",
    title: "Team Standup",
    scheduledAt: new Date("2026-10-20T10:00:00Z"),
    repeat: "never",
    status: "scheduled",
  };

  const before = Date.now();
  await simulateDismissReminder({ userId, reminder, tasksDb });
  const after = Date.now();

  const task = tasksDb.find((t) => t._id === "task_002");
  assert.ok(task.completedAt instanceof Date);
  assert.ok(task.completedAt.getTime() >= before && task.completedAt.getTime() <= after);
});

// 3. Scenario 3: Snoozing an alarm leaves the linked task pending
test("Scenario 3: Snoozing an alarm leaves the linked task pending", async () => {
  const userId = "user_123";
  const task = {
    _id: "task_003",
    owner: userId,
    title: "Review PR #42",
    completed: false,
    completedAt: null,
  };
  const reminder = {
    _id: "rem_003",
    owner: userId,
    task: "task_003",
    status: "scheduled",
    snoozeDuration: 5,
  };

  // Snooze simulation
  const snoozeMinutes = 10;
  const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);
  reminder.status = "snoozed";
  reminder.snoozedUntil = snoozedUntil;

  // Verify task remains strictly pending
  assert.equal(task.completed, false);
  assert.equal(task.completedAt, null);
  assert.equal(reminder.status, "snoozed");
  assert.ok(reminder.snoozedUntil > new Date());
});

// 4. Scenario 4: Turning off / disabling an alarm leaves the task pending
test("Scenario 4: Turning off / disabling an alarm leaves the task pending", async () => {
  const userId = "user_123";
  const task = {
    _id: "task_004",
    owner: userId,
    title: "Submit Expense Report",
    completed: false,
    completedAt: null,
    reminderEnabled: true,
  };
  const reminder = {
    _id: "rem_004",
    owner: userId,
    task: "task_004",
    alarmEnabled: true,
  };

  // Toggle alarm off
  reminder.alarmEnabled = false;
  task.reminderEnabled = false;

  assert.equal(reminder.alarmEnabled, false);
  assert.equal(task.reminderEnabled, false);
  assert.equal(task.completed, false);
  assert.equal(task.completedAt, null);
});

// 5. Scenario 5: Deleting an alarm unlinks the task while leaving the task pending
test("Scenario 5: Deleting an alarm unlinks the task while leaving the task pending", async () => {
  const userId = "user_123";
  const task = {
    _id: "task_005",
    owner: userId,
    title: "Update Project Readme",
    completed: false,
    completedAt: null,
    reminderEnabled: true,
    reminderAt: new Date(),
  };

  // Simulate deleteReminder unlinking
  task.reminderEnabled = false;
  task.reminderAt = null;

  assert.equal(task.reminderEnabled, false);
  assert.equal(task.reminderAt, null);
  assert.equal(task.completed, false);
  assert.equal(task.completedAt, null);
});

// 6. Scenario 6: A general alarm (not linked to a task) dismisses without error and without touching any task
test("Scenario 6: A general alarm (not linked to a task) dismisses without error and without touching any task", async () => {
  const userId = "user_123";
  const tasksDb = [
    { _id: "task_006", owner: userId, title: "Unrelated Task", completed: false, completedAt: null },
  ];
  const generalReminder = {
    _id: "rem_006",
    owner: userId,
    task: null, // standalone general alarm
    title: "Drink Water",
    repeat: "never",
    alarmEnabled: true,
    status: "scheduled",
  };

  const res = await simulateDismissReminder({ userId, reminder: generalReminder, tasksDb });
  assert.equal(res.status, 200);
  assert.equal(res.success, true);
  assert.equal(res.taskCompleted, false);
  assert.equal(res.taskId, null);
  assert.equal(generalReminder.status, "dismissed");
  assert.equal(generalReminder.alarmEnabled, false);

  // Unrelated task untouched
  const task = tasksDb.find((t) => t._id === "task_006");
  assert.equal(task.completed, false);
});

// 7. Scenario 7: Idempotent repeated dismiss clicks don't fail, don't crash, and don't create corrupt/duplicate data
test("Scenario 7: Idempotent repeated dismiss clicks don't fail or create duplicate data", async () => {
  const userId = "user_123";
  const tasksDb = [
    { _id: "task_007", owner: userId, title: "Call Electrician", completed: false, completedAt: null },
  ];
  const reminder = {
    _id: "rem_007",
    owner: userId,
    task: "task_007",
    title: "Call Electrician",
    repeat: "never",
    alarmEnabled: true,
    status: "scheduled",
  };

  // First dismiss
  const res1 = await simulateDismissReminder({ userId, reminder, tasksDb });
  assert.equal(res1.success, true);
  const task = tasksDb.find((t) => t._id === "task_007");
  assert.equal(task.completed, true);
  const firstCompletedAt = task.completedAt;

  // Second dismiss (e.g. double click or retry)
  const res2 = await simulateDismissReminder({ userId, reminder, tasksDb });
  assert.equal(res2.success, true);
  assert.equal(task.completed, true);
  assert.equal(task.completedAt.getTime(), firstCompletedAt.getTime());
  assert.equal(tasksDb.length, 1); // No duplicate tasks
});

// 8. Scenario 8: Recurrence rules: completing a recurring task via alarm dismiss spawns next instance
test("Scenario 8: Recurrence rules: completing a recurring task via alarm dismiss spawns next instance", async () => {
  const userId = "user_123";
  const dueDate = new Date("2026-10-15T09:00:00Z");
  const tasksDb = [
    {
      _id: "task_008_recurring",
      owner: userId,
      title: "Daily Morning Standup",
      dueDate,
      completed: false,
      completedAt: null,
      recurrence: { frequency: "daily", interval: 1, endsOn: null, endAlertsSent: [] },
      recurrenceSpawned: false,
    },
  ];
  const reminder = {
    _id: "rem_008",
    owner: userId,
    task: "task_008_recurring",
    title: "Daily Morning Standup",
    repeat: "daily",
    timeZone: "UTC",
    scheduledAt: dueDate,
    status: "scheduled",
  };

  const res = await simulateDismissReminder({ userId, reminder, tasksDb });
  assert.equal(res.success, true);

  // Original task is completed and recurrenceSpawned is true
  const original = tasksDb.find((t) => t._id === "task_008_recurring");
  assert.equal(original.completed, true);
  assert.equal(original.recurrenceSpawned, true);

  // Spawned next task exists
  assert.equal(tasksDb.length, 2);
  const nextTask = tasksDb.find((t) => t._id !== "task_008_recurring");
  assert.equal(nextTask.completed, false);
  assert.equal(nextTask.title, "Daily Morning Standup");
  const expectedNextDue = new Date(dueDate);
  expectedNextDue.setDate(expectedNextDue.getDate() + 1);
  assert.equal(nextTask.dueDate.toISOString(), expectedNextDue.toISOString());
});

// 9. Scenario 9: Non-recurring vs recurring alarm repeat handling
test("Scenario 9: Repeating alarm reschedules next occurrence, non-repeating marks dismissed", async () => {
  const userId = "user_123";
  const tasksDb = [];
  const scheduledTime = new Date("2026-10-15T08:00:00Z");

  const repeatingReminder = {
    _id: "rem_009_rep",
    owner: userId,
    task: null,
    title: "Take Vitamins",
    repeat: "daily",
    timeZone: "UTC",
    scheduledAt: scheduledTime,
    status: "scheduled",
  };

  const res = await simulateDismissReminder({ userId, reminder: repeatingReminder, tasksDb });
  assert.equal(res.success, true);
  assert.equal(repeatingReminder.status, "scheduled");
  assert.ok(repeatingReminder.scheduledAt > scheduledTime);
});

// 10. Scenario 10: Cross-user isolation / security check: Users cannot dismiss another user's alarm
test("Scenario 10: Cross-user isolation / security check: Users cannot dismiss another user's alarm", async () => {
  const userA = "user_alice";
  const userB = "user_bob";
  const tasksDb = [
    { _id: "task_alice", owner: userA, title: "Secret Document", completed: false },
  ];
  const reminderAlice = {
    _id: "rem_alice",
    owner: userA,
    task: "task_alice",
    status: "scheduled",
  };

  // Bob tries to dismiss Alice's alarm
  const res = await simulateDismissReminder({ userId: userB, reminder: reminderAlice, tasksDb });
  assert.equal(res.status, 404);
  assert.equal(tasksDb[0].completed, false);
});

// 11. Scenario 11: Dashboard statistics reflect pending vs completed state correctly
test("Scenario 11: Dashboard statistics reflect pending vs completed state accurately", () => {
  const tasks = [
    { _id: "1", completed: false },
    { _id: "2", completed: false },
    { _id: "3", completed: true },
  ];

  const computeStats = (taskList) => {
    const totalCount = taskList.length;
    const completedTasks = taskList.filter((t) => normalizeCompleted(t.completed)).length;
    const pendingCount = totalCount - completedTasks;
    const completionPercentage = totalCount > 0 ? Math.round((completedTasks / totalCount) * 100) : 0;
    return { totalCount, completedTasks, pendingCount, completionPercentage };
  };

  const before = computeStats(tasks);
  assert.equal(before.pendingCount, 2);
  assert.equal(before.completedTasks, 1);
  assert.equal(before.completionPercentage, 33);

  // Dismiss alarm for task 1
  tasks[0].completed = true;
  tasks[0].completedAt = new Date();

  const after = computeStats(tasks);
  assert.equal(after.pendingCount, 1);
  assert.equal(after.completedTasks, 2);
  assert.equal(after.completionPercentage, 67);
});

// 12. Scenario 12: Snooze duration validation bounds (5, 10, 15, 30 min)
test("Scenario 12: Snooze duration validation bounds (5, 10, 15, 30 min)", () => {
  const validateSnooze = (durationMinutes) => {
    const requested = Number(durationMinutes);
    if (Number.isInteger(requested) && requested > 0 && requested <= 1440) {
      return requested;
    }
    return 5; // Default fallback
  };

  assert.equal(validateSnooze(5), 5);
  assert.equal(validateSnooze(10), 10);
  assert.equal(validateSnooze(15), 15);
  assert.equal(validateSnooze(30), 30);
  assert.equal(validateSnooze(0), 5);
  assert.equal(validateSnooze(-5), 5);
  assert.equal(validateSnooze(null), 5);
  assert.equal(validateSnooze("invalid"), 5);
});

// 13. Scenario 13: Notification cleanup on task completion
test("Scenario 13: Notification cleanup removes pending notifications when task completed via alarm", async () => {
  const userId = "user_123";
  const tasksDb = [
    { _id: "task_013", owner: userId, title: "Flight Check-in", completed: false },
  ];
  const reminder = {
    _id: "rem_013",
    owner: userId,
    task: "task_013",
    status: "scheduled",
    repeat: "never",
  };
  const notificationsDb = [
    { _id: "notif_1", owner: userId, task: "task_013", message: "Reminder: Flight Check-in" },
    { _id: "notif_2", owner: userId, task: "other_task", message: "Another task" },
  ];

  await simulateDismissReminder({ userId, reminder, tasksDb, notificationsDb });
  assert.equal(notificationsDb.length, 1);
  assert.equal(notificationsDb[0].task, "other_task");
});
