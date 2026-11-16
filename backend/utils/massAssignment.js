/**
 * Mass assignment protection helper.
 * Filters input to only allowed whitelist fields and explicitly strips
 * sensitive or internal database keys (owner, _id, isDeleted, createdAt)
 * as well as any key starting with "$".
 */
export const sanitizePayload = (body, allowedFields = []) => {
  if (!body || typeof body !== "object") return {};
  const allowedSet = new Set(allowedFields);
  const result = {};

  for (const [key, value] of Object.entries(body)) {
    if (
      key.startsWith("$") ||
      key === "owner" ||
      key === "_id" ||
      key === "isDeleted" ||
      key === "createdAt"
    ) {
      continue;
    }

    if (allowedSet.has(key)) {
      result[key] = value;
    }
  }

  return result;
};

export const TASK_ALLOWED_FIELDS = [
  "title",
  "description",
  "dueDate",
  "priority",
  "tags",
  "subtasks",
  "project",
  "recurrence",
  "reminderAt",
  "reminderEnabled",
  "completed",
  "completedAt",
  "alarmSound",
  "alarmVolume",
  "alarmRepeat",
  "snoozeDuration",
  "advanceNoticeMinutes",
  "channels",
  "timeZone",
  "startDate",
  "endDate",
  "allDay",
  "eventColor",
  "location",
  "notes",
  "isCalendarEvent",
  "source",
  "attachments",
  "localId",
  "version",
];

export const REMINDER_ALLOWED_FIELDS = [
  "title",
  "message",
  "notes",
  "scheduledAt",
  "scheduledDate",
  "scheduledTime",
  "timeZone",
  "alarmType",
  "alarmSound",
  "sound",
  "soundType",
  "alarmVolume",
  "volume",
  "alarmRepeat",
  "repeat",
  "alarmEnabled",
  "notificationEnabled",
  "channels",
  "advanceNoticeMinutes",
  "snoozeDuration",
  "deviceOwner",
  "tags",
  "priority",
  "status",
  "type",
  "taskId",
  "task",
  "recurrence",
  "localId",
];

export const PREFERENCES_ALLOWED_FIELDS = [
  "defaultChannels",
  "quietHours",
  "dndEnabled",
  "soundEnabled",
  "defaultSound",
  "defaultVolume",
  "defaultAdvanceNotice",
  "defaultSnooze",
  "defaultRepeat",
  "vibration",
  "timeZone",
  "calendarSync",
];

export default {
  sanitizePayload,
  TASK_ALLOWED_FIELDS,
  REMINDER_ALLOWED_FIELDS,
  PREFERENCES_ALLOWED_FIELDS,
};
