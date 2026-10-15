/**
 * Tasklert Time Zone & Quiet Hours Utilities
 * Standardized IANA time zone validation, local time conversion,
 * quiet-hours computation, and DST-safe wall-clock recurrence.
 */

// 1. Validate IANA Time Zone Identifier
export const isValidTimeZone = (tz) => {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
};

export const sanitizeTimeZone = (tz, fallback = "UTC") => {
  if (isValidTimeZone(tz)) return tz.trim();
  return isValidTimeZone(fallback) ? fallback : "UTC";
};

// 2. Extract local date/time parts in target time zone
export const getLocalParts = (date, timeZone = "UTC") => {
  const safeTz = sanitizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }

  return {
    year: partMap.year,
    month: partMap.month, // 1-12
    day: partMap.day,     // 1-31
    hour: (partMap.hour || 0) % 24, // 0-23
    minute: partMap.minute || 0,
    second: partMap.second || 0,
    timeZone: safeTz,
  };
};

// 3. Evaluate whether instant falls inside user's quiet hours (in user's time zone)
export const isWithinQuietHours = (quietHours, date = new Date(), timeZone) => {
  if (!quietHours?.enabled) return false;
  const { start, end } = quietHours;
  if (!start || !end) return false;

  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return false;

  const safeTz = sanitizeTimeZone(timeZone || quietHours.timeZone || "UTC");
  const local = getLocalParts(date, safeTz);
  const currentMinutes = local.hour * 60 + local.minute;
  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  if (startMinutes < endMinutes) {
    // Daytime window (e.g., 13:00 to 15:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight window (e.g., 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
};

// 4. Calculate exact UTC instant when quiet hours end
export const getQuietHoursEndInstant = (quietHours, date = new Date(), timeZone) => {
  if (!quietHours?.enabled || !quietHours.end) return null;
  const [eH, eM] = quietHours.end.split(":").map(Number);
  if (isNaN(eH) || isNaN(eM)) return null;

  const safeTz = sanitizeTimeZone(timeZone || quietHours.timeZone || "UTC");
  const local = getLocalParts(date, safeTz);
  const startMinutes = (quietHours.start ? quietHours.start.split(":").map(Number)[0] * 60 + quietHours.start.split(":").map(Number)[1] : 0);
  const endMinutes = eH * 60 + eM;
  const currentMinutes = local.hour * 60 + local.minute;

  let daysToAdd = 0;
  if (startMinutes >= endMinutes && currentMinutes >= startMinutes) {
    // Current time is before midnight in an overnight window, so end is tomorrow morning
    daysToAdd = 1;
  }

  // Construct target local string in ISO-like format and resolve UTC offset
  const targetYear = local.year;
  const targetMonth = local.month;
  const targetDay = local.day + daysToAdd;

  return createUtcDateFromLocalParts(targetYear, targetMonth, targetDay, eH, eM, 0, timeZone);
};

// 5. Construct a UTC Date from local parts in a specific IANA time zone
export const createUtcDateFromLocalParts = (year, month, day, hour, minute, second = 0, timeZone = "UTC") => {
  const safeTz = sanitizeTimeZone(timeZone);
  // Estimate UTC time using simple UTC constructor
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Determine the offset difference in the target timezone
  const parts = getLocalParts(guessUtc, safeTz);
  const asIfUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  const diffMs = asIfUtc.getTime() - guessUtc.getTime();

  // Adjust by the offset
  const finalUtc = new Date(guessUtc.getTime() - diffMs);

  // Validate adjustment (handles DST transitions smoothly)
  const verifyParts = getLocalParts(finalUtc, safeTz);
  if (verifyParts.hour !== hour || verifyParts.minute !== minute) {
    const secondDiff = new Date(Date.UTC(verifyParts.year, verifyParts.month - 1, verifyParts.day, verifyParts.hour, verifyParts.minute, verifyParts.second)).getTime() - guessUtc.getTime();
    return new Date(guessUtc.getTime() - secondDiff);
  }

  return finalUtc;
};

// 6. DST-Safe Wall-Clock Recurrence: Preserves user's local hour and minute
export const getNextWallClockOccurrence = (currentDate, repeat, timeZone = "UTC") => {
  if (!repeat || repeat === "never") return null;
  const safeTz = sanitizeTimeZone(timeZone);
  const local = getLocalParts(currentDate, safeTz);

  let targetDay = local.day;
  if (repeat === "daily") {
    targetDay += 1;
  } else if (repeat === "weekly") {
    targetDay += 7;
  } else {
    return null;
  }

  return createUtcDateFromLocalParts(
    local.year,
    local.month,
    targetDay,
    local.hour,
    local.minute,
    local.second,
    safeTz
  );
};
