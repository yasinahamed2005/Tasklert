import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirroring the pure logic of localAnalytics for Node test runner
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

const parseLocalRange = (range = "30d", customStart, customEnd) => {
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

const computeLocalAnalytics = (tasks = [], focusSessions = [], range = "30d", customStart, customEnd) => {
  const { start, end } = parseLocalRange(range, customStart, customEnd);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const startTime = start.getTime();
  const endTime = end.getTime();

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

describe("Phase 4: Offline Feature Integration Tests", () => {
  describe("Local Analytics Engine", () => {
    it("should compute accurate completion rate and status breakdown offline", () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const pastWeek = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const mockTasks = [
        {
          _id: "t1",
          title: "Complete offline tests",
          priority: "High",
          completed: "Yes",
          createdAt: pastWeek.toISOString(),
          completedAt: yesterday.toISOString(),
          dueDate: yesterday.toISOString(),
        },
        {
          _id: "t2",
          title: "Implement PWA sync",
          priority: "High",
          completed: false,
          createdAt: pastWeek.toISOString(),
          dueDate: "2020-01-01T00:00:00.000Z", // overdue
        },
        {
          _id: "t3",
          title: "Polish styling",
          priority: "Medium",
          completed: false,
          createdAt: yesterday.toISOString(),
          dueDate: new Date(now.getTime() + 86400000).toISOString(),
        },
      ];

      const mockSessions = [
        {
          startedAt: yesterday.toISOString(),
          actualElapsedSeconds: 1500, // 25 min
        },
        {
          startedAt: pastWeek.toISOString(),
          actualElapsedSeconds: 3000, // 50 min
        },
      ];

      const result = computeLocalAnalytics(mockTasks, mockSessions, "7d");

      assert.equal(result.isOffline, true);
      assert.equal(result.hasActivity, true);
      assert.equal(result.summary.createdInPeriod, 3);
      assert.equal(result.summary.completedInPeriod, 1);
      assert.equal(result.summary.pendingInPeriod, 2);
      assert.equal(result.summary.pendingTasks, 2);
      assert.equal(result.summary.overdueTasks, 1);
      assert.equal(result.summary.totalLifetimeTasks, 3);
      assert.equal(result.summary.completionRate, 33); // 1 / (1 + 2) * 100 = 33%
      assert.equal(result.summary.focusMinutes, 75); // 25 + 50 = 75 min
      assert.equal(result.priorityBreakdown.High.total, 2);
      assert.equal(result.priorityBreakdown.High.completed, 1);
      assert.equal(result.priorityBreakdown.High.pending, 1);
      assert.equal(result.priorityBreakdown.Medium.total, 1);
      assert.equal(result.priorityBreakdown.Medium.pending, 1);
      assert.ok(result.timeline.length >= 7);
    });

    it("should handle empty state gracefully without errors", () => {
      const result = computeLocalAnalytics([], [], "30d");
      assert.equal(result.isOffline, true);
      assert.equal(result.hasActivity, false);
      assert.equal(result.summary.createdInPeriod, 0);
      assert.equal(result.summary.completedInPeriod, 0);
      assert.equal(result.summary.completionRate, 0);
      assert.equal(result.summary.focusMinutes, 0);
    });
  });

  describe("Attachment Security & Offline Validation", () => {
    const DISALLOWED_EXTENSIONS = [
      ".exe", ".bat", ".cmd", ".sh", ".vbs", ".msi", ".dll", ".scr", ".pif", ".application", ".gadget", ".com", ".jar"
    ];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    const validateAttachment = (file) => {
      if (!file) return { valid: false, error: "No file selected." };
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: "File size exceeds 10MB limit. Please choose a smaller file." };
      }
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (DISALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: `Executable and script files (${ext}) are not allowed for security reasons.` };
      }
      return { valid: true };
    };

    it("should accept valid documents, images, and audio under 10MB", () => {
      const validPdf = { name: "spec.pdf", size: 2 * 1024 * 1024 };
      const validPng = { name: "screenshot.png", size: 500 * 1024 };
      const validAudio = { name: "ringtone.mp3", size: 4 * 1024 * 1024 };

      assert.equal(validateAttachment(validPdf).valid, true);
      assert.equal(validateAttachment(validPng).valid, true);
      assert.equal(validateAttachment(validAudio).valid, true);
    });

    it("should reject files exceeding 10MB limit", () => {
      const bigFile = { name: "video.mp4", size: 12 * 1024 * 1024 };
      const result = validateAttachment(bigFile);
      assert.equal(result.valid, false);
      assert.match(result.error, /exceeds 10MB limit/);
    });

    it("should reject executable and dangerous file types", () => {
      const dangerousFiles = [
        { name: "setup.exe", size: 1024 },
        { name: "script.bat", size: 500 },
        { name: "payload.sh", size: 200 },
        { name: "malware.vbs", size: 100 },
        { name: "app.msi", size: 2048 },
        { name: "library.dll", size: 4096 },
        { name: "runner.cmd", size: 100 },
        { name: "archive.jar", size: 1024 },
      ];

      dangerousFiles.forEach((f) => {
        const res = validateAttachment(f);
        assert.equal(res.valid, false);
        assert.match(res.error, /not allowed for security reasons/);
      });
    });
  });
});
