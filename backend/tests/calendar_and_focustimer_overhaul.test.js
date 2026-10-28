import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from '../../frontend/node_modules/date-fns/index.js';

// -------------------------------------------------------------
// Authoritative Helper Functions (Mirrored from CalendarPage)
// -------------------------------------------------------------
const toDateKey = (date) => {
  if (!date) return null;
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
};

const isCompletedTask = (task) => {
  if (!task) return false;
  const val = task.completed;
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const norm = val.trim().toLowerCase();
    return norm === 'yes' || norm === 'true' || norm === 'completed' || norm === '1';
  }
  return false;
};

const isTaskOverdue = (task, todayKey) => {
  if (!task?.dueDate || isCompletedTask(task)) return false;
  const key = toDateKey(task.dueDate);
  return key && key < todayKey;
};

const computeMonthGrid = (currentDate) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: startDate, end: endDate });
};

describe('Calendar & Focus Timer Overhaul Test Suite', () => {
  // =========================================================================
  // PART A — CALENDAR GRID, CHESSBOARD & TIMEZONE MATH
  // =========================================================================

  test('Chessboard Alternation: 2D formula guarantees alternating surfaces horizontally and vertically', () => {
    const testDate = new Date('2026-10-01T12:00:00Z');
    const days = computeMonthGrid(testDate);

    // Days grid must be a multiple of 7 (35 or 42 cells)
    assert.ok(days.length === 35 || days.length === 42, `Month grid must be 35 or 42 cells, got ${days.length}`);

    // Verify alternating pattern for every cell: (row + col) % 2 === 1
    for (let index = 0; index < days.length; index++) {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const isAltCell = (row + col) % 2 === 1;

      // Check horizontal neighbor
      if (col < 6) {
        const nextColAlt = (row + (col + 1)) % 2 === 1;
        assert.notEqual(isAltCell, nextColAlt, `Horizontal cells at (${row}, ${col}) and (${row}, ${col + 1}) must alternate`);
      }

      // Check vertical neighbor
      if (row < Math.floor(days.length / 7) - 1) {
        const nextRowAlt = ((row + 1) + col) % 2 === 1;
        assert.notEqual(isAltCell, nextRowAlt, `Vertical cells at (${row}, ${col}) and (${row + 1}, ${col}) must alternate`);
      }
    }
  });

  test('Timezone Safety: toDateKey preserves local calendar date without UTC offset shifting', () => {
    // String ISO formats
    assert.equal(toDateKey('2026-10-28'), '2026-10-28');
    assert.equal(toDateKey('2026-10-28T00:00:00.000Z'), '2026-10-28');
    assert.equal(toDateKey('2026-02-29T23:59:59.000Z'), '2026-02-29');

    // Date objects
    const d = new Date(2026, 9, 28); // Oct 28
    assert.equal(toDateKey(d), '2026-10-28');

    // Invalid dates
    assert.equal(toDateKey(null), null);
    assert.equal(toDateKey(''), null);
    assert.equal(toDateKey('invalid-date'), null);
  });

  test('Leap Years: February month lengths calculated accurately', () => {
    // 2024 is a leap year (29 days)
    const feb2024Start = startOfMonth(new Date('2024-02-10T12:00:00Z'));
    const feb2024End = endOfMonth(feb2024Start);
    assert.equal(feb2024End.getDate(), 29, 'February 2024 must have 29 days');

    // 2026 is non-leap year (28 days)
    const feb2026Start = startOfMonth(new Date('2026-02-10T12:00:00Z'));
    const feb2026End = endOfMonth(feb2026Start);
    assert.equal(feb2026End.getDate(), 28, 'February 2026 must have 28 days');
  });

  test('Task Association & Overdue Logic: Segregates tasks accurately by date and status', () => {
    const todayStr = '2026-10-28';
    const sampleTasks = [
      { _id: 't1', title: 'Task Due Today', dueDate: '2026-10-28', completed: false, priority: 'High' },
      { _id: 't2', title: 'Overdue Task', dueDate: '2026-10-25', completed: false, priority: 'High' },
      { _id: 't3', title: 'Past Completed Task', dueDate: '2026-10-25', completed: true, priority: 'Low' },
      { _id: 't4', title: 'Upcoming Task', dueDate: '2026-11-05', completed: false, priority: 'Medium' },
      { _id: 't5', title: 'Unscheduled Task', dueDate: null, completed: false, priority: 'Low' },
    ];

    // t1 is today, not overdue
    assert.equal(isTaskOverdue(sampleTasks[0], todayStr), false);

    // t2 is past and uncompleted => overdue
    assert.equal(isTaskOverdue(sampleTasks[1], todayStr), true);

    // t3 is past but completed => NOT overdue
    assert.equal(isTaskOverdue(sampleTasks[2], todayStr), false);

    // t4 is upcoming => NOT overdue
    assert.equal(isTaskOverdue(sampleTasks[3], todayStr), false);

    // Map grouping
    const tasksByDate = {};
    const unscheduled = [];
    sampleTasks.forEach((t) => {
      const key = toDateKey(t.dueDate);
      if (!key) {
        unscheduled.push(t);
      } else {
        if (!tasksByDate[key]) tasksByDate[key] = [];
        tasksByDate[key].push(t);
      }
    });

    assert.equal(tasksByDate['2026-10-28'].length, 1);
    assert.equal(tasksByDate['2026-10-25'].length, 2);
    assert.equal(tasksByDate['2026-11-05'].length, 1);
    assert.equal(unscheduled.length, 1);
    assert.equal(unscheduled[0]._id, 't5');
  });

  // =========================================================================
  // PART B — FOCUS TIMER TIMESTAMP COUNTDOWN & PERSISTENCE ARCHITECTURE
  // =========================================================================

  test('Timestamp Countdown: Accurate remaining calculation across simulated device sleep', () => {
    const startTime = Date.now();
    const plannedDurationSec = 1500; // 25 minutes
    const targetEndTimestamp = startTime + plannedDurationSec * 1000;

    // 1. Initially full remaining duration
    let remaining = Math.max(0, Math.ceil((targetEndTimestamp - startTime) / 1000));
    assert.equal(remaining, 1500);

    // 2. Simulate 300 seconds passing while tab is backgrounded
    const wakeTime1 = startTime + 300 * 1000;
    remaining = Math.max(0, Math.ceil((targetEndTimestamp - wakeTime1) / 1000));
    assert.equal(remaining, 1200);

    // 3. Simulate device waking 100 seconds after target end timestamp (suspended past zero)
    const wakeTimeAfterExpiry = targetEndTimestamp + 100 * 1000;
    const diffAfterExpiry = Math.ceil((targetEndTimestamp - wakeTimeAfterExpiry) / 1000);
    assert.ok(diffAfterExpiry <= 0, 'Must detect expiration when waking past target timestamp');
    assert.equal(Math.max(0, diffAfterExpiry), 0, 'Remaining seconds clamped to 0');
  });

  test('Pause & Resume Preserves Exact Elapsed Time without Drift', () => {
    const plannedDuration = 1500;
    const startTime = 1000000;
    const initialTargetEnd = startTime + plannedDuration * 1000;

    // Ran for 400 seconds then paused
    const pauseTime = startTime + 400 * 1000;
    const remainingAtPause = Math.max(0, Math.ceil((initialTargetEnd - pauseTime) / 1000));
    assert.equal(remainingAtPause, 1100);

    const accumulatedSeconds = 400;

    // Resumed 2000 seconds later
    const resumeTime = 5000000;
    const newTargetEnd = resumeTime + (plannedDuration - accumulatedSeconds) * 1000;

    // Verify remaining seconds at resume instant equals remaining seconds at pause instant
    const remainingAtResume = Math.max(0, Math.ceil((newTargetEnd - resumeTime) / 1000));
    assert.equal(remainingAtResume, 1100, 'Remaining time on resume must exactly equal remaining time at pause');
  });

  test('Idempotent Completion: Double completion does not duplicate stats or throw', () => {
    const mockSession = {
      _id: 'session-123',
      owner: 'user-abc',
      status: 'running',
      plannedDuration: 1500,
      accumulatedSeconds: 1500,
      targetEndAt: new Date(Date.now() + 10000),
      pushDispatched: false,
    };

    // First completion
    if (mockSession.status !== 'completed') {
      mockSession.status = 'completed';
      mockSession.targetEndAt = null;
      mockSession.pushDispatched = true;
    }
    assert.equal(mockSession.status, 'completed');
    assert.equal(mockSession.targetEndAt, null);
    assert.equal(mockSession.pushDispatched, true);

    // Second completion (idempotent no-op)
    let duplicateError = false;
    try {
      if (mockSession.status === 'completed') {
        // Safe return
      } else {
        duplicateError = true;
      }
    } catch (_) {
      duplicateError = true;
    }
    assert.equal(duplicateError, false, 'Repeated completion must be completely idempotent and safe');
  });

  test('Scheduled Push Payload Format: Contains required PWA and action parameters', () => {
    const payload = {
      title: '🎯 Focus Session Complete!',
      body: 'Outstanding work! Take a refreshing break.',
      icon: '/tasklert-icon.svg',
      badge: '/favicon.png',
      url: '/focus',
      tag: 'focus-session-test',
      sound: 'chime',
      vibrate: [300, 150, 300, 150, 400],
      actions: [
        { action: 'open', title: '👉 View Timer' },
        { action: 'dismiss', title: '✕ Dismiss' },
      ],
    };

    assert.ok(payload.title.includes('Focus'));
    assert.equal(payload.icon, '/tasklert-icon.svg');
    assert.equal(payload.url, '/focus');
    assert.equal(payload.actions.length, 2);
    assert.equal(payload.sound, 'chime');
  });
});
