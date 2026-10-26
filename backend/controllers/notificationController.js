import Notification from "../models/notificationModel.js";

export const getNotifications = async (req, res) => {
  try {
    const scope = req.query.scope === "all" ? {} : { read: false };

    const notifications = await Notification.find({
      owner: req.user.id,
      ...scope,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("task", "title dueDate priority completed");

    // 1. Identify stale notifications where task was deleted or completed
    const staleNotifications = notifications
      .filter((notification) => !notification.task || notification.task.completed)
      .map((notification) => notification._id);

    if (staleNotifications.length > 0) {
      await Notification.deleteMany({
        owner: req.user.id,
        _id: { $in: staleNotifications },
      });
    }

    // 2. Filter to active task notifications and deduplicate by logical event (task + kind)
    const seenEventKeys = new Set();
    const redundantIds = [];
    const visibleNotifications = [];

    for (const notif of notifications) {
      if (!notif.task || notif.task.completed) continue;
      const taskId = String(notif.task._id || notif.task);
      const eventKey = `${taskId}_${notif.kind}`;
      if (seenEventKeys.has(eventKey)) {
        // Redundant historical duplicate: mark for background cleanup
        redundantIds.push(notif._id);
      } else {
        seenEventKeys.add(eventKey);
        visibleNotifications.push(notif);
      }
    }

    if (redundantIds.length > 0) {
      await Notification.deleteMany({
        owner: req.user.id,
        _id: { $in: redundantIds },
      }).catch(() => {});
    }

    const unreadCount = await Notification.countDocuments({
      owner: req.user.id,
      read: false,
    });

    res.json({ success: true, notifications: visibleNotifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { owner: req.user.id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    const unreadCount = await Notification.countDocuments({
      owner: req.user.id,
      read: false,
    });

    res.json({ success: true, message: "Notification deleted", unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ owner: req.user.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
