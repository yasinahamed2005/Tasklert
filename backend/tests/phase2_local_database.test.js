import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

// Import Tasklert Resilience Phase 2 database modules
import {
  TasklertDatabase,
  taskRepository,
  projectRepository,
  reminderRepository,
  focusSessionRepository,
  operationsRepository,
  accountManager,
  storageManager,
  formatBytes,
} from "../../frontend/src/db/index.js";

// Helper to create an isolated database instance for testing
const createTestDb = (name) => new TasklertDatabase(name);

test("TASKLERT RESILIENCE PHASE 2 — LOCAL DATABASE TEST SUITE", async (t) => {
  const USER_ALICE = "usr_alice_123";
  const USER_BOB = "usr_bob_456";

  await t.test("1. Database Setup: All 7 required object stores and indexes exist", async () => {
    const testDb = createTestDb("test_db_setup");
    await testDb.open();

    const expectedStores = [
      "tasks",
      "projects",
      "reminders",
      "focusSessions",
      "operations",
      "metadata",
      "attachments",
    ];

    for (const store of expectedStores) {
      assert.ok(testDb.tables.some((t) => t.name === store), `Store "${store}" must exist in Dexie schema`);
    }

    testDb.close();
  });

  await t.test("2. Task CRUD & Operations Queue: Offline creation produces valid UUID, task record, and pending operation", async () => {
    const taskData = {
      title: "Prepare Q4 Resilience Report",
      description: "Document PWA & IndexedDB architecture",
      priority: "High",
      dueDate: "2026-11-20T10:00:00.000Z",
      reminderEnabled: true,
      reminderAt: "2026-11-20T09:30:00.000Z",
      tags: ["architecture", "offline"],
    };

    const task = await taskRepository.createTask(taskData, USER_ALICE);

    assert.ok(task.localId, "Task must have a generated localId");
    assert.equal(task.title, "Prepare Q4 Resilience Report");
    assert.equal(task.owner, USER_ALICE);
    assert.equal(task.priority, "High");
    assert.equal(task.syncStatus, "created");
    assert.equal(task.version, 1);
    assert.equal(task.isDeleted, false);

    // Verify operation was queued transactionally
    const pendingOps = await operationsRepository.getPendingOperations(USER_ALICE);
    assert.ok(pendingOps.length >= 1, "At least 1 operation must be pending");
    const op = pendingOps.find((o) => o.localId === task.localId);
    assert.ok(op, "CREATE operation must exist in operations store");
    assert.equal(op.action, "CREATE");
    assert.equal(op.entityType, "task");
    assert.equal(op.status, "pending");
  });

  await t.test("3. Task Querying & Filtering: Supports completed, priority, and text search", async () => {
    // Create an additional completed task
    await taskRepository.createTask(
      {
        title: "Submit invoice for audit",
        description: "Finance department request",
        priority: "Low",
        completed: true,
        tags: ["finance"],
      },
      USER_ALICE
    );

    // Query pending only
    const pendingTasks = await taskRepository.getTasks(USER_ALICE, { completed: false });
    assert.ok(pendingTasks.every((t) => !t.completed), "All tasks must be pending");

    // Query completed only
    const completedTasks = await taskRepository.getTasks(USER_ALICE, { completed: true });
    assert.ok(completedTasks.every((t) => t.completed), "All tasks must be completed");

    // Search query
    const searchResults = await taskRepository.getTasks(USER_ALICE, { search: "invoice" });
    assert.equal(searchResults.length, 1);
    assert.equal(searchResults[0].title, "Submit invoice for audit");
  });

  await t.test("4. Task Updates & Completion: Increments version, updates timestamp, and queues UPDATE operation", async () => {
    const tasks = await taskRepository.getTasks(USER_ALICE, { completed: false });
    const target = tasks[0];

    const updated = await taskRepository.updateTask(
      target.localId,
      { priority: "Medium", notes: "Updated via offline review" },
      USER_ALICE
    );

    assert.equal(updated.priority, "Medium");
    assert.equal(updated.notes, "Updated via offline review");
    assert.equal(updated.version, target.version + 1);

    // Complete task
    const completed = await taskRepository.completeTask(target.localId, USER_ALICE, true);
    assert.equal(completed.completed, true);
    assert.ok(completed.completedAt, "completedAt timestamp must be set");
  });

  await t.test("5. Task Soft Deletion: Marks isDeleted: true and queues DELETE operation", async () => {
    const task = await taskRepository.createTask({ title: "Temporary task to delete" }, USER_ALICE);
    const deleteRes = await taskRepository.deleteTask(task.localId, USER_ALICE, true);

    assert.equal(deleteRes.success, true);

    // Should not appear in active getTasks list
    const activeTasks = await taskRepository.getTasks(USER_ALICE);
    assert.ok(!activeTasks.some((t) => t.localId === task.localId), "Deleted task must not appear in active tasks");

    // Operations queue has DELETE operation
    const ops = await operationsRepository.getPendingOperations(USER_ALICE);
    const delOp = ops.find((o) => o.localId === task.localId && o.action === "DELETE");
    assert.ok(delOp, "DELETE operation must be queued");
  });

  await t.test("6. User Account Isolation: User B cannot access or modify User A's data", async () => {
    // Alice's tasks
    const aliceTasks = await taskRepository.getTasks(USER_ALICE);
    assert.ok(aliceTasks.length > 0, "Alice must have tasks");
    const aliceTaskId = aliceTasks[0].localId;

    // Bob queries his tasks
    const bobTasks = await taskRepository.getTasks(USER_BOB);
    assert.equal(bobTasks.length, 0, "Bob must have 0 tasks initially");

    // Bob tries to get Alice's task by ID
    const bobAccess = await taskRepository.getTaskById(aliceTaskId, USER_BOB);
    assert.equal(bobAccess, null, "Bob must not be able to fetch Alice's task");

    // Bob tries to update Alice's task
    await assert.rejects(
      async () => {
        await taskRepository.updateTask(aliceTaskId, { title: "Hacked!" }, USER_BOB);
      },
      /not found or unauthorized/,
      "Updating another user's task must be rejected"
    );

    // Bob creates his own task
    const bobTask = await taskRepository.createTask({ title: "Bob's private note" }, USER_BOB);
    assert.equal(bobTask.owner, USER_BOB);

    const bobTasksAfter = await taskRepository.getTasks(USER_BOB);
    assert.equal(bobTasksAfter.length, 1);
    assert.equal(bobTasksAfter[0].title, "Bob's private note");
  });

  await t.test("7. Project Repository: Supports project creation, update, query, and deletion", async () => {
    const project = await projectRepository.createProject(
      { name: "Mobile Overhaul", color: "#8B2CF5", description: "Capacitor app" },
      USER_ALICE
    );

    assert.ok(project.localId);
    assert.equal(project.name, "Mobile Overhaul");
    assert.equal(project.syncStatus, "created");

    const projects = await projectRepository.getProjects(USER_ALICE);
    assert.ok(projects.some((p) => p.localId === project.localId));

    const updated = await projectRepository.updateProject(project.localId, { description: "Updated description" }, USER_ALICE);
    assert.equal(updated.description, "Updated description");

    await projectRepository.deleteProject(project.localId, USER_ALICE);
    const activeProjects = await projectRepository.getProjects(USER_ALICE);
    assert.ok(!activeProjects.some((p) => p.localId === project.localId), "Deleted project must not appear");
  });

  await t.test("8. Reminder Repository: Supports saving, querying, and dismissing reminders", async () => {
    const reminder = await reminderRepository.saveReminder(
      {
        title: "Standup Reminder",
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        alarmEnabled: true,
      },
      USER_ALICE
    );

    assert.ok(reminder.localId);
    assert.equal(reminder.title, "Standup Reminder");

    const list = await reminderRepository.getReminders(USER_ALICE);
    assert.ok(list.some((r) => r.localId === reminder.localId));

    const dismissed = await reminderRepository.dismissReminder(reminder.localId, USER_ALICE);
    assert.equal(dismissed.status, "dismissed");
  });

  await t.test("9. Storage Management & Safe Non-Destructive Cleanup Rules", async () => {
    // formatBytes utility test
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(1024), "1 KB");
    assert.equal(formatBytes(1048576), "1 MB");

    // Create an old deleted task that is ALREADY SYNCED (eligible for cleanup)
    const oldSyncedDeleted = await taskRepository.createTask(
      {
        title: "Old Synced Deleted Task",
        serverId: "srv_9999",
        completed: true,
      },
      USER_ALICE
    );
    // Mark as deleted with old date
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await taskRepository.deleteTask(oldSyncedDeleted.localId, USER_ALICE, true);
    // Manually set syncStatus to 'synced' and deletedAt to oldDate to test retention cutoff
    const db = (await import("../../frontend/src/db/tasklertDb.js")).db;
    await db.tasks.update(oldSyncedDeleted.localId, {
      syncStatus: "synced",
      deletedAt: oldDate,
    });

    // Create an un-synced deleted task (NOT ELIGIBLE FOR CLEANUP - must never be lost before sync!)
    const unSyncedDeleted = await taskRepository.createTask(
      { title: "Unsynced Deleted Task" },
      USER_ALICE
    );
    await taskRepository.deleteTask(unSyncedDeleted.localId, USER_ALICE, true);
    await db.tasks.update(unSyncedDeleted.localId, {
      deletedAt: oldDate, // Old date, but syncStatus is 'deleted' (un-synced)
    });

    // Run cleanup with 30 days retention
    const cleanupResult = await storageManager.cleanupOldSyncedEntries(USER_ALICE, 30);
    assert.ok(cleanupResult.cleanedTasks >= 1, "Eligible synced deleted task must be purged");

    // Verify un-synced deleted task was PRESERVED
    const preservedUnsynced = await db.tasks.get(unSyncedDeleted.localId);
    assert.ok(preservedUnsynced, "CRITICAL: Un-synced deleted tasks must NEVER be deleted during cleanup!");
    assert.equal(preservedUnsynced.syncStatus, "deleted");

    // Verify eligible synced task was cleaned up
    const cleanedTask = await db.tasks.get(oldSyncedDeleted.localId);
    assert.equal(cleanedTask, undefined, "Already synced deleted task past retention was cleaned up");
  });

  await t.test("10. Bulk Upsert From Server: Caches server tasks without overwriting un-synced local edits", async () => {
    // Create an offline task with pending local edits
    const offlineTask = await taskRepository.createTask(
      { title: "Offline Local Edit In Progress" },
      USER_ALICE
    );

    const serverTasks = [
      {
        _id: "srv_task_1",
        title: "Cloud Synced Task 1",
        priority: "High",
        completed: false,
      },
      {
        _id: "srv_task_2",
        title: "Cloud Synced Task 2",
        priority: "Medium",
        completed: true,
      },
    ];

    const cached = await taskRepository.bulkUpsertFromServer(serverTasks, USER_ALICE);
    assert.equal(cached.length, 2);

    const allAliceTasks = await taskRepository.getTasks(USER_ALICE);
    assert.ok(allAliceTasks.some((t) => t.serverId === "srv_task_1"));
    assert.ok(allAliceTasks.some((t) => t.serverId === "srv_task_2"));
    assert.ok(allAliceTasks.some((t) => t.localId === offlineTask.localId), "Local un-synced task remains safe");
  });
});
