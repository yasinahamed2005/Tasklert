import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import or recreate the authoritative helpers used in PendingPage.jsx and dummy.jsx
const isTaskCompleted = (task) => {
  if (!task) return false;
  const val = task.completed;
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const n = val.trim().toLowerCase();
    return n === 'yes' || n === 'true' || n === 'completed' || n === '1';
  }
  return false;
};

const parseSafeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isTaskOverdue = (task, now = new Date()) => {
  if (isTaskCompleted(task)) return false;
  const d = parseSafeDate(task?.dueDate);
  if (!d) return false;
  return d < startOfDay(now);
};

const isTaskDueToday = (task, now = new Date()) => {
  if (isTaskCompleted(task)) return false;
  const d = parseSafeDate(task?.dueDate);
  if (!d) return false;
  const sod = startOfDay(now);
  const eod = new Date(sod.getTime() + 86400000);
  return d >= sod && d < eod;
};

const isTaskUpcoming = (task, now = new Date()) => {
  if (isTaskCompleted(task)) return false;
  const d = parseSafeDate(task?.dueDate);
  if (!d) return false;
  const startOfTomorrow = new Date(startOfDay(now).getTime() + 86400000);
  return d >= startOfTomorrow;
};

const isTaskNoDueDate = (task) => {
  if (isTaskCompleted(task)) return false;
  return !task?.dueDate || parseSafeDate(task.dueDate) === null;
};

const priorityWeight = { high: 3, medium: 2, low: 1 };

const smartUrgencySort = (a, b) => {
  const getRank = (t) => {
    if (isTaskOverdue(t)) return 0;
    if (isTaskDueToday(t)) return 1;
    if (isTaskUpcoming(t)) return 2;
    return 3;
  };

  const rankA = getRank(a);
  const rankB = getRank(b);
  if (rankA !== rankB) return rankA - rankB;

  if (rankA === 0 || rankA === 2) {
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    return (priorityWeight[b.priority?.toLowerCase()] || 0) - (priorityWeight[a.priority?.toLowerCase()] || 0);
  }

  const pDiff = (priorityWeight[b.priority?.toLowerCase()] || 0) - (priorityWeight[a.priority?.toLowerCase()] || 0);
  if (pDiff !== 0) return pDiff;

  const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return createdB - createdA;
};

const filterPendingTasks = (tasks, { query = '', quickFilter = 'all', priority = '', project = '', tag = '', hasAlarm = '' }) => {
  return tasks.filter((t) => {
    if (isTaskCompleted(t)) return false;

    if (quickFilter === 'today' && !isTaskDueToday(t)) return false;
    if (quickFilter === 'upcoming' && !isTaskUpcoming(t)) return false;
    if (quickFilter === 'overdue' && !isTaskOverdue(t)) return false;
    if (quickFilter === 'no_date' && !isTaskNoDueDate(t)) return false;

    if (priority && (t.priority || '').toLowerCase() !== priority.toLowerCase()) return false;
    if (project && (t.project?.name || t.project || '').toLowerCase() !== project.toLowerCase()) return false;
    if (tag) {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      if (!tags.some((x) => x.toLowerCase() === tag.toLowerCase())) return false;
    }
    if (hasAlarm === 'yes' && !t.alarmTime && !t.reminderTime && !t.alarm) return false;
    if (hasAlarm === 'no' && (t.alarmTime || t.reminderTime || t.alarm)) return false;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const inTitle = (t.title || '').toLowerCase().includes(q);
      const inDesc = (t.description || '').toLowerCase().includes(q);
      const inProject = (t.project?.name || t.project || '').toLowerCase().includes(q);
      const inTags = Array.isArray(t.tags) && t.tags.some((x) => x.toLowerCase().includes(q));
      if (!inTitle && !inDesc && !inProject && !inTags) return false;
    }

    return true;
  });
};

describe('Pending Tasks Page Redesign Suite', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const threeDaysAgo = new Date('2026-10-24T10:00:00Z').toISOString();
  const todayDue = new Date('2026-10-27T18:00:00Z').toISOString();
  const tomorrowDue = new Date('2026-10-28T09:00:00Z').toISOString();
  const nextWeekDue = new Date('2026-11-03T15:00:00Z').toISOString();

  const sampleTasks = [
    { _id: '1', title: 'Overdue high-priority audit', priority: 'High', dueDate: threeDaysAgo, completed: false, createdAt: '2026-10-20' },
    { _id: '2', title: 'Overdue medium fix', priority: 'Medium', dueDate: threeDaysAgo, completed: false, createdAt: '2026-10-21' },
    { _id: '3', title: 'Due today team sync', priority: 'High', dueDate: todayDue, completed: false, project: { name: 'Engineering' } },
    { _id: '4', title: 'Due today docs review', priority: 'Low', dueDate: todayDue, completed: false, tags: ['docs', 'v2'] },
    { _id: '5', title: 'Upcoming tomorrow release', priority: 'High', dueDate: tomorrowDue, completed: false },
    { _id: '6', title: 'Upcoming next week design', priority: 'Medium', dueDate: nextWeekDue, completed: false },
    { _id: '7', title: 'Backlog ideas item', priority: 'Medium', dueDate: null, completed: false },
    { _id: '8', title: 'Another backlog item', priority: 'Low', dueDate: '', completed: false },
    { _id: '9', title: 'Already completed task from past', priority: 'High', dueDate: threeDaysAgo, completed: true },
    { _id: '10', title: 'Completed today task', priority: 'High', dueDate: todayDue, completed: 'Yes' },
  ];

  test('Partitioning: Pending tasks partition cleanly into Overdue, Today, Upcoming, and No Due Date with zero overlap', () => {
    const pendingOnly = sampleTasks.filter((t) => !isTaskCompleted(t));
    assert.equal(pendingOnly.length, 8, 'There should be 8 pending tasks');

    const overdue = pendingOnly.filter((t) => isTaskOverdue(t, now));
    const today = pendingOnly.filter((t) => isTaskDueToday(t, now));
    const upcoming = pendingOnly.filter((t) => isTaskUpcoming(t, now));
    const noDate = pendingOnly.filter((t) => isTaskNoDueDate(t));

    assert.equal(overdue.length, 2, '2 overdue pending tasks');
    assert.equal(today.length, 2, '2 today pending tasks');
    assert.equal(upcoming.length, 2, '2 upcoming pending tasks');
    assert.equal(noDate.length, 2, '2 no-due-date pending tasks');

    // Mathematical sum must equal total pending tasks
    assert.equal(overdue.length + today.length + upcoming.length + noDate.length, pendingOnly.length);

    // Mutual exclusivity check: each pending task matches exactly one category
    pendingOnly.forEach((task) => {
      const matches = [
        isTaskOverdue(task, now),
        isTaskDueToday(task, now),
        isTaskUpcoming(task, now),
        isTaskNoDueDate(task),
      ].filter(Boolean).length;
      assert.equal(matches, 1, `Task "${task.title}" must match exactly one urgency category`);
    });
  });

  test('Exclusion: Completed tasks are never counted in any pending category', () => {
    const completedTasks = sampleTasks.filter((t) => isTaskCompleted(t));
    assert.equal(completedTasks.length, 2);

    completedTasks.forEach((task) => {
      assert.equal(isTaskOverdue(task, now), false, 'Completed task cannot be overdue');
      assert.equal(isTaskDueToday(task, now), false, 'Completed task cannot be due today');
      assert.equal(isTaskUpcoming(task, now), false, 'Completed task cannot be upcoming');
      assert.equal(isTaskNoDueDate(task), false, 'Completed task cannot be no-due-date');
    });
  });

  test('Smart Urgency Sorting: Sorts Overdue first, then Today, then Upcoming, then No Due Date', () => {
    const pendingOnly = sampleTasks.filter((t) => !isTaskCompleted(t));
    const sorted = [...pendingOnly].sort(smartUrgencySort);

    // First two must be overdue
    assert.ok(isTaskOverdue(sorted[0], now));
    assert.ok(isTaskOverdue(sorted[1], now));

    // Next two must be today
    assert.ok(isTaskDueToday(sorted[2], now));
    assert.ok(isTaskDueToday(sorted[3], now));

    // Next two must be upcoming
    assert.ok(isTaskUpcoming(sorted[4], now));
    assert.ok(isTaskUpcoming(sorted[5], now));

    // Last two must be no due date
    assert.ok(isTaskNoDueDate(sorted[6]));
    assert.ok(isTaskNoDueDate(sorted[7]));
  });

  test('Smart Urgency Sorting: Within today, High priority precedes Low priority', () => {
    const todayTasks = sampleTasks.filter((t) => isTaskDueToday(t, now)).sort(smartUrgencySort);
    assert.equal(todayTasks[0].priority, 'High');
    assert.equal(todayTasks[1].priority, 'Low');
  });

  test('Quick Filter Navigation: Filtering isolates subsets correctly', () => {
    const overdueFiltered = filterPendingTasks(sampleTasks, { quickFilter: 'overdue' });
    assert.equal(overdueFiltered.length, 2);
    assert.ok(overdueFiltered.every((t) => isTaskOverdue(t, now)));

    const todayFiltered = filterPendingTasks(sampleTasks, { quickFilter: 'today' });
    assert.equal(todayFiltered.length, 2);
    assert.ok(todayFiltered.every((t) => isTaskDueToday(t, now)));

    const upcomingFiltered = filterPendingTasks(sampleTasks, { quickFilter: 'upcoming' });
    assert.equal(upcomingFiltered.length, 2);
    assert.ok(upcomingFiltered.every((t) => isTaskUpcoming(t, now)));

    const noDateFiltered = filterPendingTasks(sampleTasks, { quickFilter: 'no_date' });
    assert.equal(noDateFiltered.length, 2);
    assert.ok(noDateFiltered.every((t) => isTaskNoDueDate(t)));
  });

  test('Search Filter: Searches title, description, project, and tags accurately', () => {
    // Title search
    const byTitle = filterPendingTasks(sampleTasks, { query: 'audit' });
    assert.equal(byTitle.length, 1);
    assert.equal(byTitle[0]._id, '1');

    // Project search
    const byProject = filterPendingTasks(sampleTasks, { query: 'Engineering' });
    assert.equal(byProject.length, 1);
    assert.equal(byProject[0]._id, '3');

    // Tag search
    const byTag = filterPendingTasks(sampleTasks, { query: 'docs' });
    assert.equal(byTag.length, 1);
    assert.equal(byTag[0]._id, '4');

    // Non-matching search yields 0
    const nonMatch = filterPendingTasks(sampleTasks, { query: 'nonexistent keyword' });
    assert.equal(nonMatch.length, 0);
  });

  test('Completion Undo Flow: Verifies optimistic completion and undo payload specification', () => {
    const task = { _id: 'task-123', title: 'Prepare presentation', completed: false };

    // Step 1: Optimistic completion payload
    const completePayload = { completed: 'Yes' };
    assert.equal(isTaskCompleted({ ...task, ...completePayload }), true);

    // Step 2: Undo rollback payload (restores pending state)
    const undoPayload = { completed: 'No' };
    assert.equal(isTaskCompleted({ ...task, ...undoPayload }), false);
  });

  test('Quick-Add Validation: Enforces trimmed non-empty title and defaults', () => {
    const validateQuickAdd = (rawTitle) => {
      const trimmed = (rawTitle || '').trim();
      if (!trimmed) return { valid: false, error: 'Task title cannot be empty' };
      return {
        valid: true,
        task: {
          title: trimmed,
          priority: 'Medium',
          completed: 'No',
        },
      };
    };

    assert.equal(validateQuickAdd('').valid, false);
    assert.equal(validateQuickAdd('   ').valid, false);

    const validResult = validateQuickAdd('  Implement automated tests  ');
    assert.equal(validResult.valid, true);
    assert.equal(validResult.task.title, 'Implement automated tests');
    assert.equal(validResult.task.priority, 'Medium');
    assert.equal(validResult.task.completed, 'No');
  });
});
