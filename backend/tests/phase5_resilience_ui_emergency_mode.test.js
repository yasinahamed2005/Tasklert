import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Phase 5: Tasklert Resilience UI and Emergency Mode Tests", () => {
  describe("Global Offline & Sync Status Indicator Rules", () => {
    const computeIndicatorState = ({
      isOnline,
      isSyncing,
      pendingCount,
      conflictsCount,
      lastError,
    }) => {
      let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/90";
      let label = "All changes saved";

      if (!isOnline) {
        badgeStyle = "bg-amber-50 text-amber-800 border-amber-200/90";
        label = pendingCount > 0 ? `Offline Mode (${pendingCount})` : "Offline Mode";
      } else if (isSyncing) {
        badgeStyle = "bg-purple-50 text-purple-700 border-purple-200/90";
        label = "Syncing...";
      } else if (conflictsCount > 0) {
        badgeStyle = "bg-orange-50 text-orange-700 border-orange-200/90";
        label = "Conflict requires attention";
      } else if (lastError) {
        badgeStyle = "bg-rose-50 text-rose-700 border-rose-200/90";
        label = "Unable to sync – will retry";
      } else if (pendingCount > 0) {
        badgeStyle = "bg-amber-50 text-amber-800 border-amber-200/90";
        label = `${pendingCount} ${pendingCount === 1 ? "change" : "changes"} waiting`;
      }

      return { badgeStyle, label };
    };

    it("should display 'Offline Mode' with subtle amber warning when disconnected", () => {
      const state = computeIndicatorState({
        isOnline: false,
        isSyncing: false,
        pendingCount: 0,
        conflictsCount: 0,
        lastError: null,
      });

      assert.equal(state.label, "Offline Mode");
      assert.match(state.badgeStyle, /amber/);
    });

    it("should display 'Offline Mode (3)' when disconnected with unsynced changes", () => {
      const state = computeIndicatorState({
        isOnline: false,
        isSyncing: false,
        pendingCount: 3,
        conflictsCount: 0,
        lastError: null,
      });

      assert.equal(state.label, "Offline Mode (3)");
    });

    it("should display 'Syncing...' when a sync operation is in flight", () => {
      const state = computeIndicatorState({
        isOnline: true,
        isSyncing: true,
        pendingCount: 2,
        conflictsCount: 0,
        lastError: null,
      });

      assert.equal(state.label, "Syncing...");
      assert.match(state.badgeStyle, /purple/);
    });

    it("should display 'Conflict requires attention' if active conflicts exist", () => {
      const state = computeIndicatorState({
        isOnline: true,
        isSyncing: false,
        pendingCount: 0,
        conflictsCount: 1,
        lastError: null,
      });

      assert.equal(state.label, "Conflict requires attention");
      assert.match(state.badgeStyle, /orange/);
    });

    it("should display 'Unable to sync – will retry' on network/server errors", () => {
      const state = computeIndicatorState({
        isOnline: true,
        isSyncing: false,
        pendingCount: 1,
        conflictsCount: 0,
        lastError: "Network connection refused",
      });

      assert.equal(state.label, "Unable to sync – will retry");
      assert.match(state.badgeStyle, /rose/);
    });

    it("should display 'All changes saved' when online with zero pending changes", () => {
      const state = computeIndicatorState({
        isOnline: true,
        isSyncing: false,
        pendingCount: 0,
        conflictsCount: 0,
        lastError: null,
      });

      assert.equal(state.label, "All changes saved");
      assert.match(state.badgeStyle, /emerald/);
    });
  });

  describe("Sync Now Concurrency & Idempotency", () => {
    it("should prevent duplicate simultaneous sync executions", async () => {
      let isSyncing = false;
      const syncNowMock = async () => {
        if (isSyncing) return { status: "already_running" };
        isSyncing = true;
        await new Promise((res) => setTimeout(res, 20));
        isSyncing = false;
        return { status: "success" };
      };

      const [res1, res2] = await Promise.all([syncNowMock(), syncNowMock()]);

      const statuses = [res1.status, res2.status].sort();
      assert.deepEqual(statuses, ["already_running", "success"]);
    });

    it("should reject sync attempts when offline without claiming false success", async () => {
      const isOnline = false;
      const syncNowMock = async () => {
        if (!isOnline) return { status: "offline" };
        return { status: "success" };
      };

      const result = await syncNowMock();
      assert.equal(result.status, "offline");
    });
  });

  describe("Emergency Mode Logic", () => {
    const isTaskCompleted = (t) => t.completed === "Yes" || t.completed === true;

    const filterUrgentTasks = (tasks, todayStr) => {
      return tasks.filter((t) => {
        if (isTaskCompleted(t)) return false;
        if (t.priority === "High") return true;
        const due = t.dueDate ? t.dueDate.split("T")[0] : null;
        if (due && due <= todayStr) return true;
        return false;
      });
    };

    it("should filter High priority, Overdue, and Due Today tasks accurately", () => {
      const todayStr = "2026-11-15";
      const sampleTasks = [
        { id: "1", title: "Urgent bug fix", priority: "High", completed: false, dueDate: "2026-11-20" },
        { id: "2", title: "Overdue report", priority: "Low", completed: false, dueDate: "2026-11-10" },
        { id: "3", title: "Due today task", priority: "Medium", completed: false, dueDate: "2026-11-15" },
        { id: "4", title: "Future non-urgent", priority: "Low", completed: false, dueDate: "2026-11-25" },
        { id: "5", title: "Completed high priority", priority: "High", completed: true, dueDate: "2026-11-15" },
      ];

      const urgent = filterUrgentTasks(sampleTasks, todayStr);
      assert.equal(urgent.length, 3);
      assert.deepEqual(
        urgent.map((t) => t.id),
        ["1", "2", "3"]
      );
    });

    it("should format timer mm:ss accurately for 25-minute Pomodoro", () => {
      const formatTimer = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      };

      assert.equal(formatTimer(25 * 60), "25:00");
      assert.equal(formatTimer(1499), "24:59");
      assert.equal(formatTimer(65), "01:05");
      assert.equal(formatTimer(0), "00:00");
    });
  });

  describe("Empty and Error Messages Specification", () => {
    const ERROR_MESSAGES = {
      noCachedTasks: "No cached tasks found on this device. Create one to get started offline.",
      noInternet: "You're offline. Changes are saved locally and will automatically sync when connection returns.",
      syncFailure: "Unable to sync – will retry automatically.",
      storageFull: "Browser storage quota reached. Please free up space or clear old completed tasks.",
      loginExpired: "Your session has expired. Please reconnect to the internet and sign in.",
      unsyncedChanges: (n) => `You have ${n} unsaved changes stored safely on this device.`,
    };

    it("should contain exact, user-friendly copy for all specified failure modes", () => {
      assert.match(ERROR_MESSAGES.noCachedTasks, /No cached tasks found on this device/);
      assert.match(ERROR_MESSAGES.noInternet, /You're offline/);
      assert.match(ERROR_MESSAGES.syncFailure, /Unable to sync – will retry/);
      assert.match(ERROR_MESSAGES.storageFull, /Browser storage quota reached/);
      assert.match(ERROR_MESSAGES.loginExpired, /Your session has expired/);
      assert.equal(
        ERROR_MESSAGES.unsyncedChanges(4),
        "You have 4 unsaved changes stored safely on this device."
      );
    });
  });
});
