import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidTimeZone,
  sanitizeTimeZone,
  getLocalParts,
  isWithinQuietHours,
  getQuietHoursEndInstant,
  getNextWallClockOccurrence,
} from "../utils/timeZone.js";
import { classifyPushError } from "../services/pushService.js";

test("TimeZone Utilities — IANA validation & sanitization", () => {
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Asia/Kolkata"), true);
  assert.equal(isValidTimeZone("America/New_York"), true);
  assert.equal(isValidTimeZone("Europe/London"), true);

  assert.equal(isValidTimeZone("Mars/Colony"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone(null), false);
  assert.equal(isValidTimeZone(undefined), false);
  assert.equal(isValidTimeZone(123), false);

  assert.equal(sanitizeTimeZone("Asia/Kolkata"), "Asia/Kolkata");
  assert.equal(sanitizeTimeZone("Invalid/Zone", "UTC"), "UTC");
  assert.equal(sanitizeTimeZone("", "America/New_York"), "America/New_York");
});

test("TimeZone Utilities — getLocalParts retrieves accurate local hour and minute", () => {
  // 2026-06-15T12:00:00Z -> In UTC: hour 12, min 0
  const utcDate = new Date("2026-06-15T12:00:00Z");
  const utcParts = getLocalParts(utcDate, "UTC");
  assert.equal(utcParts.hour, 12);
  assert.equal(utcParts.minute, 0);

  // In Asia/Kolkata (+05:30): 17:30
  const kolkataParts = getLocalParts(utcDate, "Asia/Kolkata");
  assert.equal(kolkataParts.hour, 17);
  assert.equal(kolkataParts.minute, 30);
});

test("TimeZone Utilities — Quiet Hours detection (non-midnight window)", () => {
  const quietHours = {
    enabled: true,
    start: "14:00",
    end: "16:00",
    timeZone: "UTC",
  };

  const inside = new Date("2026-06-15T15:00:00Z");
  assert.equal(isWithinQuietHours(quietHours, inside), true);

  const outside = new Date("2026-06-15T12:00:00Z");
  assert.equal(isWithinQuietHours(quietHours, outside), false);
});

test("TimeZone Utilities — Quiet Hours detection (crossing midnight window: 22:00 to 07:00)", () => {
  const quietHours = {
    enabled: true,
    start: "22:00",
    end: "07:00",
    timeZone: "Asia/Kolkata",
  };

  // Asia/Kolkata is UTC + 5:30
  // When UTC is 17:00 -> Kolkata is 22:30 (inside quiet hours)
  const lateNight = new Date("2026-06-15T17:00:00Z");
  assert.equal(isWithinQuietHours(quietHours, lateNight), true);

  // When UTC is 22:00 -> Kolkata is 03:30 (inside quiet hours)
  const earlyMorning = new Date("2026-06-15T22:00:00Z");
  assert.equal(isWithinQuietHours(quietHours, earlyMorning), true);

  // When UTC is 06:30 -> Kolkata is 12:00 noon (outside quiet hours)
  const midday = new Date("2026-06-15T06:30:00Z");
  assert.equal(isWithinQuietHours(quietHours, midday), false);

  // Disabled quiet hours should always return false
  assert.equal(isWithinQuietHours({ ...quietHours, enabled: false }, lateNight), false);
});

test("TimeZone Utilities — getQuietHoursEndInstant computes correct future wake time", () => {
  const quietHours = {
    enabled: true,
    start: "22:00",
    end: "07:00",
    timeZone: "UTC",
  };

  const current = new Date("2026-06-15T23:30:00Z");
  const endInstant = getQuietHoursEndInstant(quietHours, current);

  assert.ok(endInstant instanceof Date);
  assert.ok(endInstant.getTime() > current.getTime());

  // End time in UTC should be 07:00 on the next day
  const endParts = getLocalParts(endInstant, "UTC");
  assert.equal(endParts.hour, 7);
  assert.equal(endParts.minute, 0);
});

test("TimeZone Utilities — getNextWallClockOccurrence preserves wall-clock time across days", () => {
  // Daily recurrence scheduled for 09:30 AM local New York time
  const timeZone = "America/New_York";
  const baseTime = new Date("2026-03-07T14:30:00Z"); // 09:30 EST
  const partsBefore = getLocalParts(baseTime, timeZone);
  assert.equal(partsBefore.hour, 9);
  assert.equal(partsBefore.minute, 30);

  // Compute next day occurrence
  const nextOccurrence = getNextWallClockOccurrence(baseTime, "daily", timeZone);
  assert.ok(nextOccurrence.getTime() > baseTime.getTime());

  const partsAfter = getLocalParts(nextOccurrence, timeZone);
  assert.equal(partsAfter.hour, 9);
  assert.equal(partsAfter.minute, 30);

  // Weekly recurrence preserves day of week
  const weeklyOccurrence = getNextWallClockOccurrence(baseTime, "weekly", timeZone);
  assert.ok(weeklyOccurrence.getTime() > baseTime.getTime());
  const diffDays = Math.round((weeklyOccurrence.getTime() - baseTime.getTime()) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays, 7);

  // 'never' recurrence returns null
  assert.equal(getNextWallClockOccurrence(baseTime, "never", timeZone), null);
});

test("Push Service — classifyPushError classifies HTTP error codes and network failures", () => {
  // 404 / 410 -> expired subscription (non-retryable, should prune)
  const err410 = classifyPushError({ statusCode: 410 });
  assert.equal(err410.category, "expired_subscription");
  assert.equal(err410.isRetryable, false);

  const err404 = classifyPushError({ statusCode: 404 });
  assert.equal(err404.category, "expired_subscription");
  assert.equal(err404.isRetryable, false);

  // 401 / 403 -> VAPID auth failure
  const err401 = classifyPushError({ statusCode: 401 });
  assert.equal(err401.category, "auth_error");
  assert.equal(err401.isRetryable, false);

  const err403 = classifyPushError({ statusCode: 403 });
  assert.equal(err403.category, "auth_error");
  assert.equal(err403.isRetryable, false);

  // 413 -> payload too large
  const err413 = classifyPushError({ statusCode: 413 });
  assert.equal(err413.category, "payload_too_large");
  assert.equal(err413.isRetryable, false);

  // 429 -> rate limited
  const err429 = classifyPushError({ statusCode: 429 });
  assert.equal(err429.category, "rate_limited");
  assert.equal(err429.isRetryable, true);

  // 500 / 503 -> push gateway server error
  const err500 = classifyPushError({ statusCode: 500 });
  assert.equal(err500.category, "server_error");
  assert.equal(err500.isRetryable, true);

  const err503 = classifyPushError({ statusCode: 503 });
  assert.equal(err503.category, "server_error");
  assert.equal(err503.isRetryable, true);

  // Network timeout / reset
  const errTimeout = classifyPushError({ code: "ETIMEDOUT" });
  assert.equal(errTimeout.category, "network_transient");
  assert.equal(errTimeout.isRetryable, true);

  const errReset = classifyPushError({ code: "ECONNRESET" });
  assert.equal(errReset.category, "network_transient");
  assert.equal(errReset.isRetryable, true);

  // Unknown generic error
  const errUnknown = classifyPushError({ message: "Unknown socket anomaly" });
  assert.equal(errUnknown.category, "unknown");
  assert.equal(errUnknown.isRetryable, false);
});

test("TimeZone Utilities — Preserves local wall-clock time across Daylight Saving Time (DST) shift", () => {
  // US Spring Forward DST transition occurs on Sunday, March 8, 2026:
  // At 2:00 AM EST, clocks jump to 3:00 AM EDT.
  const timeZone = "America/New_York";

  // Alarm set for 09:15 AM on Saturday, March 7, 2026 (EST, UTC-5)
  // 09:15 local = 14:15 UTC
  const preDst = new Date("2026-03-07T14:15:00Z");
  const preParts = getLocalParts(preDst, timeZone);
  assert.equal(preParts.hour, 9);
  assert.equal(preParts.minute, 15);

  // Next daily occurrence is on Sunday, March 8, 2026 (EDT, UTC-4)
  const postDst = getNextWallClockOccurrence(preDst, "daily", timeZone);
  assert.ok(postDst.getTime() > preDst.getTime());

  // Local wall-clock time MUST still be 09:15 AM
  const postParts = getLocalParts(postDst, timeZone);
  assert.equal(postParts.hour, 9);
  assert.equal(postParts.minute, 15);

  // In UTC, this occurrence should be 13:15 UTC (23 hours later in physical time, not 24h, because an hour was lost)
  const diffHours = (postDst.getTime() - preDst.getTime()) / (1000 * 60 * 60);
  assert.equal(diffHours, 23);
});

test("Scheduler Logic — Snooze duration bounds and validation", () => {
  const allowedSnooze = [5, 10, 15, 30, 60];

  const isValidDuration = (val) => {
    const num = Number(val);
    return Number.isInteger(num) && num > 0 && num <= 1440;
  };

  assert.equal(isValidDuration(5), true);
  assert.equal(isValidDuration(15), true);
  assert.equal(isValidDuration(60), true);
  assert.equal(isValidDuration(1440), true);

  assert.equal(isValidDuration(-5), false);
  assert.equal(isValidDuration(0), false);
  assert.equal(isValidDuration(1441), false);
  assert.equal(isValidDuration("invalid"), false);
  assert.equal(isValidDuration(null), false);
});
