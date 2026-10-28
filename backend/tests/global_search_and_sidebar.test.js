import test from "node:test";
import assert from "node:assert/strict";

// Mirror progressive ranking scoring function from GlobalSearch.jsx
function scoreItem(item, queryLower) {
  const titleLower = (item.title || "").toLowerCase();

  // 1. Exact match
  if (titleLower === queryLower) return 100;

  // 2. Prefix match on title
  if (titleLower.startsWith(queryLower)) return 80;

  // 3. Word in title starts with query
  const titleWords = titleLower.split(/[\s\-_/]+/);
  if (titleWords.some((w) => w.startsWith(queryLower))) return 60;

  // 4. Substring match on title
  if (titleLower.includes(queryLower)) return 40;

  // 5. Aliases match
  if (Array.isArray(item.aliases)) {
    for (const alias of item.aliases) {
      const aLower = alias.toLowerCase();
      if (aLower === queryLower) return 70;
      if (aLower.startsWith(queryLower)) return 50;
      if (aLower.includes(queryLower)) return 30;
    }
  }

  // 6. Description match
  const descLower = (item.description || "").toLowerCase();
  if (descLower.includes(queryLower)) return 20;

  // 7. Category match
  const catLower = (item.category || "").toLowerCase();
  if (catLower.startsWith(queryLower)) return 25;
  if (catLower.includes(queryLower)) return 15;

  return 0;
}

const mockRegistry = [
  {
    id: "page-dashboard",
    title: "Dashboard",
    category: "Pages",
    path: "/",
    aliases: ["home", "overview"],
  },
  {
    id: "page-quicksend",
    title: "QuickSend Messaging",
    category: "Pages",
    path: "/messages",
    aliases: ["quicksend", "messages", "chat", "email", "broadcast"],
  },
  {
    id: "setting-notifications",
    title: "Notifications & Quiet Hours",
    category: "Settings",
    path: "/settings?tab=notifications",
    aliases: ["quiet hours", "push alerts"],
  },
  {
    id: "page-calendar",
    title: "Calendar Schedule",
    category: "Pages",
    path: "/calendar",
    aliases: ["calendar", "schedule"],
  },
  {
    id: "action-new-task",
    title: "Create New Task",
    category: "Actions",
    actionType: "create_task",
    aliases: ["new task", "add task"],
  },
];

test("Global Search: Google-style progressive query refinement (q -> qu -> qui -> quic)", () => {
  // 1. Query 'q'
  const resQ = mockRegistry
    .map((item) => ({ item, score: scoreItem(item, "q") }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  assert.ok(resQ.length >= 2, "Query 'q' matches QuickSend and Quiet Hours");
  const titlesQ = resQ.map((r) => r.item.title);
  assert.ok(titlesQ.includes("QuickSend Messaging"));
  assert.ok(titlesQ.includes("Notifications & Quiet Hours"));

  // 2. Query 'qu'
  const resQU = mockRegistry
    .map((item) => ({ item, score: scoreItem(item, "qu") }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  assert.ok(resQU.length >= 2, "Query 'qu' refines results");
  assert.equal(resQU[0].item.title, "QuickSend Messaging");

  // 3. Query 'qui'
  const resQUI = mockRegistry
    .map((item) => ({ item, score: scoreItem(item, "qui") }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  assert.ok(resQUI.length >= 2, "Query 'qui' refines results further");

  // 4. Query 'quic'
  const resQUIC = mockRegistry
    .map((item) => ({ item, score: scoreItem(item, "quic") }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  assert.equal(resQUIC.length, 1, "Query 'quic' leaves QuickSend as the single strong match");
  assert.equal(resQUIC[0].item.title, "QuickSend Messaging");
  assert.equal(resQUIC[0].score, 80, "QuickSend gets strong prefix match score (80)");
});

test("Global Search: Ranking score precedence", () => {
  const items = [
    { title: "Calendar Schedule", aliases: ["dates"] },
    { title: "Monthly Calendar", aliases: ["schedule"] },
    { title: "Schedule Agenda", aliases: ["calendar"] },
  ];

  // Exact title match gets 100
  assert.equal(scoreItem(items[0], "calendar schedule"), 100);

  // Prefix match gets 80
  assert.equal(scoreItem(items[0], "calendar"), 80);

  // Word-start match gets 60
  assert.equal(scoreItem(items[1], "calendar"), 60);

  // Alias match gets 70/50
  assert.equal(scoreItem(items[2], "calendar"), 70);
});

test("Sidebar: User-scoped preference key prevents account leakage", () => {
  const getStorageKey = (user) => {
    const uid = user?._id || user?.id || user?.email;
    return uid ? `tasklert_sidebar_collapsed_${uid}` : null;
  };

  const userAlice = { _id: "user_alice_123", email: "alice@example.com" };
  const userBob = { _id: "user_bob_456", email: "bob@example.com" };

  const keyAlice = getStorageKey(userAlice);
  const keyBob = getStorageKey(userBob);

  assert.equal(keyAlice, "tasklert_sidebar_collapsed_user_alice_123");
  assert.equal(keyBob, "tasklert_sidebar_collapsed_user_bob_456");
  assert.notEqual(keyAlice, keyBob, "Different users have completely isolated sidebar state keys");
  assert.equal(getStorageKey(null), null);
});

test("Global Search: Task data isolation and search indexing", () => {
  const userTasks = [
    { _id: "t1", title: "Quarterly Review", priority: "High", category: "Work", completed: false },
    { _id: "t2", title: "Buy groceries", priority: "Low", category: "Personal", completed: true },
  ];

  const indexTask = (task) => ({
    id: `task-${task._id}`,
    title: task.title,
    category: "Tasks",
    isTask: true,
    taskData: task,
    aliases: [task.category, task.priority, task.completed ? "completed" : "pending"],
  });

  const indexed = userTasks.map(indexTask);

  // Matching task by title
  const matchTitle = indexed.filter((i) => scoreItem(i, "quarterly") > 0);
  assert.equal(matchTitle.length, 1);
  assert.equal(matchTitle[0].title, "Quarterly Review");

  // Matching task by category alias
  const matchCategory = indexed.filter((i) => scoreItem(i, "work") > 0);
  assert.equal(matchCategory.length, 1);
  assert.equal(matchCategory[0].title, "Quarterly Review");

  // Matching task by completed status
  const matchCompleted = indexed.filter((i) => scoreItem(i, "completed") > 0);
  assert.equal(matchCompleted.length, 1);
  assert.equal(matchCompleted[0].title, "Buy groceries");
});

test("Global Search: User task description, tags, and relevance boost", () => {
  const task = {
    _id: "t3",
    title: "Sprint Retrospective",
    description: "Prepare quarterly retrospective deck and performance feedback",
    category: "Engineering",
    priority: "High",
    tags: ["agile", "q4"],
    completed: false,
  };

  const indexed = {
    id: `task-${task._id}`,
    title: task.title,
    description: "High Priority • Engineering (Pending)",
    category: "Tasks",
    isTask: true,
    taskData: task,
    aliases: [
      task.category,
      task.priority,
      "pending",
      task.description,
      ...(task.tags || []),
    ],
  };

  // 1. Search by tag
  const scoreTag = scoreItem(indexed, "agile");
  assert.ok(scoreTag >= 30, "Tag matches aliases with score >= 30");

  // 2. Search by word inside description
  const scoreDesc = scoreItem(indexed, "retrospective");
  assert.ok(scoreDesc >= 30, "Task description matches aliases");
});

test("Unified Search: Real-time task filtering simulating Dashboard list", () => {
  const userTasks = [
    { _id: "1", title: "Design System Review", category: "Design", tags: ["ui"] },
    { _id: "2", title: "Database Index Optimization", category: "Backend", tags: ["mongo"] },
    { _id: "3", title: "Write End-to-End Tests", category: "QA", tags: ["testing"] },
  ];

  const filterTasks = (tasks, query) => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const matchTitle = (t.title || "").toLowerCase().includes(q);
      const matchCat = (t.category || "").toLowerCase().includes(q);
      const matchTags = Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase().includes(q));
      return matchTitle || matchCat || matchTags;
    });
  };

  // Searching 'index' filters to database task
  const res1 = filterTasks(userTasks, "index");
  assert.equal(res1.length, 1);
  assert.equal(res1[0]._id, "2");

  // Searching 'ui' filters to design task
  const res2 = filterTasks(userTasks, "ui");
  assert.equal(res2.length, 1);
  assert.equal(res2[0]._id, "1");

  // Clearing query returns all tasks
  const res3 = filterTasks(userTasks, "");
  assert.equal(res3.length, 3);
});
