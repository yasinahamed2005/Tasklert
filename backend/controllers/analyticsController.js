import mongoose from "mongoose";
import Task from "../models/taskModel.js";
import FocusSession from "../models/focusSessionModel.js";

const getUserId = (req) => req.user?.id || req.user?._id;

// Helper to sanitize cell string against CSV formula injection
const sanitizeCsvCell = (val) => {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // If text starts with dangerous formula triggers (=, +, -, @, tab, carriage return), prepend single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If text contains quotes, commas or linebreaks, enclose in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Parse and validate date ranges (7d, 30d, 90d, custom)
const parseDateRange = (range = "30d", startDate, endDate) => {
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
  } else if (range === "custom" && startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      throw new Error("Invalid custom date range. Start date must be before end date.");
    }

    // Limit custom range to maximum 365 days to prevent resource exhaustion
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      throw new Error("Custom date range cannot exceed 365 days.");
    }
  } else {
    // Default to 30 days
    start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

// GET /api/analytics/summary
export const getAnalyticsSummary = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { range = "30d", startDate, endDate } = req.query;

    const { start, end } = parseDateRange(range, startDate, endDate);
    const now = new Date();

    // Duration of current period in ms
    const periodDuration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodDuration);
    const prevEnd = new Date(start.getTime() - 1);

    const userObjectId = new mongoose.Types.ObjectId(String(userId));

    // A. Current Period Metrics
    // 1. Tasks created in period
    const tasksCreatedInPeriod = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      createdAt: { $gte: start, $lte: end },
    });

    // 2. Tasks completed in period (strictly using reliable completedAt timestamp)
    const tasksCompletedInPeriod = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      completed: true,
      completedAt: { $gte: start, $lte: end },
    });

    // 3. Current active pending tasks (both in-period and all-time)
    const pendingInPeriod = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      completed: false,
      createdAt: { $gte: start, $lte: end },
    });

    const pendingTasks = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      completed: false,
    });

    // 4. Overdue incomplete tasks
    const overdueTasks = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      completed: false,
      dueDate: { $lt: now },
    });

    // 5. Total tasks created all time
    const totalLifetimeTasks = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
    });

    // 6. Focus session time in period
    const focusSessionsInPeriod = await FocusSession.find({
      owner: userObjectId,
      status: "completed",
      sessionType: "focus",
      startedAt: { $gte: start, $lte: end },
    }).select("actualElapsedSeconds");

    const totalFocusMinutesInPeriod = Math.round(
      focusSessionsInPeriod.reduce((acc, s) => acc + (s.actualElapsedSeconds || 0), 0) / 60
    );

    // B. Previous Equivalent Period Metrics (For trend comparison)
    const prevCreated = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      createdAt: { $gte: prevStart, $lte: prevEnd },
    });

    const prevCompleted = await Task.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      completed: true,
      completedAt: { $gte: prevStart, $lte: prevEnd },
    });

    // C. Priority Breakdown for the selected period
    // Scoped strictly to tasks created or completed in period (pending tasks outside period do not distort)
    const priorityAggregation = await Task.aggregate([
      {
        $match: {
          owner: userObjectId,
          isDeleted: { $ne: true },
          $or: [
            { createdAt: { $gte: start, $lte: end } },
            { completedAt: { $gte: start, $lte: end } },
          ],
        },
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
          },
        },
      },
    ]);

    const priorityBreakdown = {
      High: { total: 0, completed: 0 },
      Medium: { total: 0, completed: 0 },
      Low: { total: 0, completed: 0 },
    };

    priorityAggregation.forEach((item) => {
      if (item._id && priorityBreakdown[item._id]) {
        priorityBreakdown[item._id].total = item.count;
        priorityBreakdown[item._id].completed = item.completedCount;
      }
    });

    // D. Daily Timeline Trend (Created vs Completed over time)
    // Build continuous date buckets across the selected range
    const timelineBuckets = {};
    const curr = new Date(start);
    while (curr <= end) {
      const dateKey = curr.toISOString().split("T")[0];
      timelineBuckets[dateKey] = { date: dateKey, created: 0, completed: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    // Aggregate created tasks grouped by date
    const createdTimeline = await Task.aggregate([
      {
        $match: {
          owner: userObjectId,
          isDeleted: { $ne: true },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);

    createdTimeline.forEach((item) => {
      if (timelineBuckets[item._id]) {
        timelineBuckets[item._id].created = item.count;
      }
    });

    // Aggregate completed tasks grouped by date (only where completedAt is known!)
    const completedTimeline = await Task.aggregate([
      {
        $match: {
          owner: userObjectId,
          isDeleted: { $ne: true },
          completed: true,
          completedAt: { $gte: start, $lte: end, $ne: null },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          count: { $sum: 1 },
        },
      },
    ]);

    completedTimeline.forEach((item) => {
      if (timelineBuckets[item._id]) {
        timelineBuckets[item._id].completed = item.count;
      }
    });

    const timeline = Object.values(timelineBuckets).sort((a, b) => a.date.localeCompare(b.date));

    // E. Completion Rate Calculation
    // Formula: (tasksCompletedInPeriod / (tasksCompletedInPeriod + pendingInPeriod)) * 100
    // Scoped strictly to the selected period so pending tasks outside the period do not distort the metrics
    const completionDenominator = tasksCompletedInPeriod + pendingInPeriod;
    const completionRate =
      completionDenominator > 0
        ? Math.round((tasksCompletedInPeriod / completionDenominator) * 100)
        : 0;

    // F. Comparative Growth Calculations
    const calculatePctDiff = (currVal, prevVal) => {
      if (prevVal === 0) return currVal > 0 ? 100 : 0;
      return Math.round(((currVal - prevVal) / prevVal) * 100);
    };

    const createdDiffPct = calculatePctDiff(tasksCreatedInPeriod, prevCreated);
    const completedDiffPct = calculatePctDiff(tasksCompletedInPeriod, prevCompleted);

    const hasActivity = totalLifetimeTasks > 0;

    res.json({
      success: true,
      range: {
        type: range,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        createdInPeriod: tasksCreatedInPeriod,
        completedInPeriod: tasksCompletedInPeriod,
        pendingInPeriod,
        pendingTasks,
        overdueTasks,
        totalLifetimeTasks,
        completionRate,
        focusMinutes: totalFocusMinutesInPeriod,
        comparison: {
          hasPrevData: prevCreated > 0 || prevCompleted > 0,
          createdChangePct: createdDiffPct,
          completedChangePct: completedDiffPct,
        },
      },
      priorityBreakdown,
      timeline,
      hasActivity,
    });
  } catch (err) {
    console.error("getAnalyticsSummary error:", err);
    res.status(400).json({ success: false, message: err.message || "Failed to compute analytics." });
  }
};

// GET /api/analytics/export (CSV Export)
export const exportDataCSV = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type = "tasks", range = "30d", startDate, endDate } = req.query;

    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const { start, end } = parseDateRange(range, startDate, endDate);

    let csvContent = "";
    let filename = `tasklert_${type}_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}.csv`;

    if (type === "tasks") {
      const tasks = await Task.find({
        owner: userObjectId,
        isDeleted: { $ne: true },
        $or: [
          { createdAt: { $gte: start, $lte: end } },
          { completedAt: { $gte: start, $lte: end } },
        ],
      })
        .populate("project", "name")
        .sort({ createdAt: -1 });

      const headers = [
        "Title",
        "Description",
        "Priority",
        "Status",
        "Due Date",
        "Completed At",
        "Created At",
        "Tags",
        "Project",
      ];
      const rows = [headers.join(",")];

      tasks.forEach((t) => {
        const row = [
          sanitizeCsvCell(t.title),
          sanitizeCsvCell(t.description),
          sanitizeCsvCell(t.priority),
          sanitizeCsvCell(t.completed ? "Completed" : "Pending"),
          sanitizeCsvCell(t.dueDate ? t.dueDate.toISOString() : "None"),
          sanitizeCsvCell(t.completedAt ? t.completedAt.toISOString() : (t.completed ? "Legacy Completed" : "Not Completed")),
          sanitizeCsvCell(t.createdAt ? t.createdAt.toISOString() : ""),
          sanitizeCsvCell(t.tags ? t.tags.join("; ") : ""),
          sanitizeCsvCell(t.project?.name || "None"),
        ];
        rows.push(row.join(","));
      });

      csvContent = rows.join("\r\n");
    } else if (type === "focus") {
      const sessions = await FocusSession.find({
        owner: userObjectId,
        startedAt: { $gte: start, $lte: end },
      })
        .populate("task", "title")
        .sort({ startedAt: -1 });

      const headers = [
        "Session Type",
        "Associated Task",
        "Planned Duration (Minutes)",
        "Actual Elapsed (Minutes)",
        "Status",
        "Started At",
        "Ended At",
        "Notes",
      ];
      const rows = [headers.join(",")];

      sessions.forEach((s) => {
        const row = [
          sanitizeCsvCell(s.sessionType),
          sanitizeCsvCell(s.task?.title || "None"),
          sanitizeCsvCell(Math.round((s.plannedDuration || 0) / 60)),
          sanitizeCsvCell(Math.round((s.actualElapsedSeconds || 0) / 60)),
          sanitizeCsvCell(s.status),
          sanitizeCsvCell(s.startedAt ? s.startedAt.toISOString() : ""),
          sanitizeCsvCell(s.endedAt ? s.endedAt.toISOString() : ""),
          sanitizeCsvCell(s.clientNotes || ""),
        ];
        rows.push(row.join(","));
      });

      csvContent = rows.join("\r\n");
    } else {
      return res.status(400).json({ success: false, message: `Unknown export type: ${type}. Use 'tasks' or 'focus'.` });
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send("\uFEFF" + csvContent); // Prepend UTF-8 BOM for Excel compatibility
  } catch (err) {
    console.error("exportDataCSV error:", err);
    res.status(400).json({ success: false, message: err.message || "Failed to export CSV." });
  }
};
