import PushSubscription from "../models/pushSubscriptionModel.js";
import {
  getPublicVapidKey,
  isVapidConfigured,
  sendPushToUser,
  sendPushToSubscription,
} from "../services/pushService.js";

// GET /api/notifications/vapid-public-key
export const getVapidPublicKey = async (req, res) => {
  try {
    const key = getPublicVapidKey();
    res.json({
      success: true,
      publicKey: key,
      configured: isVapidConfigured(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/notifications/subscribe
export const subscribeDevice = async (req, res) => {
  try {
    const {
      endpoint,
      keys,
      deviceId,
      deviceName,
      customLabel,
      deviceType,
      browser,
      isPWA,
      userAgent,
    } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription object. Endpoint and keys are required.",
      });
    }

    const userId = req.user.id || req.user._id;

    // Upsert subscription by endpoint to ensure uniqueness
    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        owner: userId,
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        deviceId: deviceId || "",
        deviceName: deviceName || "Browser Device",
        customLabel: customLabel || "",
        deviceType: deviceType || "other",
        browser: browser || "Unknown",
        isPWA: Boolean(isPWA),
        subscriptionStatus: "active",
        userAgent: userAgent || req.headers["user-agent"] || "",
        lastActive: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      message: "Device subscribed successfully to push notifications",
      subscription: {
        id: subscription._id,
        deviceName: subscription.deviceName,
        customLabel: subscription.customLabel,
        deviceType: subscription.deviceType,
        browser: subscription.browser,
        isPWA: subscription.isPWA,
        lastActive: subscription.lastActive,
      },
    });
  } catch (err) {
    console.error("Error subscribing device:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/notifications/unsubscribe
export const unsubscribeDevice = async (req, res) => {
  try {
    const { endpoint, deviceId } = req.body;
    const userId = req.user.id || req.user._id;

    const query = { owner: userId };
    if (endpoint) query.endpoint = endpoint;
    else if (deviceId) query.deviceId = deviceId;
    else {
      return res.status(400).json({
        success: false,
        message: "Endpoint or deviceId required to unsubscribe",
      });
    }

    const result = await PushSubscription.deleteMany(query);

    res.json({
      success: true,
      message: "Device unsubscribed successfully",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/notifications/devices
export const getDevices = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const devices = await PushSubscription.find({ owner: userId })
      .select("deviceName customLabel deviceType browser isPWA subscriptionStatus deviceId lastActive lastSuccessfulPush createdAt endpoint userAgent")
      .sort({ lastActive: -1 });

    const formattedDevices = devices.map((d) => ({
      id: d._id,
      deviceName: d.deviceName,
      customLabel: d.customLabel || "",
      deviceType: d.deviceType || "other",
      browser: d.browser || "Unknown",
      isPWA: Boolean(d.isPWA),
      deviceId: d.deviceId,
      subscriptionStatus: d.subscriptionStatus || "active",
      lastActive: d.lastActive,
      lastSuccessfulPush: d.lastSuccessfulPush,
      createdAt: d.createdAt,
      endpointPreview: d.endpoint ? d.endpoint.slice(0, 45) + "..." : "",
      userAgent: d.userAgent,
    }));

    res.json({
      success: true,
      devices: formattedDevices,
      count: formattedDevices.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/notifications/devices/:id
export const updateDevice = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { customLabel, deviceName } = req.body;

    const updateFields = {};
    if (customLabel !== undefined) updateFields.customLabel = String(customLabel).trim();
    if (deviceName !== undefined) updateFields.deviceName = String(deviceName).trim();

    const device = await PushSubscription.findOneAndUpdate(
      { _id: req.params.id, owner: userId },
      updateFields,
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device subscription not found or not owned by you",
      });
    }

    res.json({
      success: true,
      message: "Device updated successfully",
      device: {
        id: device._id,
        deviceName: device.deviceName,
        customLabel: device.customLabel,
        deviceType: device.deviceType,
        browser: device.browser,
        isPWA: device.isPWA,
        lastActive: device.lastActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/notifications/devices/:id/test
export const sendDeviceTestNotification = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const device = await PushSubscription.findOne({ _id: req.params.id, owner: userId });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found or not registered to your account.",
      });
    }

    const testPayload = {
      title: "Tasklert Alarm Test ⏰",
      body: `Direct test alert sent to "${device.customLabel || device.deviceName}". Your device is connected!`,
      icon: "/tasklert-icon.svg",
      badge: "/favicon.png",
      tag: `tasklert-test-${Date.now()}`,
      url: "/",
      sound: "digital",
      priority: "High",
      timestamp: Date.now(),
      actions: [
        { action: "open", title: "Open Tasklert" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    const result = await sendPushToSubscription(device, testPayload, { priority: "High" });

    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: `Failed to deliver push notification: ${result.error || "Push service rejected"}`,
      });
    }

    res.json({
      success: true,
      message: `Test notification sent successfully to ${device.customLabel || device.deviceName}!`,
      statusCode: result.statusCode,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/notifications/devices/:id
export const deleteDevice = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const deleted = await PushSubscription.findOneAndDelete({
      _id: req.params.id,
      owner: userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Device subscription not found or not yours",
      });
    }

    res.json({
      success: true,
      message: "Device removed successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/notifications/test
export const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDevices = await PushSubscription.countDocuments({ owner: userId });

    if (userDevices === 0) {
      return res.status(400).json({
        success: false,
        message: "No registered devices found. Please enable notifications on this device first.",
      });
    }

    const testPayload = {
      title: "Tasklert Alarm Test ⏰",
      body: "This is a real test push notification from Tasklert! Your device is successfully connected.",
      icon: "/tasklert-icon.svg",
      badge: "/favicon.png",
      tag: "tasklert-test-notification",
      url: "/",
      sound: "digital",
      priority: "High",
      timestamp: Date.now(),
      actions: [
        { action: "open", title: "Open Tasklert" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    const result = await sendPushToUser(userId, testPayload, { priority: "High" });

    res.json({
      success: true,
      message: `Test notification sent to ${result.sentCount} of ${userDevices} registered device(s).`,
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
