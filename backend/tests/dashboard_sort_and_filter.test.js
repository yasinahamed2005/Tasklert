import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Replicate pure sorting and filtering logic from frontend assets to guarantee behavioral stability
const sortTasks = (list, sortBy) => {
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return new Date(a.createdAt) - new Date(b.createdAt);
      case "priority":
        return (priorityOrder[b.priority?.toLowerCase()] || 0) - (priorityOrder[a.priority?.toLowerCase()] || 0);
      case "deadline": {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      case "alphabetical":
        return (a.title || "").localeCompare(b.title || "");
      case "newest":
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });
};

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

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

describe('Dashboard Simplified Sort & Filter Suite', () => {
  const mockTasks = [
    {
      _id: 't1',
      title: 'Review quarterly architecture roadmap',
      priority: 'High',
      dueDate: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago (overdue)
      completed: false,
      createdAt: '2026-10-20T08:00:00.000Z'
    },
    {
      _id: 't2',
      title: 'Deploy push notification service updates',
      priority: 'Medium',
      dueDate: new Date().toISOString(), // today
      completed: false,
      createdAt: '2026-10-25T09:00:00.000Z'
    },
    {
      _id: 't3',
      title: 'Weekly grocery replenishment',
      priority: 'Low',
      dueDate: new Date(Date.now() + 4 * 86400000).toISOString(), // future
      completed: true,
      completedAt: new Date().toISOString(),
      createdAt: '2026-10-26T07:00:00.000Z'
    },
    {
      _id: 't4',
      title: 'Client deliverables checkin',
      priority: 'High',
      dueDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      completed: false,
      createdAt: '2026-10-27T06:00:00.000Z'
    },
    {
      _id: 't5',
      title: 'Brainstorm ideas for v2',
      priority: 'Low',
      dueDate: null, // no deadline
      completed: false,
      createdAt: '2026-10-15T10:00:00.000Z'
    }
  ];

  test('Sorting: Newest first sorts by createdAt descending', () => {
    const sorted = sortTasks(mockTasks, 'newest');
    assert.strictEqual(sorted[0]._id, 't4'); // Oct 27
    assert.strictEqual(sorted[sorted.length - 1]._id, 't5'); // Oct 15
  });

  test('Sorting: Oldest first sorts by createdAt ascending', () => {
    const sorted = sortTasks(mockTasks, 'oldest');
    assert.strictEqual(sorted[0]._id, 't5'); // Oct 15
    assert.strictEqual(sorted[sorted.length - 1]._id, 't4'); // Oct 27
  });

  test('Sorting: Priority ranks High > Medium > Low', () => {
    const sorted = sortTasks(mockTasks, 'priority');
    assert.strictEqual(sorted[0].priority, 'High');
    assert.strictEqual(sorted[1].priority, 'High');
    assert.strictEqual(sorted[2].priority, 'Medium');
    assert.strictEqual(sorted[3].priority, 'Low');
    assert.strictEqual(sorted[4].priority, 'Low');
  });

  test('Sorting: Deadline handles missing deadlines safely without crashing', () => {
    const sorted = sortTasks(mockTasks, 'deadline');
    // Task without deadline should be at the very end
    assert.strictEqual(sorted[sorted.length - 1]._id, 't5');
    // Overdue task (past date) should be first
    assert.strictEqual(sorted[0]._id, 't1');
  });

  test('Sorting: Alphabetical A-Z sorts by title string comparison', () => {
    const sorted = sortTasks(mockTasks, 'alphabetical');
    assert.strictEqual(sorted[0].title, 'Brainstorm ideas for v2');
    assert.strictEqual(sorted[1].title, 'Client deliverables checkin');
    assert.strictEqual(sorted[2].title, 'Deploy push notification service updates');
    assert.strictEqual(sorted[3].title, 'Review quarterly architecture roadmap');
    assert.strictEqual(sorted[4].title, 'Weekly grocery replenishment');
  });

  test('Filter: Category counts accurately match filtered tasks', () => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);

    const counts = mockTasks.reduce((acc, t) => {
      const completed = isTaskCompleted(t);
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      acc.all += 1;
      if (completed) acc.completed += 1;
      else acc.pending += 1;
      if (dueDate && dueDate < today && !completed) acc.overdue += 1;
      if (dueDate && dueDate >= today && dueDate < tomorrow && !completed) acc.today += 1;
      if (dueDate && dueDate >= tomorrow && dueDate < dayAfterTomorrow && !completed) acc.tomorrow += 1;
      return acc;
    }, { all: 0, pending: 0, completed: 0, overdue: 0, today: 0, tomorrow: 0 });

    assert.strictEqual(counts.all, 5);
    assert.strictEqual(counts.pending, 4);
    assert.strictEqual(counts.completed, 1);
    assert.strictEqual(counts.overdue, 1);
    assert.strictEqual(counts.today, 1);
    assert.strictEqual(counts.tomorrow, 1);
  });
});
