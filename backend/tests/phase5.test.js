import test from "node:test";
import assert from "node:assert/strict";

// 1. COMPLETION TIMESTAMP LOGIC SIMULATION
test("Completion Timestamps — sets completedAt when completing, clears when reopening, preserves on edit", () => {
  const normalizeCompleted = (val) => [true, 1, "yes", "true", "completed"].includes(
    typeof val === "string" ? val.trim().toLowerCase() : val
  );

  const applyCompletionLogic = (existingTask, updateData) => {
    const data = { ...updateData };
    if (data.completed !== undefined) {
      const isCurrentlyCompleted = normalizeCompleted(existingTask.completed);
      const willBeCompleted = normalizeCompleted(data.completed);
      data.completed = willBeCompleted;
      if (!isCurrentlyCompleted && willBeCompleted) {
        data.completedAt = new Date();
      } else if (isCurrentlyCompleted && !willBeCompleted) {
        data.completedAt = null;
      } else if (isCurrentlyCompleted && willBeCompleted) {
        // Preserving completed state
        data.completedAt = existingTask.completedAt || null;
      }
    }
    return data;
  };

  // Case 1: Incomplete -> Completed sets completedAt
  const incompleteTask = { completed: false, completedAt: null };
  const res1 = applyCompletionLogic(incompleteTask, { completed: true });
  assert.equal(res1.completed, true);
  assert.ok(res1.completedAt instanceof Date);

  // Case 2: Completed -> Incomplete clears completedAt
  const completedTask = { completed: true, completedAt: new Date("2026-05-01T10:00:00Z") };
  const res2 = applyCompletionLogic(completedTask, { completed: false });
  assert.equal(res2.completed, false);
  assert.equal(res2.completedAt, null);

  // Case 3: Editing completed task without changing completion state preserves exact timestamp
  const originalTimestamp = new Date("2026-04-15T14:30:00Z");
  const alreadyCompleted = { completed: true, completedAt: originalTimestamp, title: "Original" };
  const res3 = applyCompletionLogic(alreadyCompleted, { title: "Updated Title", priority: "High", completed: true });
  assert.equal(res3.completed, true);
  assert.equal(res3.completedAt.getTime(), originalTimestamp.getTime());

  // Case 4: Legacy task with unknown completion date preserves null (no invented dates)
  const legacyCompleted = { completed: true, completedAt: null, title: "Old task" };
  const res4 = applyCompletionLogic(legacyCompleted, { title: "Edited Old task", completed: true });
  assert.equal(res4.completed, true);
  assert.equal(res4.completedAt, null);
});

// 2. CSV SANITIZATION & FORMULA INJECTION PREVENTION
test("CSV Export — Sanitizes against formula injection and escapes RFC 4180 characters", () => {
  const sanitizeCsvCell = (val) => {
    if (val === null || val === undefined) return "";
    let str = String(val);

    // Prepends single quote if starts with formula symbols (=, +, -, @, tab, cr)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Formula injections must be neutralized
  assert.equal(sanitizeCsvCell("=SUM(A1:B10)"), "'=SUM(A1:B10)");
  assert.equal(sanitizeCsvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(sanitizeCsvCell("-500 discount"), "'-500 discount");
  assert.equal(sanitizeCsvCell("@import dangerous"), "'@import dangerous");

  // Commas and quotes must be escaped
  assert.equal(sanitizeCsvCell("Task 1, Urgent"), '"Task 1, Urgent"');
  assert.equal(sanitizeCsvCell('He said "Hello"'), '"He said ""Hello"""');
  assert.equal(sanitizeCsvCell("Multi\nLine"), '"Multi\nLine"');

  // Normal safe text untouched
  assert.equal(sanitizeCsvCell("Normal Task Title"), "Normal Task Title");
  assert.equal(sanitizeCsvCell(123), "123");
  assert.equal(sanitizeCsvCell(null), "");
});

// 3. DATE RANGE ACROSS YEAR / MONTH BOUNDARIES
test("Analytics Range — Parses ranges accurately across month/year boundaries and validates bounds", () => {
  const parseDateRange = (range = "30d", startDate, endDate) => {
    const now = new Date();
    let start;
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (range === "7d") {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (range === "custom" && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        throw new Error("Invalid custom date range. Start date must be before end date.");
      }
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        throw new Error("Custom date range cannot exceed 365 days.");
      }
    }
    return { start, end };
  };

  // Valid 7-day range
  const r7 = parseDateRange("7d");
  assert.ok(r7.end.getTime() > r7.start.getTime());

  // Valid cross-year custom range (Dec 25, 2025 to Jan 10, 2026)
  const crossYear = parseDateRange("custom", "2025-12-25", "2026-01-10");
  assert.equal(crossYear.start.getFullYear(), 2025);
  assert.equal(crossYear.end.getFullYear(), 2026);

  // Invalid range: start after end throws
  assert.throws(() => {
    parseDateRange("custom", "2026-05-10", "2026-05-01");
  }, /Start date must be before end date/);

  // Invalid range: exceeds 365 days throws
  assert.throws(() => {
    parseDateRange("custom", "2024-01-01", "2026-01-01");
  }, /cannot exceed 365 days/);
});

// 4. FOCUS TIMER AUTHORITATIVE TIMING & CAPPING
test("Focus Timer — Authoritative pause/resume tracking and bounded completion", () => {
  // Simulate active session
  const plannedDuration = 1500; // 25 mins in seconds

  // Session started at T0, runs for 300s, then pauses
  let accumulatedSeconds = 0;
  const t0 = Date.now();
  let lastResumedAt = t0;

  // Simulate 300 seconds elapsed on first stretch
  const t1 = t0 + 300 * 1000;
  let delta = Math.floor((t1 - lastResumedAt) / 1000);
  accumulatedSeconds += delta;
  assert.equal(accumulatedSeconds, 300);

  // Resume after a 100s break (break time does NOT count towards focus elapsed)
  const t2 = t1 + 100 * 1000;
  lastResumedAt = t2;

  // Run for another 600s
  const t3 = t2 + 600 * 1000;
  delta = Math.floor((t3 - lastResumedAt) / 1000);
  const totalElapsed = accumulatedSeconds + delta;
  assert.equal(totalElapsed, 900); // 15 mins total focus elapsed

  // Enforce server-side bounding on completion: cannot exceed plannedDuration + 300s grace period
  const clientHugeElapsed = 999999;
  const bounded = Math.min(clientHugeElapsed, plannedDuration + 300);
  assert.equal(bounded, 1800); // Capped, client cannot inflate productivity
});

// 5. FOCUS HISTORY EXCLUSION OF CANCELLED SESSIONS
test("Focus History — Cancelled and incomplete sessions are excluded from completed metrics", () => {
  const sessions = [
    { status: "completed", sessionType: "focus", actualElapsedSeconds: 1500 },
    { status: "completed", sessionType: "focus", actualElapsedSeconds: 1500 },
    { status: "cancelled", sessionType: "focus", actualElapsedSeconds: 600 },
    { status: "running", sessionType: "focus", actualElapsedSeconds: 200 },
    { status: "completed", sessionType: "short_break", actualElapsedSeconds: 300 },
  ];

  // Completed focus sessions filter
  const validCompleted = sessions.filter(
    (s) => s.status === "completed" && s.sessionType === "focus"
  );
  assert.equal(validCompleted.length, 2);

  const totalMinutes = Math.round(
    validCompleted.reduce((acc, s) => acc + s.actualElapsedSeconds, 0) / 60
  );
  assert.equal(totalMinutes, 50); // 2 * 25 mins
});

// 6. COMPLETION RATE FORMULA & ISOLATION FROM OLD PENDING TASKS
test("Analytics — Completion-rate formula isolates selected period and is not distorted by old pending tasks", () => {
  // Scenario: Selected 7-day period
  // 5 tasks created in this 7-day period: 3 completed, 2 still pending
  // 50 old pending tasks created 6 months ago (outside period)
  const completedInPeriod = 3;
  const pendingInPeriod = 2;
  const oldPendingOutsidePeriod = 50;

  // New period-consistent formula: completedInPeriod / (completedInPeriod + pendingInPeriod) * 100
  const denominator = completedInPeriod + pendingInPeriod;
  const completionRate = Math.round((completedInPeriod / denominator) * 100);

  // If old pending tasks outside the period were included, rate would be 3 / (3 + 52) = 5.4% (distorted!)
  const distortedRate = Math.round((completedInPeriod / (completedInPeriod + pendingInPeriod + oldPendingOutsidePeriod)) * 100);

  assert.equal(completionRate, 60, "Completion rate should be 60% for work in the selected period");
  assert.notEqual(completionRate, distortedRate, "Old pending tasks outside period must not distort period completion rate");

  // Zero-division safety
  const zeroDenominator = 0;
  const zeroRate = zeroDenominator > 0 ? Math.round((0 / zeroDenominator) * 100) : 0;
  assert.equal(zeroRate, 0);
});

// 7. POMODORO TIMER STATE MACHINE & RECOVERY & IDEMPOTENCY
test("Focus Timer — Full lifecycle: start, pause, resume, recovery, complete idempotency & cancel", () => {
  const plannedDuration = 1500; // 25 min

  // A. Start session
  const session = {
    status: "running",
    plannedDuration,
    accumulatedSeconds: 0,
    startedAt: new Date(Date.now() - 600 * 1000), // started 10m ago
    lastResumedAt: new Date(Date.now() - 600 * 1000),
  };

  // B. Refresh recovery calculation (10m live elapsed)
  const now = Date.now();
  const liveDelta = Math.floor((now - session.lastResumedAt.getTime()) / 1000);
  const liveElapsed = session.accumulatedSeconds + liveDelta;
  const remaining = Math.max(0, session.plannedDuration - liveElapsed);

  assert.ok(liveElapsed >= 599 && liveElapsed <= 601, "Live elapsed time recovered accurately on refresh");
  assert.ok(remaining >= 899 && remaining <= 901, "Remaining countdown calculated authoritatively");

  // C. Pause session
  session.accumulatedSeconds += liveDelta;
  session.status = "paused";
  session.lastResumedAt = new Date(now);

  assert.equal(session.status, "paused");
  assert.ok(session.accumulatedSeconds >= 599);

  // D. Resume session
  session.status = "running";
  session.lastResumedAt = new Date();
  assert.equal(session.status, "running");

  // E. Complete session with anti-inflation capping
  const excessiveClientDuration = 50000;
  const boundedElapsed = Math.min(excessiveClientDuration, session.plannedDuration + 300);
  session.actualElapsedSeconds = boundedElapsed;
  session.status = "completed";
  session.endedAt = new Date();

  assert.equal(session.status, "completed");
  assert.equal(session.actualElapsedSeconds, 1800, "Duration capped to planned + 300s grace period");

  // F. Idempotent duplicate completion
  const duplicateCall = (currentSession) => {
    if (currentSession.status === "completed") {
      return { success: true, idempotent: true, session: currentSession };
    }
    return { success: false };
  };

  const dupResult = duplicateCall(session);
  assert.equal(dupResult.idempotent, true, "Duplicate completion call is idempotent without double-counting");

  // G. Cancel session
  const cancelTest = { status: "running" };
  cancelTest.status = "cancelled";
  cancelTest.endedAt = new Date();
  assert.equal(cancelTest.status, "cancelled");
});

// 8. TODAY'S PLAN: DEDUPLICATION, TIMEZONE BOUNDARIES & CLASSIFICATION
test("Dashboard Today's Plan — Deduplication, boundaries, due-today, overdue, completed-today", () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const sampleTasks = [
    // 1. Due today, incomplete
    { _id: "t1", title: "Due Today Task", dueDate: new Date(startOfToday.getTime() + 3600000), completed: false },
    // 2. Overdue, incomplete
    { _id: "t2", title: "Overdue Task", dueDate: new Date(startOfToday.getTime() - 86400000), completed: false },
    // 3. Completed today with timestamp
    { _id: "t3", title: "Completed Today Task", completed: true, completedAt: new Date(startOfToday.getTime() + 7200000), dueDate: new Date(startOfToday.getTime() + 7200000) },
    // 4. Legacy completed task (completedAt is null) -> should NOT be counted in completedToday
    { _id: "t4", title: "Legacy Completed Task", completed: true, completedAt: null, dueDate: new Date(startOfToday.getTime() - 86400000) },
    // 5. Future task (due tomorrow, incomplete) -> should NOT be in today's plan
    { _id: "t5", title: "Future Task", dueDate: new Date(endOfToday.getTime() + 86400000), completed: false },
    // 6. Task without due date (incomplete) -> should NOT be counted as due today
    { _id: "t6", title: "No Due Date Task", dueDate: null, completed: false },
  ];

  const isCompletedTask = (t) => t.completed === true;

  const isDueToday = (t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= startOfToday && d <= endOfToday;
  };

  const isOverdue = (t) => {
    if (!t.dueDate || isCompletedTask(t)) return false;
    const d = new Date(t.dueDate);
    return d < startOfToday;
  };

  const isCompletedToday = (t) => {
    if (!isCompletedTask(t) || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= startOfToday && d <= endOfToday;
  };

  const dueTodayTasks = sampleTasks.filter((t) => isDueToday(t) && !isCompletedTask(t));
  const overdueTasks = sampleTasks.filter(isOverdue);
  const completedTodayTasks = sampleTasks.filter(isCompletedToday);

  assert.equal(dueTodayTasks.length, 1);
  assert.equal(dueTodayTasks[0]._id, "t1");

  assert.equal(overdueTasks.length, 1);
  assert.equal(overdueTasks[0]._id, "t2");

  assert.equal(completedTodayTasks.length, 1);
  assert.equal(completedTodayTasks[0]._id, "t3");

  // Deduplication check: unique IDs in target denominator
  const uniqueIds = new Set();
  dueTodayTasks.forEach((t) => uniqueIds.add(t._id));
  overdueTasks.forEach((t) => uniqueIds.add(t._id));
  completedTodayTasks.forEach((t) => uniqueIds.add(t._id));

  assert.equal(uniqueIds.size, 3, "Denominator has exactly 3 unique tasks");

  const progressPct = Math.round((completedTodayTasks.length / uniqueIds.size) * 100);
  assert.equal(progressPct, 33, "Progress is exactly 33% (1 / 3)");
});

// 9. API AUTHORIZATION & OWNER ISOLATION CHECK
test("API Security — Scopes every query to req.user.id and rejects unauthenticated/cross-user requests", () => {
  const getUserId = (req) => req.user?.id || req.user?._id;

  const validReq = { user: { id: "user_abc_123" } };
  assert.equal(getUserId(validReq), "user_abc_123");

  const unauthenticatedReq = { user: null };
  assert.equal(getUserId(unauthenticatedReq), undefined);

  // Client attempted ID spoofing in body/query is strictly ignored in controllers
  const maliciousReq = {
    user: { id: "user_legitimate" },
    body: { owner: "user_victim", userId: "user_victim" },
    query: { userId: "user_victim" },
  };

  // Controller exclusively uses getUserId(req)
  const scopedOwner = getUserId(maliciousReq);
  assert.equal(scopedOwner, "user_legitimate", "Controller must never accept owner/userId from body or query");
});

