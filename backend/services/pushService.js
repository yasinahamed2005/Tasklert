import webpush from "web-push";
import PushSubscription from "../models/pushSubscriptionModel.js";
import DeliveryLog from "../models/deliveryLogModel.js";

// Initialize VAPID configuration
let vapidConfigured = false;

export function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@tasklert.com";

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
      console.log("✅ Web Push VAPID initialized successfully");
    } catch (err) {
      console.error("❌ Failed to initialize Web Push VAPID:", err.message);
      vapidConfigured = false;
    }
  } else {
    console.warn("⚠️ Web Push VAPID keys not configured in backend/.env");
    vapidConfigured = false;
  }
  return vapidConfigured;
}

// Auto-initialize on module load
initVapid();

export function isVapidConfigured() {
  if (!vapidConfigured) initVapid();
  return vapidConfigured;
}

export function getPublicVapidKey() {
  if (!vapidConfigured) initVapid();
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Dispatch Web Push notification to all active device subscriptions of a user
 */
export async function sendPushToUser(userId, payload, metadata = {}) {
  if (!vapidConfigured) {
    console.warn("Cannot send push: VAPID keys not configured");
    return { success: false, reason: "VAPID_NOT_CONFIGURED", sentCount: 0 };
  }

  try {
    const subscriptions = await PushSubscription.find({ owner: userId });
    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0, totalDevices: 0, message: "No devices subscribed" };
    }

    const payloadString = JSON.stringify(payload);
    let sentCount = 0;
    let failedCount = 0;

    const dispatchPromises = subscriptions.map(async (sub) => {
      const pushSubscriptionFormat = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        const response = await webpush.sendNotification(
          pushSubscriptionFormat,
          payloadString,
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: metadata.priority === "High" ? "high" : "normal",
          }
        );

        sentCount++;

        // Log success
        await DeliveryLog.create({
          owner: userId,
          reminder: metadata.reminderId || null,
          task: metadata.taskId || null,
          channel: "push",
          target: sub.endpoint.slice(0, 80) + "...",
          status: "success",
          statusCode: response.statusCode || 201,
          payloadSummary: payload.title || "Notification",
        }).catch(() => {});

        // Update device last active & last successful push
        await PushSubscription.updateOne(
          { _id: sub._id },
          { lastActive: new Date(), lastSuccessfulPush: new Date(), subscriptionStatus: "active" }
        ).catch(() => {});
      } catch (err) {
        failedCount++;
        const statusCode = err.statusCode || null;

        // Auto-prune expired or invalid subscriptions (404 Not Found, 410 Gone)
        if (statusCode === 404 || statusCode === 410) {
          console.log(`Pruning expired push subscription: ${sub._id} (status: ${statusCode})`);
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});

          await DeliveryLog.create({
            owner: userId,
            reminder: metadata.reminderId || null,
            task: metadata.taskId || null,
            channel: "push",
            target: sub.endpoint.slice(0, 80) + "...",
            status: "unsubscribed",
            statusCode,
            error: "Subscription expired or revoked",
            payloadSummary: payload.title || "Notification",
          }).catch(() => {});
        } else {
          console.error(`Push delivery error to ${sub._id}:`, err.message);

          await DeliveryLog.create({
            owner: userId,
            reminder: metadata.reminderId || null,
            task: metadata.taskId || null,
            channel: "push",
            target: sub.endpoint.slice(0, 80) + "...",
            status: "failed",
            statusCode,
            error: err.message,
            payloadSummary: payload.title || "Notification",
          }).catch(() => {});
        }
      }
    });

    await Promise.allSettled(dispatchPromises);

    return {
      success: true,
      sentCount,
      failedCount,
      totalDevices: subscriptions.length,
    };
  } catch (error) {
    console.error("sendPushToUser general error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Dispatch Web Push notification to a single specific device subscription
 */
export async function sendPushToSubscription(sub, payload, metadata = {}) {
  if (!vapidConfigured) {
    if (!initVapid()) {
      return { success: false, reason: "VAPID_NOT_CONFIGURED" };
    }
  }

  const pushSubscriptionFormat = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  };

  const payloadString = JSON.stringify(payload);

  try {
    const response = await webpush.sendNotification(
      pushSubscriptionFormat,
      payloadString,
      {
        TTL: 60 * 60 * 24,
        urgency: metadata.priority === "High" ? "high" : "normal",
      }
    );

    await PushSubscription.updateOne(
      { _id: sub._id },
      { lastActive: new Date(), lastSuccessfulPush: new Date(), subscriptionStatus: "active" }
    ).catch(() => {});

    await DeliveryLog.create({
      owner: sub.owner,
      reminder: metadata.reminderId || null,
      task: metadata.taskId || null,
      channel: "push",
      target: sub.endpoint.slice(0, 80) + "...",
      status: "success",
      statusCode: response.statusCode || 201,
      payloadSummary: payload.title || "Notification",
    }).catch(() => {});

    return { success: true, statusCode: response.statusCode || 201 };
  } catch (err) {
    const statusCode = err.statusCode || null;
    if (statusCode === 404 || statusCode === 410) {
      await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
    }
    return { success: false, error: err.message, statusCode };
  }
}
