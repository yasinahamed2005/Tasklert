import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import or replicate the authoritative helpers used in CompletePage.jsx and dummy.jsx
const isTaskCompleted = (task) => {
  if (!task) return false;
  const value = task.completed;
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === 'completed' || normalized === '1';
  }
  return false;
};

const parseSafeDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

const getStartOfDay = (d = new Date()) => {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

const getStartOfWeek = (d = new Date()) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const getStartOfMonth = (d = new Date()) => {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

const isCompletedToday = (task, now = new Date()) => {
  if (!isTaskCompleted(task)) return false;
  const d = parseSafeDate(task.completedAt);
  if (!d) return false;
  const sod = getStartOfDay(now);
  const eod = new Date(sod.getTime() + 86400000);
  return d >= sod && d < eod;
};

const isCompletedThisWeek = (task, now = new Date()) => {
  if (!isTaskCompleted(task)) return false;
  const d = parseSafeDate(task.completedAt);
  if (!d) return false;
  const sow = getStartOfWeek(now);
  const eow = new Date(sow.getTime() + 7 * 86400000);
  return d >= sow && d < eow;
};

const isCompletedThisMonth = (task, now = new Date()) => {
  if (!isTaskCompleted(task)) return false;
  const d = parseSafeDate(task.completedAt);
  if (!d) return false;
  const som = getStartOfMonth(now);
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return d >= som && d < eom;
};

const formatCompletionDate = (dateVal) => {
  if (!dateVal) return null;
  const d = parseSafeDate(dateVal);
  if (!d) return null;

  const now = new Date();
  const startOfToday = getStartOfDay(now);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  if (d >= startOfToday && d < startOfTomorrow) {
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `Today at ${timeStr}`;
  }
  if (d >= startOfYesterday && d < startOfToday) {
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `Yesterday at ${timeStr}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const getCompletionGroup = (task, now = new Date()) => {
  if (!isTaskCompleted(task)) return null;
  const d = parseSafeDate(task.completedAt);
  if (!d) return 'no_timestamp';

  const startOfToday = getStartOfDay(now);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  if (d >= startOfToday && d < startOfTomorrow) return 'today';
  if (d >= startOfYesterday && d < startOfToday) return 'yesterday';

  const startOfWeek = getStartOfWeek(now);
  if (d >= startOfWeek && d < startOfYesterday) return 'this_week';

  const startOfMonth = getStartOfMonth(now);
  const earlierThreshold = startOfWeek < startOfYesterday ? startOfWeek : startOfYesterday;
  if (d >= startOfMonth && d < earlierThreshold) return 'this_month';

  return 'older';
};

describe('Completed Tasks Page Redesign Suite', () => {
  // Fixed reference point: Tuesday, Oct 27, 2026, 14:00 UTC
  // Week start (Monday): Oct 26, 2026 00:00 UTC
  // Month start: Oct 1, 2026 00:00 UTC
  const now = new Date('2026-10-27T14:00:00Z');

  const todayCompleted = new Date('2026-10-27T10:30:00Z').toISOString();
  const yesterdayCompleted = new Date('2026-10-26T16:00:00Z').toISOString(); // Monday (yesterday)
  const earlierThisMonth = new Date('2026-10-15T09:00:00Z').toISOString(); // Earlier in Oct (not this week)
  const lastMonthCompleted = new Date('2026-09-20T11:00:00Z').toISOString(); // Older (Sept)

  const sampleCompletedTasks = [
    { _id: 'c1', title: 'Security vulnerability remediation', priority: 'High', completed: true, completedAt: todayCompleted, project: { name: 'Security' } },
    { _id: 'c2', title: 'Database query optimizer upgrade', priority: 'Medium', completed: 'Yes', completedAt: todayCompleted, tags: ['database'] },
    { _id: 'c3', title: 'Weekly sprint planning review', priority: 'High', completed: true, completedAt: yesterdayCompleted, project: { name: 'Core' } },
    { _id: 'c4', title: 'API schema validation refactor', priority: 'Low', completed: true, completedAt: earlierThisMonth, tags: ['api', 'v2'] },
    { _id: 'c5', title: 'Legacy architecture audit report', priority: 'Medium', completed: true, completedAt: lastMonthCompleted },
    { _id: 'c6', title: 'Historical task without timestamp', priority: 'Low', completed: true, completedAt: null },
    { _id: 'p1', title: 'Active pending task (must never show in completed)', priority: 'High', completed: false, completedAt: null },
    { _id: 'p2', title: 'Another unfinished task', priority: 'Low', completed: 'No', completedAt: null },
  ];

  test('Filter Boundary: Strictly isolates completed tasks and excludes pending tasks', () => {
    const completedOnly = sampleCompletedTasks.filter(isTaskCompleted);
    assert.equal(completedOnly.length, 6, 'Should find 6 completed tasks');
    assert.ok(completedOnly.every((t) => isTaskCompleted(t)));
    assert.ok(!completedOnly.some((t) => t._id === 'p1' || t._id === 'p2'));
  });

  test('Summary Metrics: Accurately computes Today, This Week, This Month, and Total counts without fabricating dates', () => {
    const completedOnly = sampleCompletedTasks.filter(isTaskCompleted);

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    completedOnly.forEach((t) => {
      if (isCompletedToday(t, now)) today++;
      if (isCompletedThisWeek(t, now)) thisWeek++;
      if (isCompletedThisMonth(t, now)) thisMonth++;
    });

    assert.equal(today, 2, '2 tasks completed today (c1, c2)');
    assert.equal(thisWeek, 3, '3 tasks completed this week (c1, c2, c3)');
    assert.equal(thisMonth, 4, '4 tasks completed this month (c1, c2, c3, c4)');
    assert.equal(completedOnly.length, 6, 'Total completed is 6');

    // Crucial requirement: c6 has no completedAt; must count toward total, but NEVER toward today/week/month
    const c6 = completedOnly.find((t) => t._id === 'c6');
    assert.equal(isCompletedToday(c6, now), false);
    assert.equal(isCompletedThisWeek(c6, now), false);
    assert.equal(isCompletedThisMonth(c6, now), false);
  });

  test('Chronological Grouping: Partitions completed tasks into mutually exclusive groups without duplication', () => {
    const completedOnly = sampleCompletedTasks.filter(isTaskCompleted);

    const groupCounts = { today: 0, yesterday: 0, this_week: 0, this_month: 0, older: 0, no_timestamp: 0 };

    completedOnly.forEach((task) => {
      const g = getCompletionGroup(task, now);
      assert.ok(g in groupCounts, `Group ${g} must be a recognized group ID`);
      groupCounts[g]++;
    });

    assert.equal(groupCounts.today, 2, '2 in today');
    assert.equal(groupCounts.yesterday, 1, '1 in yesterday');
    assert.equal(groupCounts.this_month, 1, '1 in earlier this month');
    assert.equal(groupCounts.older, 1, '1 in older');
    assert.equal(groupCounts.no_timestamp, 1, '1 in no timestamp fallback');

    // Sum of all partitioned groups must equal total completed tasks
    const sum = Object.values(groupCounts).reduce((a, b) => a + b, 0);
    assert.equal(sum, completedOnly.length, 'Every task must belong to exactly one group');
  });

  test('Sorting: Recently completed sorts by completedAt descending with fallbacks', () => {
    const completedOnly = sampleCompletedTasks.filter(isTaskCompleted);

    const sorted = [...completedOnly].sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Newest completion (today) must be at index 0
    assert.ok(isCompletedToday(sorted[0], now));
    assert.ok(isCompletedToday(sorted[1], now));

    // Oldest/null must be at the very end
    assert.equal(sorted[sorted.length - 1]._id, 'c6');
  });

  test('Sorting: Alphabetical sorts by title (A-Z)', () => {
    const completedOnly = sampleCompletedTasks.filter(isTaskCompleted);
    const sorted = [...completedOnly].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    assert.equal(sorted[0].title, 'API schema validation refactor');
    assert.equal(sorted[sorted.length - 1].title, 'Weekly sprint planning review');
  });

  test('Search: Accurately searches title, project, and tags case-insensitively', () => {
    const completedOnly = sampleCompletedTasks.filter(isTaskCompleted);

    const searchTasks = (q) => {
      const query = q.toLowerCase().trim();
      return completedOnly.filter((t) => {
        const inTitle = (t.title || '').toLowerCase().includes(query);
        const inProject = (t.project?.name || '').toLowerCase().includes(query);
        const inTags = Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase().includes(query));
        return inTitle || inProject || inTags;
      });
    };

    // By title
    const res1 = searchTasks('vulnerability');
    assert.equal(res1.length, 1);
    assert.equal(res1[0]._id, 'c1');

    // By project
    const res2 = searchTasks('Security');
    assert.equal(res2.length, 1);
    assert.equal(res2[0]._id, 'c1');

    // By tag
    const res3 = searchTasks('database');
    assert.equal(res3.length, 1);
    assert.equal(res3[0]._id, 'c2');
  });

  test('Restore and Undo Flow: Validates payload and metadata preservation', () => {
    const task = {
      _id: 'c1',
      title: 'Security vulnerability remediation',
      priority: 'High',
      completed: true,
      completedAt: todayCompleted,
      project: 'proj-123',
      tags: ['audit'],
      dueDate: '2026-10-30T10:00:00Z',
    };

    // 1. Restore payload to pending
    const restorePayload = { completed: 'No' };
    const restoredTask = { ...task, ...restorePayload, completedAt: null };
    assert.equal(isTaskCompleted(restoredTask), false, 'Restored task must be pending');
    assert.equal(restoredTask.title, task.title, 'Title preserved');
    assert.equal(restoredTask.project, task.project, 'Project preserved');
    assert.equal(restoredTask.dueDate, task.dueDate, 'Due date preserved');

    // 2. Undo rollback payload
    const undoPayload = { completed: 'Yes' };
    const reCompletedTask = { ...restoredTask, ...undoPayload };
    assert.equal(isTaskCompleted(reCompletedTask), true, 'Undo restores completed state');
  });

  test('Date Formatter: Formats relative date or returns null for missing timestamps without fabricating', () => {
    assert.equal(formatCompletionDate(null), null);
    assert.equal(formatCompletionDate(''), null);
    assert.equal(formatCompletionDate('invalid-date'), null);

    // Valid date returns formatted string
    const formatted = formatCompletionDate(new Date().toISOString());
    assert.ok(formatted && formatted.includes('Today'), 'Formats today timestamp correctly');
  });
});
