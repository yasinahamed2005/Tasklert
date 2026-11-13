import UserDevice from "../models/userDeviceModel.js";
import Reminder from "../models/reminderModel.js";

/**
 * Register or update device record
 * POST /api/devices/register
 */
export const registerDevice = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      deviceId,
      deviceType,
      platform,
      deviceName,
      userAgent,
      nativeAlarmCapability,
      exactAlarmPermission,
      notificationPermission,
      fullScreenIntentPermission,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const updateData = {
      owner: userId,
      deviceId,
      deviceType: deviceType || "unknown",
      platform: platform || "unknown",
      deviceName: deviceName || "Tasklert Client",
      userAgent: userAgent || req.headers["user-agent"] || "",
      nativeAlarmCapability: Boolean(nativeAlarmCapability),
      exactAlarmPermission: Boolean(exactAlarmPermission),
      notificationPermission: Boolean(notificationPermission),
      fullScreenIntentPermission: Boolean(fullScreenIntentPermission),
      activeStatus: "active",
      lastSeenAt: new Date(),
    };

    const device = await UserDevice.findOneAndUpdate(
      { owner: userId, deviceId },
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Device registered successfully",
      device,
      isPrimaryAlarmDevice: Boolean(device.nativeAlarmCapability && device.exactAlarmPermission),
    });
  } catch (err) {
    console.error("registerDevice error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Send heartbeat to maintain online status
 * POST /api/devices/heartbeat
 */
export const heartbeatDevice = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { deviceId, activeStatus = "active" } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const device = await UserDevice.findOneAndUpdate(
      { owner: userId, deviceId },
      { lastSeenAt: new Date(), activeStatus },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    return res.status(200).json({ success: true, device });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Mobile device confirms that a specific alarm was scheduled in native AlarmManager
 * POST /api/devices/confirm-alarm
 */
export const confirmAlarmScheduled = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { deviceId, alarmId } = req.body;

    if (!deviceId || !alarmId) {
      return res.status(400).json({ success: false, message: "deviceId and alarmId are required" });
    }

    // 1. Add alarmId to device's confirmed list
    await UserDevice.updateOne(
      { owner: userId, deviceId },
      {
        $addToSet: { confirmedAlarmIds: String(alarmId) },
        lastSeenAt: new Date(),
        activeStatus: "active",
      }
    );

    // 2. Mark reminder as owned and confirmed by mobile device
    const updatedReminder = await Reminder.findOneAndUpdate(
      { _id: alarmId, owner: userId },
      {
        deviceOwner: "mobile_primary",
        mobileConfirmedAt: new Date(),
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Alarm schedule confirmed by primary mobile device",
      reminder: updatedReminder,
    });
  } catch (err) {
    console.error("confirmAlarmScheduled error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get all registered devices for user with priority status
 * GET /api/devices
 */
export const getUserDevices = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const devices = await UserDevice.find({ owner: userId }).sort({ lastSeenAt: -1 });

    // Multi-device priority determination:
    // Any mobile device with nativeAlarmCapability seen in the last 24h is PRIMARY
    const primaryDevice = devices.find(
      (d) =>
        d.deviceType === "mobile" &&
        d.nativeAlarmCapability &&
        Date.now() - new Date(d.lastSeenAt).getTime() < 24 * 60 * 60 * 1000
    ) || null;

    return res.status(200).json({
      success: true,
      devices,
      primaryDevice: primaryDevice ? primaryDevice.deviceId : null,
      primaryDeviceType: primaryDevice ? primaryDevice.deviceType : null,
      hasMobilePrimary: Boolean(primaryDevice),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Deregister a device
 * DELETE /api/devices/:deviceId
 */
export const deregisterDevice = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { deviceId } = req.params;

    await UserDevice.deleteOne({ owner: userId, deviceId });
    return res.status(200).json({ success: true, message: "Device deregistered" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

