import FocusSession from "../models/focusSessionModel.js";
import Task from "../models/taskModel.js";

// Helper to get authenticated user ID
const getUserId = (req) => req.user?.id || req.user?._id;

// START FOCUS SESSION
export const startSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId, sessionType = "focus", plannedDuration = 1500, clientNotes } = req.body;

    const validTypes = ["focus", "short_break", "long_break"];
    if (!validTypes.includes(sessionType)) {
      return res.status(400).json({ success: false, message: `Invalid session type: ${sessionType}` });
    }

    const durationNum = Number(plannedDuration);
    if (!Number.isInteger(durationNum) || durationNum < 60 || durationNum > 7200) {
      return res.status(400).json({
        success: false,
        message: "Planned duration must be between 60 seconds (1 min) and 7200 seconds (120 mins).",
      });
    }

    // Verify task belongs to authenticated user if provided
    let linkedTaskId = null;
    if (taskId) {
      const task = await Task.findOne({ _id: taskId, owner: userId, isDeleted: { $ne: true } });
      if (!task) {
        return res.status(404).json({ success: false, message: "Associated task not found or not yours." });
      }
      linkedTaskId = task._id;
    }

    // Cancel any stale/abandoned active sessions (> 12 hours old)
    const staleThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000);
    await FocusSession.updateMany(
      { owner: userId, status: { $in: ["running", "paused"] }, createdAt: { $lt: staleThreshold } },
      { status: "cancelled", endedAt: new Date() }
    );

    // Cancel any currently running/paused session to avoid overlapping active timers
    await FocusSession.updateMany(
      { owner: userId, status: { $in: ["running", "paused"] } },
      { status: "cancelled", endedAt: new Date() }
    );

    const now = new Date();
    const session = new FocusSession({
      owner: userId,
      task: linkedTaskId,
      sessionType,
      plannedDuration: durationNum,
      actualElapsedSeconds: 0,
      accumulatedSeconds: 0,
      startedAt: now,
      lastResumedAt: now,
      status: "running",
      clientNotes: typeof clientNotes === "string" ? clientNotes.slice(0, 500) : "",
    });

    await session.save();
    if (linkedTaskId) {
      await session.populate("task", "title priority completed");
    }

    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error("startSession error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET ACTIVE SESSION (Recovers state on refresh or multi-tab navigation)
export const getActiveSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await FocusSession.findOne({
      owner: userId,
      status: { $in: ["running", "paused"] },
    })
      .sort({ createdAt: -1 })
      .populate("task", "title priority completed");

    if (!session) {
      return res.json({ success: true, activeSession: null });
    }

    // Calculate authoritative live elapsed time
    const now = Date.now();
    let currentElapsed = session.accumulatedSeconds || 0;
    if (session.status === "running") {
      const delta = Math.max(0, Math.floor((now - new Date(session.lastResumedAt).getTime()) / 1000));
      currentElapsed += delta;
    }

    // If session has been unattended for an excessive duration (> planned + 2 hours), auto-cancel it
    if (currentElapsed > session.plannedDuration + 7200) {
      session.status = "cancelled";
      session.endedAt = new Date();
      await session.save();
      return res.json({ success: true, activeSession: null });
    }

    res.json({
      success: true,
      activeSession: {
        ...session.toObject(),
        liveElapsedSeconds: Math.min(currentElapsed, session.plannedDuration),
        remainingSeconds: Math.max(0, session.plannedDuration - currentElapsed),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PAUSE ACTIVE SESSION
export const pauseSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await FocusSession.findOne({ _id: req.params.id, owner: userId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found or not yours." });
    }

    if (session.status !== "running") {
      return res.status(400).json({ success: false, message: `Cannot pause session in status '${session.status}'.` });
    }

    const now = Date.now();
    const delta = Math.max(0, Math.floor((now - new Date(session.lastResumedAt).getTime()) / 1000));
    const newAccumulated = (session.accumulatedSeconds || 0) + delta;

    session.accumulatedSeconds = Math.min(newAccumulated, session.plannedDuration);
    session.actualElapsedSeconds = session.accumulatedSeconds;
    session.status = "paused";
    session.lastResumedAt = new Date(now);

    await session.save();
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// RESUME PAUSED SESSION
export const resumeSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await FocusSession.findOne({ _id: req.params.id, owner: userId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found or not yours." });
    }

    if (session.status !== "paused") {
      return res.status(400).json({ success: false, message: `Cannot resume session in status '${session.status}'.` });
    }

    session.status = "running";
    session.lastResumedAt = new Date();

    await session.save();
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// COMPLETE SESSION (Authoritatively calculates elapsed duration and guards against duplicates)
export const completeSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await FocusSession.findOne({ _id: req.params.id, owner: userId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found or not yours." });
    }

    // Idempotency: if already completed, return existing without error
    if (session.status === "completed") {
      return res.json({ success: true, session, message: "Session was already marked completed." });
    }

    if (session.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot complete a cancelled session." });
    }

    const now = Date.now();
    let totalElapsed = session.accumulatedSeconds || 0;
    if (session.status === "running") {
      const delta = Math.max(0, Math.floor((now - new Date(session.lastResumedAt).getTime()) / 1000));
      totalElapsed += delta;
    }

    // Server enforces bounded elapsed time (cannot exceed planned duration + 300s grace period)
    const boundedElapsed = Math.min(totalElapsed, session.plannedDuration + 300);

    session.actualElapsedSeconds = boundedElapsed;
    session.status = "completed";
    session.endedAt = new Date(now);

    await session.save();
    if (session.task) {
      await session.populate("task", "title priority completed");
    }

    res.json({ success: true, session, message: "Focus session completed successfully! 🎉" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CANCEL SESSION
export const cancelSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const session = await FocusSession.findOne({ _id: req.params.id, owner: userId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found or not yours." });
    }

    session.status = "cancelled";
    session.endedAt = new Date();
    await session.save();

    res.json({ success: true, session, message: "Focus session cancelled." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET FOCUS SESSIONS HISTORY & TOTAL STATS
export const getFocusHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 30, sessionType } = req.query;

    const filter = { owner: userId };
    if (sessionType && ["focus", "short_break", "long_break"].includes(sessionType)) {
      filter.sessionType = sessionType;
    }

    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 30));

    // Fetch history
    const sessions = await FocusSession.find(filter)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .populate("task", "title priority completed");

    // Aggregate completed focus stats (Cancelled / incomplete sessions NEVER count)
    const completedFocusFilter = { owner: userId, status: "completed", sessionType: "focus" };
    const allCompletedFocus = await FocusSession.find(completedFocusFilter).select("actualElapsedSeconds startedAt");

    let totalCompletedSessions = allCompletedFocus.length;
    let totalFocusSeconds = 0;
    let todayFocusSeconds = 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    allCompletedFocus.forEach((s) => {
      const elapsed = s.actualElapsedSeconds || 0;
      totalFocusSeconds += elapsed;
      if (s.startedAt && new Date(s.startedAt) >= startOfToday) {
        todayFocusSeconds += elapsed;
      }
    });

    res.json({
      success: true,
      summary: {
        totalCompletedSessions,
        totalFocusMinutes: Math.round(totalFocusSeconds / 60),
        todayFocusMinutes: Math.round(todayFocusSeconds / 60),
      },
      sessions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
