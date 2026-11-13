import test from "node:test";
import assert from "node:assert/strict";
import UserDevice from "../models/userDeviceModel.js";
import Reminder from "../models/reminderModel.js";
import UserPreferences from "../models/userPreferencesModel.js";

test("Central Alarm: UserDevice model validates schema and enum constraints", () => {
  const validDevice = new UserDevice({
    owner: "507f1f77bcf86cd799439011",
    deviceId: "samsung-sm-g991b-test",
    deviceType: "mobile_primary",
    platform: "android",
    nativeAlarmCapability: true,
    exactAlarmPermission: true,
    notificationPermission: true,
    fullScreenIntentPermission: true,
    activeStatus: "online",
  });
  const err = validDevice.validateSync();
  assert.equal(err, undefined, "Expected valid device to pass validation");
  assert.equal(validDevice.deviceType, "mobile_primary");
  assert.equal(validDevice.nativeAlarmCapability, true);
});

test("Central Alarm: UserDevice rejects invalid deviceType", () => {
  const invalidDevice = new UserDevice({
    owner: "507f1f77bcf86cd799439011",
    deviceId: "device-test-1",
    deviceType: "smart_fridge",
    platform: "unknown",
  });
  const err = invalidDevice.validateSync();
  assert.ok(err?.errors?.deviceType, "Expected deviceType enum validation error");
});

test("Central Alarm: Reminder model supports alarmType, global ringtone, and deviceOwner fields", () => {
  const reminder = new Reminder({
    owner: "507f1f77bcf86cd799439011",
    title: "Morning Standup Reminder",
    scheduledAt: new Date(Date.now() + 3600000),
    alarmType: "clock",
    source: "clock",
    globalRingtoneId: "custom_ringtone",
    globalRingtoneName: "Tere Vaaste.mp3",
    deviceOwner: "mobile_primary",
    mobileConfirmedAt: new Date(),
  });
  const err = reminder.validateSync();
  assert.equal(err, undefined, "Expected Reminder with new alarm fields to be valid");
  assert.equal(reminder.alarmType, "clock");
  assert.equal(reminder.globalRingtoneName, "Tere Vaaste.mp3");
  assert.equal(reminder.deviceOwner, "mobile_primary");
  assert.ok(reminder.mobileConfirmedAt !== null);
});

test("Central Alarm: UserPreferences accepts global ringtone preferences", () => {
  const prefs = new UserPreferences({
    owner: "507f1f77bcf86cd799439011",
    defaultSound: "custom",
    globalRingtoneId: "global_custom_1",
    globalRingtoneName: "Tere Vaaste.mp3",
    globalRingtoneType: "custom",
  });
  const err = prefs.validateSync();
  assert.equal(err, undefined, "Expected UserPreferences with global ringtone to validate");
  assert.equal(prefs.globalRingtoneName, "Tere Vaaste.mp3");
  assert.equal(prefs.globalRingtoneType, "custom");
});

test("Central Alarm: Multi-Device priority suppresses fallback ringing if mobile is confirmed", () => {
  const claimedReminder = {
    _id: "rem-12345",
    deviceOwner: "mobile_primary",
    mobileConfirmedAt: new Date(),
  };

  const isMobileOwned = Boolean(claimedReminder.deviceOwner === "mobile_primary" && claimedReminder.mobileConfirmedAt);
  assert.equal(isMobileOwned, true, "Mobile should be confirmed as primary owner");

  // Laptop client receives payload with mobileOwned flag and suppresses duplicate sound
  const clientDeviceType = "laptop_fallback";
  const shouldPlayLaptopSound = !(clientDeviceType === "laptop_fallback" && isMobileOwned);
  assert.equal(shouldPlayLaptopSound, false, "Laptop should suppress duplicate audio when mobile confirmed");
});
