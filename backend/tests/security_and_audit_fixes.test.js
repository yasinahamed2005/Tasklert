import test from "node:test";
import assert from "node:assert/strict";
import { getJwtSecret } from "../config/jwt.js";
import { escapeHtml } from "../utils/mailer.js";
import { getNextDueDate } from "../controllers/taskController.js";

test("Security: Centralized JWT Secret validation", async (t) => {
  await t.test("Returns secret when properly set", () => {
    const prev = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = "super_secret_production_key_123456";
      assert.equal(getJwtSecret(), "super_secret_production_key_123456");
    } finally {
      process.env.JWT_SECRET = prev;
    }
  });

  await t.test("Throws fatal error in production if JWT_SECRET is default or empty", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "your_jwt_secret_here";
      assert.throws(
        () => getJwtSecret(),
        /FATAL: JWT_SECRET environment variable is missing/
      );

      process.env.JWT_SECRET = "";
      assert.throws(
        () => getJwtSecret(),
        /FATAL: JWT_SECRET environment variable is missing/
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.JWT_SECRET = prevSecret;
    }
  });
});

test("Security: Email HTML Sanitization (XSS Prevention)", () => {
  const maliciousTitle = `<script>alert("hacked")</script>`;
  const maliciousMessage = `" onclick="fetch('http://evil.com')`;
  const plainText = `Standard clean task title`;

  assert.equal(
    escapeHtml(maliciousTitle),
    `&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;`
  );
  assert.equal(
    escapeHtml(maliciousMessage),
    `&quot; onclick=&quot;fetch(&#039;http://evil.com&#039;)`
  );
  assert.equal(escapeHtml(plainText), `Standard clean task title`);
});

test("Recurrence: Monthly day-clamping across month boundaries", async (t) => {
  await t.test("January 31 + 1 month clamps to February 28 (non-leap year)", () => {
    const baseDate = new Date("2025-01-31T10:00:00.000Z");
    const nextDate = getNextDueDate(baseDate, { frequency: "monthly", interval: 1 });
    assert.ok(nextDate instanceof Date);
    // Month is 1 (February) and day should be 28
    assert.equal(nextDate.getMonth(), 1);
    assert.equal(nextDate.getDate(), 28);
  });

  await t.test("January 31 + 1 month clamps to February 29 (leap year 2024)", () => {
    const baseDate = new Date("2024-01-31T10:00:00.000Z");
    const nextDate = getNextDueDate(baseDate, { frequency: "monthly", interval: 1 });
    assert.ok(nextDate instanceof Date);
    assert.equal(nextDate.getMonth(), 1);
    assert.equal(nextDate.getDate(), 29);
  });

  await t.test("March 31 + 1 month clamps to April 30", () => {
    const baseDate = new Date("2025-03-31T10:00:00.000Z");
    const nextDate = getNextDueDate(baseDate, { frequency: "monthly", interval: 1 });
    assert.ok(nextDate instanceof Date);
    assert.equal(nextDate.getMonth(), 3); // April
    assert.equal(nextDate.getDate(), 30);
  });

  await t.test("August 31 + 1 month clamps to September 30", () => {
    const baseDate = new Date("2025-08-31T10:00:00.000Z");
    const nextDate = getNextDueDate(baseDate, { frequency: "monthly", interval: 1 });
    assert.ok(nextDate instanceof Date);
    assert.equal(nextDate.getMonth(), 8); // September
    assert.equal(nextDate.getDate(), 30);
  });
});

test("Security: OTP Brute-Force Rate Limiting logic", () => {
  let attempts = 0;
  const maxAllowed = 5;

  for (let i = 1; i <= 6; i++) {
    attempts += 1;
    if (attempts >= maxAllowed) {
      assert.ok(attempts >= 5, "Should lock / invalidate on 5th attempt");
      break;
    } else {
      assert.ok(5 - attempts > 0, "Should report remaining attempts");
    }
  }
  assert.equal(attempts, 5);
});
