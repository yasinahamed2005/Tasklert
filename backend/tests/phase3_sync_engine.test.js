import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

// Models
import Task from "../models/taskModel.js";
import Project from "../models/projectModel.js";
import Reminder from "../models/reminderModel.js";
import SyncOperationLog from "../models/syncOperationLogModel.js";

// Controller functions
import {
  pushSync,
  pullSync,
  getSyncStatus,
} from "../controllers/syncController.js";

// Frontend DB
import {
  TasklertDatabase,
  taskRepository,
  operationsRepository,
  db,
} from "../../frontend/src/db/index.js";

// Helper to simulate Express req/res
const createMockReqRes = ({ user, body = {}, query = {}, headers = {} }) => {
  const req = {
    user: user || { _id: "507f191e810c19729de860ea", id: "507f191e810c19729de860ea" },
    body,
    query,
    headers,
  };

  const res = {
    statusCode: 200,
    responseData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.responseData = data;
      return this;
    },
    send(data) {
      this.responseData = data;
      return this;
    },
  };

  return { req, res };
};

test("TASKLERT RESILIENCE PHASE 3 — AUTOMATIC OFFLINE SYNCHRONIZATION ENGINE TEST SUITE", async (t) => {
  const USER_ALICE = "507f191e810c19729de860ea";
  const USER_BOB = "507f1f77bcf86cd799439011";

  // Mock in-memory Mongoose DB storage for tests where MongoDB daemon is offline
  const mockTasks = new Map();
  const mockProjects = new Map();
  const mockReminders = new Map();
  const mockLogs = new Map();

  // Stub Task, Project, Reminder & SyncOperationLog methods for robust in-memory testing
  const originalTaskFindOne = Task.findOne;
  const originalTaskCreate = Task.create;
  const originalTaskFind = Task.find;
  const originalTaskCount = Task.countDocuments;
  const originalProjectFind = Project.find;
  const originalReminderFind = Reminder.find;
  const originalLogFindOne = SyncOperationLog.findOne;
  const originalLogCreate = SyncOperationLog.create;

  t.before(() => {
    Task.findOne = (query) => {
      const exec = async () => {
        for (const t of mockTasks.values()) {
          let match = true;
          if (query.owner && String(t.owner) !== String(query.owner)) match = false;
          if (query._id && String(t._id) !== String(query._id)) match = false;
          if (query.localId && String(t.localId) !== String(query.localId)) match = false;
          if (match) {
            return {
              ...t,
              save: async function () {
                mockTasks.set(String(this._id), { ...this });
                return this;
              },
            };
          }
        }
        return null;
      };

      // Support chaining (.sort().select().lean())
      return {
        then: (resolve, reject) => exec().then(resolve, reject),
        sort: () => ({
          select: () => ({
            lean: exec,
          }),
        }),
      };
    };

    Task.create = async (doc) => {
      const _id = doc._id || `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const saved = {
        _id,
        ...doc,
        version: doc.version || 1,
        updatedAt: doc.updatedAt || new Date(),
        createdAt: doc.createdAt || new Date(),
      };
      mockTasks.set(String(_id), saved);
      return {
        ...saved,
        save: async function () {
          mockTasks.set(String(this._id), { ...this });
          return this;
        },
      };
    };

    Task.find = (query) => {
      const list = Array.from(mockTasks.values()).filter((t) => {
        if (query.owner && String(t.owner) !== String(query.owner)) return false;
        if (query.isDeleted === true && !t.isDeleted) return false;
        if (query.isDeleted && query.isDeleted.$ne === true && t.isDeleted) return false;
        if (query.updatedAt && query.updatedAt.$gt) {
          if (new Date(t.updatedAt) <= new Date(query.updatedAt.$gt)) return false;
        }
        return true;
      });

      return {
        sort: () => ({
          limit: () => ({
            lean: async () => list,
          }),
        }),
        select: () => ({
          lean: async () => list.map((t) => ({ _id: t._id })),
        }),
      };
    };

    Project.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => Array.from(mockProjects.values()),
        }),
      }),
      select: () => ({
        lean: async () => [],
      }),
    });

    Reminder.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => Array.from(mockReminders.values()),
        }),
      }),
      select: () => ({
        lean: async () => [],
      }),
    });

    Task.countDocuments = async (query) => {
      let count = 0;
      for (const t of mockTasks.values()) {
        if (query.owner && String(t.owner) !== String(query.owner)) continue;
        if (query.isDeleted && query.isDeleted.$ne === true && t.isDeleted) continue;
        count++;
      }
      return count;
    };

    SyncOperationLog.findOne = async (query) => {
      for (const log of mockLogs.values()) {
        if (log.operationId === query.operationId && String(log.userId) === String(query.userId)) {
          return log;
        }
      }
      return null;
    };

    SyncOperationLog.create = async (doc) => {
      const id = doc.operationId || `log_${Date.now()}`;
      mockLogs.set(id, doc);
      return doc;
    };
  });

  t.after(() => {
    Task.findOne = originalTaskFindOne;
    Task.create = originalTaskCreate;
    Task.find = originalTaskFind;
    Task.countDocuments = originalTaskCount;
    Project.find = originalProjectFind;
    Reminder.find = originalReminderFind;
    SyncOperationLog.findOne = originalLogFindOne;
    SyncOperationLog.create = originalLogCreate;
  });

  await t.test("1. Push Sync: Offline task creation syncs to backend and returns applied status", async () => {
    const op = {
      operationId: "op_create_001",
      entityType: "task",
      entityId: "local_task_101",
      action: "CREATE",
      payload: {
        title: "Complete Phase 3 Sync Engine",
        priority: "High",
        dueDate: "2026-11-20T12:00:00Z",
        completed: false,
      },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      body: { deviceId: "dev_alice_lap", operations: [op] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.responseData.success, true);
    assert.equal(res.responseData.results.length, 1);

    const result = res.responseData.results[0];
    assert.equal(result.operationId, "op_create_001");
    assert.equal(result.status, "applied");
    assert.ok(result.serverId, "Must return created MongoDB serverId");
    assert.equal(result.version, 1);

    // Verify task exists in mock database
    const stored = mockTasks.get(result.serverId);
    assert.ok(stored);
    assert.equal(stored.title, "Complete Phase 3 Sync Engine");
    assert.equal(stored.owner, USER_ALICE);
  });

  await t.test("2. Push Sync Idempotency: Retrying the same operationId does NOT create duplicate tasks", async () => {
    const initialCount = mockTasks.size;

    // Retry sending exact same op_create_001
    const duplicateOp = {
      operationId: "op_create_001",
      entityType: "task",
      entityId: "local_task_101",
      action: "CREATE",
      payload: {
        title: "Complete Phase 3 Sync Engine",
      },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      body: { deviceId: "dev_alice_lap", operations: [duplicateOp] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.responseData.results[0].status, "already_processed");
    assert.equal(mockTasks.size, initialCount, "Database must not create duplicate records");
  });

  await t.test("3. Push Sync: Offline task update increments server version and updates fields", async () => {
    // Get serverId of created task
    const [taskId] = mockTasks.keys();

    const updateOp = {
      operationId: "op_update_002",
      entityType: "task",
      entityId: "local_task_101",
      action: "UPDATE",
      payload: {
        serverId: taskId,
        priority: "Medium",
        notes: "Updated during flight with no internet",
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      body: { deviceId: "dev_alice_lap", operations: [updateOp] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    const result = res.responseData.results[0];
    assert.equal(result.status, "applied");
    assert.equal(result.version, 2);

    const stored = mockTasks.get(taskId);
    assert.equal(stored.priority, "Medium");
    assert.equal(stored.notes, "Updated during flight with no internet");
    assert.equal(stored.version, 2);
  });

  await t.test("4. Push Sync: Offline completion sets completed: true and completedAt timestamp", async () => {
    const [taskId] = mockTasks.keys();

    const completeOp = {
      operationId: "op_complete_003",
      entityType: "task",
      entityId: "local_task_101",
      action: "UPDATE",
      payload: {
        serverId: taskId,
        completed: true,
        version: 2,
        updatedAt: new Date().toISOString(),
      },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      body: { deviceId: "dev_alice_lap", operations: [completeOp] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    const stored = mockTasks.get(taskId);
    assert.equal(stored.completed, true);
    assert.ok(stored.completedAt);
  });

  await t.test("5. Conflict Detection: Server detects conflicting edit from older client version", async () => {
    const [taskId] = mockTasks.keys();

    // Simulate Device B updated the task on server to version 4 with new timestamp
    const serverTask = mockTasks.get(taskId);
    serverTask.version = 4;
    serverTask.updatedAt = new Date(Date.now() + 5000); // 5 seconds ahead
    serverTask.title = "Device B Authoritative Title";
    mockTasks.set(taskId, serverTask);

    // Device A attempts to push an update based on stale version 1
    const staleOp = {
      operationId: "op_stale_004",
      entityType: "task",
      entityId: "local_task_101",
      action: "UPDATE",
      payload: {
        serverId: taskId,
        title: "Device A Stale Title",
        version: 1, // Stale!
        updatedAt: new Date(Date.now() - 60000).toISOString(),
      },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      body: { deviceId: "dev_alice_lap", operations: [staleOp] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    const result = res.responseData.results[0];
    assert.equal(result.status, "conflict", "Must report version conflict");
    assert.ok(result.serverEntity, "Must include server version snapshot");
    assert.equal(result.serverEntity.title, "Device B Authoritative Title");
  });

  await t.test("6. User Ownership Isolation: User B cannot modify or delete User A's tasks", async () => {
    const [aliceTaskId] = mockTasks.keys();

    const maliciousOp = {
      operationId: "op_hack_005",
      entityType: "task",
      entityId: "local_task_101",
      action: "DELETE",
      payload: { serverId: aliceTaskId },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_BOB, id: USER_BOB }, // Bob!
      body: { deviceId: "dev_bob_hacker", operations: [maliciousOp] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    // User A's task was NOT deleted
    const aliceTask = mockTasks.get(aliceTaskId);
    assert.notEqual(aliceTask.isDeleted, true, "User A task must remain untouched");
  });

  await t.test("7. Push Sync: Soft deletion marks isDeleted: true and deletedAt timestamp", async () => {
    const [taskId] = mockTasks.keys();

    const deleteOp = {
      operationId: "op_delete_006",
      entityType: "task",
      entityId: "local_task_101",
      action: "DELETE",
      payload: { serverId: taskId },
    };

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      body: { deviceId: "dev_alice_lap", operations: [deleteOp] },
    });

    await pushSync(req, res);

    assert.equal(res.statusCode, 200);
    const stored = mockTasks.get(taskId);
    assert.equal(stored.isDeleted, true);
    assert.ok(stored.deletedAt);
  });

  await t.test("8. Pull Sync: Returns modified entities and soft-deleted IDs since timestamp", async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();

    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
      query: { since: pastTime, limit: 50 },
    });

    await pullSync(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.responseData.success, true);
    assert.ok(res.responseData.changes);
    assert.ok(Array.isArray(res.responseData.changes.deleted.tasks));
  });

  await t.test("9. Sync Status: Returns active task counts and server diagnostics", async () => {
    const { req, res } = createMockReqRes({
      user: { _id: USER_ALICE, id: USER_ALICE },
    });

    await getSyncStatus(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.responseData.success, true);
    assert.equal(res.responseData.userId, USER_ALICE);
    assert.ok(res.responseData.serverTime);
  });

  await t.test("10. Frontend Sync Queue Integration: Queueing offline task produces valid operationId and deviceId", async () => {
    const task = await taskRepository.createTask(
      { title: "Offline queued task for Phase 3 sync" },
      USER_ALICE
    );

    const pending = await operationsRepository.getPendingOperations(USER_ALICE);
    const op = pending.find((o) => o.localId === task.localId);

    assert.ok(op, "Pending operation must exist in operations table");
    assert.ok(op.operationId, "Operation must have operationId");
    assert.ok(op.deviceId, "Operation must have client deviceId");
    assert.equal(op.action, "CREATE");
    assert.equal(op.status, "pending");
  });
});
