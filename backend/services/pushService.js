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
 * Classify Web Push delivery error codes
 */
export function classifyPushError(err) {
  const statusCode = err?.statusCode || null;
  if (statusCode === 404 || statusCode === 410) {
    return {
      category: "expired_subscription",
      isRetryable: false,
      statusCode,
      reason: "Subscription expired or revoked by browser",
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      category: "auth_error",
      isRetryable: false,
      statusCode,
      reason: "VAPID authentication or origin rejected by push service",
    };
  }
  if (statusCode === 413) {
    return {
      category: "payload_too_large",
      isRetryable: false,
      statusCode,
      reason: "Notification payload size exceeds provider limit",
    };
  }
  if (statusCode === 429) {
    return {
      category: "rate_limited",
      isRetryable: true,
      statusCode,
      reason: "Push service rate limited the dispatch",
    };
  }
  if (statusCode >= 500 && statusCode < 600) {
    return {
      category: "server_error",
      isRetryable: true,
      statusCode,
      reason: `Push service transient error (HTTP ${statusCode})`,
    };
  }
  const code = err?.code || "";
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) {
    return {
      category: "network_transient",
      isRetryable: true,
      statusCode: 0,
      reason: `Network connection issue (${code})`,
    };
  }
  return {
    category: "unknown",
    isRetryable: false,
    statusCode,
    reason: err?.message || "Push delivery failed",
  };
}

/**
 * Dispatch Web Push notification to all active device subscriptions of a user
 */
export async function sendPushToUser(userId, payload, metadata = {}) {
  if (!isVapidConfigured()) {
    console.warn("Cannot send push: VAPID keys not configured");
    return { success: false, reason: "VAPID_NOT_CONFIGURED", acceptedCount: 0 };
  }

  try {
    const subscriptions = await PushSubscription.find({
      owner: userId,
      subscriptionStatus: "active",
    });

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, acceptedCount: 0, totalDevices: 0, message: "No active devices subscribed" };
    }

    const payloadString = JSON.stringify(payload);
    let acceptedCount = 0;
    let failedCount = 0;
    let hasRetryableError = false;
    const errors = [];

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

        acceptedCount++;

        // Log provider acceptance (honest reporting)
        await DeliveryLog.create({
          owner: userId,
          reminder: metadata.reminderId || null,
          task: metadata.taskId || null,
          channel: "push",
          target: sub.deviceName || "Browser Device",
          status: "accepted",
          statusCode: response.statusCode || 201,
          attempt: metadata.attempt || 1,
          payloadSummary: payload.title || "Alarm",
        }).catch(() => {});

        // Update device last active & last successful push
        await PushSubscription.updateOne(
          { _id: sub._id },
          { lastActive: new Date(), lastSuccessfulPush: new Date(), subscriptionStatus: "active" }
        ).catch(() => {});
      } catch (err) {
        failedCount++;
        const classified = classifyPushError(err);
        if (classified.isRetryable) {
          hasRetryableError = true;
        }
        errors.push(classified.reason);

        // Auto-prune expired subscriptions
        if (classified.category === "expired_subscription") {
          console.log(`Pruning expired push subscription ${sub._id} (${classified.statusCode})`);
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});

          await DeliveryLog.create({
            owner: userId,
            reminder: metadata.reminderId || null,
            task: metadata.taskId || null,
            channel: "push",
            target: sub.deviceName || "Browser Device",
            status: "unsubscribed",
            statusCode: classified.statusCode,
            errorCategory: classified.category,
            error: classified.reason,
            attempt: metadata.attempt || 1,
            payloadSummary: payload.title || "Alarm",
          }).catch(() => {});
        } else {
          await DeliveryLog.create({
            owner: userId,
            reminder: metadata.reminderId || null,
            task: metadata.taskId || null,
            channel: "push",
            target: sub.deviceName || "Browser Device",
            status: classified.isRetryable ? "failed_retryable" : "failed",
            statusCode: classified.statusCode,
            errorCategory: classified.category,
            error: classified.reason,
            attempt: metadata.attempt || 1,
            payloadSummary: payload.title || "Alarm",
          }).catch(() => {});
        }
      }
    });

    await Promise.allSettled(dispatchPromises);

    return {
      success: acceptedCount > 0,
      acceptedCount,
      failedCount,
      totalDevices: subscriptions.length,
      hasRetryableError: acceptedCount === 0 && hasRetryableError,
      errors,
    };
  } catch (error) {
    console.error("sendPushToUser general error:", error);
    return { success: false, error: error.message, isRetryable: true };
  }
}

/**
 * Dispatch Web Push notification to a single specific device subscription
 */
export async function sendPushToSubscription(sub, payload, metadata = {}) {
  if (!isVapidConfigured()) {
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
      target: sub.deviceName || "Browser Device",
      status: "accepted",
      statusCode: response.statusCode || 201,
      attempt: metadata.attempt || 1,
      payloadSummary: payload.title || "Alarm",
    }).catch(() => {});

    return { success: true, statusCode: response.statusCode || 201 };
  } catch (err) {
    const classified = classifyPushError(err);
    if (classified.category === "expired_subscription") {
      await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
    }

    await DeliveryLog.create({
      owner: sub.owner,
      reminder: metadata.reminderId || null,
      task: metadata.taskId || null,
      channel: "push",
      target: sub.deviceName || "Browser Device",
      status: classified.isRetryable ? "failed_retryable" : "failed",
      statusCode: classified.statusCode,
      errorCategory: classified.category,
      error: classified.reason,
      attempt: metadata.attempt || 1,
      payloadSummary: payload.title || "Alarm",
    }).catch(() => {});

    return {
      success: false,
      error: classified.reason,
      errorCategory: classified.category,
      isRetryable: classified.isRetryable,
      statusCode: classified.statusCode,
    };
  }
}
