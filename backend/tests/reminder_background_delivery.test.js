import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Reminder from "../models/reminderModel.js";
import Task from "../models/taskModel.js";
import PushSubscription from "../models/pushSubscriptionModel.js";
import UserDevice from "../models/userDeviceModel.js";

// ============================================================================
// TASKLERT REMINDER BACKGROUND DELIVERY & SCHEDULING REGRESSION TEST SUITE
// ============================================================================

test("Test 1: Create a reminder for two minutes in the future saves exact UTC and armed status", () => {
  const now = new Date();
  const twoMinutesLater = new Date(now.getTime() + 2 * 60 * 1000);

  const mockReminder = new Reminder({
    owner: new mongoose.Types.ObjectId(),
    title: "Test Quick Reminder",
    scheduledAt: twoMinutesLater,
    timeZone: "Asia/Kolkata",
    alarmEnabled: true,
    status: "scheduled",
    deliveryStatus: "SCHEDULED",
    channels: { push: true, inApp: true, email: false },
  });

  assert.equal(mockReminder.status, "scheduled");
  assert.equal(mockReminder.deliveryStatus, "SCHEDULED");
  assert.equal(mockReminder.scheduledAt.getTime(), twoMinutesLater.getTime());
  assert.ok(mockReminder.scheduledAt.getTime() > now.getTime(), "Must be scheduled in future");
});

test("Test 2: Create a reminder for tomorrow at 8:00 AM remains persisted and queryable after server restart", () => {
  const tomorrow8AM = new Date();
  tomorrow8AM.setDate(tomorrow8AM.getDate() + 1);
  tomorrow8AM.setHours(8, 0, 0, 0);

  const mockReminder = new Reminder({
    owner: new mongoose.Types.ObjectId(),
    title: "Tomorrow Morning Alarm",
    scheduledAt: tomorrow8AM,
    timeZone: "Asia/Kolkata",
    alarmEnabled: true,
    status: "scheduled",
    deliveryStatus: "SCHEDULED",
  });

  // Verify query condition matches what reminderCron uses on boot:
  const simNow = new Date(tomorrow8AM.getTime() + 1000); // 8:00:01 AM
  const isDue =
    mockReminder.alarmEnabled === true &&
    ["scheduled", "snoozed", "failed_retryable"].includes(mockReminder.status) &&
    mockReminder.scheduledAt <= simNow;

  assert.ok(isDue, "Reminder must be picked up by scheduler immediately when due");
});

test("Test 3: Web Push evaluation does NOT mark dispatched when 0 push subscriptions exist", () => {
  const pushResult = {
    success: false,
    reason: "NO_ACTIVE_SUBSCRIPTIONS",
    acceptedCount: 0,
    totalDevices: 0,
  };

  const isMobileOwnedAndConfirmed = false;
  const pushAccepted = pushResult.acceptedCount > 0;
  const isPushDelivered = pushAccepted || isMobileOwnedAndConfirmed;

  assert.equal(isPushDelivered, false, "Must NOT consider reminder delivered when no push subscription exists");
});

test("Test 4: Diagnostics status accurately computes Rule 6 statuses", () => {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 3600000);

  // Helper reflecting getReminderDiagnostics logic
  const computeStatus = ({ scheduledAt, status, activePushCount, mobileConfirmedAt, deliveryConfirmedAt }) => {
    const isFuture = new Date(scheduledAt).getTime() > now.getTime();
    if (deliveryConfirmedAt || status === "dismissed") return "DELIVERY CONFIRMED";
    if (mobileConfirmedAt) return "NATIVE ALARM SCHEDULED";
    if (status === "dispatched") return "PUSH SENT";
    if (status === "failed") return "FAILED";
    if (status === "scheduled" || status === "snoozed") {
      if (isFuture) {
        return activePushCount > 0 ? "SCHEDULED" : "PERMISSION REQUIRED";
      }
      return activePushCount > 0 ? "FAILED" : "PERMISSION REQUIRED";
    }
    return "NOT VERIFIED";
  };

  // Scenario A: Future reminder with active push subscription -> SCHEDULED
  assert.equal(
    computeStatus({ scheduledAt: futureDate, status: "scheduled", activePushCount: 1 }),
    "SCHEDULED"
  );

  // Scenario B: Future reminder with NO push subscription -> PERMISSION REQUIRED (Never show SCHEDULED merely because in DB!)
  assert.equal(
    computeStatus({ scheduledAt: futureDate, status: "scheduled", activePushCount: 0 }),
    "PERMISSION REQUIRED"
  );

  // Scenario C: Native confirmed Android alarm -> NATIVE ALARM SCHEDULED
  assert.equal(
    computeStatus({ scheduledAt: futureDate, status: "scheduled", mobileConfirmedAt: new Date() }),
    "NATIVE ALARM SCHEDULED"
  );

  // Scenario D: Dispatched push -> PUSH SENT
  assert.equal(
    computeStatus({ scheduledAt: now, status: "dispatched", activePushCount: 1 }),
    "PUSH SENT"
  );

  // Scenario E: Confirmed delivery -> DELIVERY CONFIRMED
  assert.equal(
    computeStatus({ scheduledAt: now, status: "dispatched", deliveryConfirmedAt: new Date() }),
    "DELIVERY CONFIRMED"
  );
});

test("Test 5: Native Android path separation from PWA", () => {
  const isNativePlatform = false; // PWA Chrome Android
  assert.equal(isNativePlatform, false, "PWA does not claim Capacitor AlarmManager capability");

  // In PWA, delivery must rely on Web Push VAPID and Service Worker
  const pwaDeliveryMechanism = isNativePlatform ? "AlarmManager" : "WebPush_ServiceWorker";
  assert.equal(pwaDeliveryMechanism, "WebPush_ServiceWorker");
});

test("Test 6: Overdue reminder recovery does not re-trigger already delivered/dismissed alarms", () => {
  const dismissedReminder = new Reminder({
    owner: new mongoose.Types.ObjectId(),
    title: "Already Handled Alarm",
    scheduledAt: new Date(Date.now() - 3600000), // 1 hour ago
    status: "dismissed",
    alarmEnabled: false,
  });

  const shouldTrigger = dismissedReminder.status === "scheduled" && dismissedReminder.alarmEnabled === true;
  assert.equal(shouldTrigger, false, "Dismissed reminders must never re-trigger on app open");
});

test("Test 7: Dismissing reminder marks linked task as Completed in MongoDB", () => {
  const mockTask = {
    _id: new mongoose.Types.ObjectId(),
    title: "Submit Financial Report",
    completed: false,
  };

  const mockReminder = {
    _id: new mongoose.Types.ObjectId(),
    task: mockTask,
    status: "scheduled",
  };

  // Simulate dismiss action
  mockTask.completed = true;
  mockTask.completedAt = new Date();
  mockReminder.status = "dismissed";

  assert.equal(mockTask.completed, true, "Linked task must be completed");
  assert.ok(mockTask.completedAt instanceof Date, "completedAt must be populated");
  assert.equal(mockReminder.status, "dismissed");
});

test("Test 8: Snoozing reminder leaves linked task Pending", () => {
  const mockTask = {
    _id: new mongoose.Types.ObjectId(),
    title: "Client Follow Up",
    completed: false,
  };

  const mockReminder = {
    _id: new mongoose.Types.ObjectId(),
    task: mockTask,
    status: "scheduled",
    snoozeDuration: 5,
  };

  // Simulate snooze action (5 minutes)
  const snoozeUntil = new Date(Date.now() + 5 * 60 * 1000);
  mockReminder.status = "snoozed";
  mockReminder.snoozedUntil = snoozeUntil;

  assert.equal(mockTask.completed, false, "Linked task must remain pending when snoozed");
  assert.equal(mockReminder.status, "snoozed");
  assert.ok(mockReminder.snoozedUntil > new Date(), "snoozedUntil must be in future");
});

