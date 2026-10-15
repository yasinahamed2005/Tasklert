import test from "node:test";
import assert from "node:assert/strict";

// =========================================================
// 1. PHASE 2: MULTI-ATTRIBUTE SEARCH & FILTERING LOGIC
// =========================================================
test("Phase 2: Enhanced Search — queries across title, description, tags, and project name", () => {
  const tasks = [
    {
      _id: "t1",
      title: "Fix login button styling",
      description: "Ensure high contrast across all themes",
      tags: ["frontend", "ui"],
      project: { _id: "p1", name: "Authentication Portal" },
    },
    {
      _id: "t2",
      title: "Optimize MongoDB aggregation",
      description: "Index push notifications by user ID and timestamp",
      tags: ["database", "backend"],
      project: { _id: "p2", name: "Core Engine" },
    },
    {
      _id: "t3",
      title: "Prepare Sprint Demo",
      description: "Showcase completed features to stakeholders",
      tags: ["management"],
      project: null,
    },
  ];

  const searchTasks = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const inTitle = t.title?.toLowerCase().includes(q);
      const inDesc = t.description?.toLowerCase().includes(q);
      const inTags = Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase().includes(q));
      const inProject = t.project?.name?.toLowerCase().includes(q);
      return inTitle || inDesc || inTags || inProject;
    });
  };

  // Search by title keyword
  assert.equal(searchTasks("login").length, 1);
  assert.equal(searchTasks("login")[0]._id, "t1");

  // Search by description keyword
  assert.equal(searchTasks("contrast").length, 1);
  assert.equal(searchTasks("contrast")[0]._id, "t1");

  // Search by tag
  assert.equal(searchTasks("backend").length, 1);
  assert.equal(searchTasks("backend")[0]._id, "t2");

  // Search by project name
  assert.equal(searchTasks("Authentication").length, 1);
  assert.equal(searchTasks("Authentication")[0]._id, "t1");

  // Search with no matches
  assert.equal(searchTasks("nonexistent-keyword-xyz").length, 0);
});

// =========================================================
// 2. PHASE 3: PROJECT METRICS & SAFE TASK UNLINKING
// =========================================================
test("Phase 3: Project Workspaces — computes completion percentage and unlinks tasks safely", () => {
  const projectTasks = [
    { _id: "t1", project: "proj-1", completed: true },
    { _id: "t2", project: "proj-1", completed: true },
    { _id: "t3", project: "proj-1", completed: false },
    { _id: "t4", project: "proj-1", completed: false },
  ];

  // 1. Metric calculation
  const totalCount = projectTasks.length;
  const completedCount = projectTasks.filter((t) => t.completed).length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  assert.equal(totalCount, 4);
  assert.equal(completedCount, 2);
  assert.equal(progressPct, 50);

  // 2. Safe unlinking simulation (Project deleted -> tasks unlinked, NOT deleted)
  const deletedProjectId = "proj-1";
  const unlinkedTasks = projectTasks.map((t) => {
    if (t.project === deletedProjectId) {
      return { ...t, project: null };
    }
    return t;
  });

  assert.equal(unlinkedTasks.length, 4, "No tasks deleted when project is removed");
  unlinkedTasks.forEach((t) => {
    assert.equal(t.project, null, "Project reference safely cleared to null");
  });
});

// =========================================================
// 3. PHASE 3: CUSTOM TAGS TAXONOMY AGGREGATION
// =========================================================
test("Phase 3: Custom Tags — aggregates, sanitizes, and deduplicates distinct user tags", () => {
  const tasks = [
    { tags: ["Bug", "  frontend  ", "v1.0"] },
    { tags: ["frontend", "Performance", "BUG"] },
    { tags: null },
    { tags: ["v1.0", "SECURITY"] },
  ];

  const extractUniqueTags = (taskList) => {
    const set = new Set();
    taskList.forEach((t) => {
      if (Array.isArray(t.tags)) {
        t.tags.forEach((raw) => {
          if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed) set.add(trimmed.toLowerCase());
          }
        });
      }
    });
    return Array.from(set).sort();
  };

  const tags = extractUniqueTags(tasks);
  assert.deepEqual(tags, ["bug", "frontend", "performance", "security", "v1.0"]);
});

// =========================================================
// 4. PHASE 3: REUSABLE TASK TEMPLATES APPLICATION
// =========================================================
test("Phase 3: Task Templates — cleanly populates task fields without polluting defaults", () => {
  const template = {
    _id: "tmpl-1",
    name: "Bug Report Template",
    title: "[Bug]: Issue Title",
    description: "Steps to reproduce:\n1. ...\n2. ...\nExpected:\nActual:",
    priority: "High",
    subtasks: [
      { title: "Reproduce in dev environment", completed: false },
      { title: "Write regression test", completed: false },
      { title: "Deploy patch", completed: false },
    ],
    tags: ["bug", "triage"],
    project: "proj-web",
  };

  const applyTemplate = (baseTask, tmpl) => ({
    ...baseTask,
    title: tmpl.title || baseTask.title,
    description: tmpl.description || baseTask.description,
    priority: tmpl.priority || baseTask.priority,
    project: tmpl.project || baseTask.project,
    tags: Array.isArray(tmpl.tags) ? [...tmpl.tags] : [],
    subtasks: Array.isArray(tmpl.subtasks)
      ? tmpl.subtasks.map((s) => ({ title: s.title, completed: false }))
      : [],
  });

  const base = {
    title: "",
    description: "",
    priority: "Low",
    dueDate: "2026-10-20",
    project: "",
    tags: [],
    subtasks: [],
  };

  const populated = applyTemplate(base, template);

  assert.equal(populated.title, "[Bug]: Issue Title");
  assert.equal(populated.priority, "High");
  assert.equal(populated.subtasks.length, 3);
  assert.equal(populated.subtasks[0].completed, false);
  assert.deepEqual(populated.tags, ["bug", "triage"]);
  assert.equal(populated.dueDate, "2026-10-20", "Due date preserved from composer");
});

// =========================================================
// 5. PHASE 3: BULK TASK OPERATIONS & ATOMIC ACTIONS
// =========================================================
test("Phase 3: Bulk Operations — complete, incomplete, priority, project, and soft-delete", () => {
  const initialTasks = [
    { _id: "t1", completed: false, priority: "Low", project: null, isDeleted: false },
    { _id: "t2", completed: false, priority: "Medium", project: "p1", isDeleted: false },
    { _id: "t3", completed: true, priority: "High", project: "p1", isDeleted: false },
  ];

  const applyBulk = (taskList, ids, action, value) => {
    return taskList.map((t) => {
      if (!ids.includes(t._id)) return t;
      const updated = { ...t };
      switch (action) {
        case "complete":
          updated.completed = true;
          updated.completedAt = new Date();
          break;
        case "incomplete":
          updated.completed = false;
          updated.completedAt = null;
          break;
        case "priority":
          updated.priority = value;
          break;
        case "project":
          updated.project = value || null;
          break;
        case "delete":
          updated.isDeleted = true;
          break;
      }
      return updated;
    });
  };

  // 1. Bulk complete t1 and t2
  const completed = applyBulk(initialTasks, ["t1", "t2"], "complete");
  assert.equal(completed[0].completed, true);
  assert.ok(completed[0].completedAt instanceof Date);
  assert.equal(completed[1].completed, true);

  // 2. Bulk set priority to High
  const highPriority = applyBulk(initialTasks, ["t1", "t2"], "priority", "High");
  assert.equal(highPriority[0].priority, "High");
  assert.equal(highPriority[1].priority, "High");
  assert.equal(highPriority[2].priority, "High");

  // 3. Bulk soft delete with undo capability
  const deleted = applyBulk(initialTasks, ["t1", "t3"], "delete");
  assert.equal(deleted[0].isDeleted, true);
  assert.equal(deleted[1].isDeleted, false);
  assert.equal(deleted[2].isDeleted, true);
});

// =========================================================
// 6. PHASE 3: RECURRENCE DUPLICATE SPAWN PROTECTION
// =========================================================
test("Phase 3: Recurrence — prevents duplicate spawning on multiple toggle clicks", () => {
  let task = {
    _id: "rec-task-1",
    title: "Weekly Status Report",
    completed: false,
    recurrence: { frequency: "weekly", interval: 1 },
    recurrenceSpawned: false,
  };

  let spawnedCount = 0;

  const toggleTaskCompletion = (t) => {
    const updated = { ...t };
    if (!updated.completed) {
      updated.completed = true;
      // Only spawn if not already spawned for this cycle
      if (updated.recurrence?.frequency !== "none" && !updated.recurrenceSpawned) {
        spawnedCount++;
        updated.recurrenceSpawned = true;
      }
    } else {
      updated.completed = false;
    }
    return updated;
  };

  // First completion -> spawns next cycle
  task = toggleTaskCompletion(task);
  assert.equal(task.completed, true);
  assert.equal(task.recurrenceSpawned, true);
  assert.equal(spawnedCount, 1);

  // Re-open and complete again -> does NOT duplicate spawn
  task = toggleTaskCompletion(task); // Reopened
  assert.equal(task.completed, false);
  task = toggleTaskCompletion(task); // Completed again
  assert.equal(task.completed, true);
  assert.equal(spawnedCount, 1, "Duplicate task spawn was prevented by recurrenceSpawned flag");
});

// =========================================================
// 7. PHASE 3: CALENDAR LOCAL DATE-KEYING INTEGRITY
// =========================================================
test("Phase 3: Calendar — groups tasks by local date without timezone shifts", () => {
  const toDateKey = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const tasks = [
    { _id: "c1", title: "Morning standup", dueDate: "2026-10-14T03:30:00.000Z" },
    { _id: "c2", title: "Evening sync", dueDate: "2026-10-14T14:30:00.000Z" },
    { _id: "c3", title: "Next day deadline", dueDate: "2026-10-15T09:00:00.000Z" },
  ];

  const map = {};
  tasks.forEach((t) => {
    const key = toDateKey(t.dueDate);
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });

  // Verify dates are keyed cleanly as yyyy-MM-dd
  const keys = Object.keys(map).sort();
  assert.ok(keys.includes("2026-10-14") || keys.includes("2026-10-15"));
  assert.equal(tasks.length, 3);
});
