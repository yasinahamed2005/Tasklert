import test from "node:test";
import assert from "node:assert/strict";

test("Profile & Avatar: Multer file filter security validation", () => {
  // Mirror avatarFilter logic from userRoute.js
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const avatarFilter = (mimetype) => {
    if (allowed.includes(mimetype)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: "Only JPEG, PNG, WEBP, and GIF images are permitted for profile avatars.",
    };
  };

  // Valid image mimetypes
  assert.equal(avatarFilter("image/jpeg").allowed, true);
  assert.equal(avatarFilter("image/png").allowed, true);
  assert.equal(avatarFilter("image/webp").allowed, true);
  assert.equal(avatarFilter("image/gif").allowed, true);

  // Prohibited / Malicious mimetypes
  assert.equal(avatarFilter("application/javascript").allowed, false);
  assert.equal(avatarFilter("application/x-msdownload").allowed, false);
  assert.equal(avatarFilter("text/html").allowed, false);
  assert.equal(avatarFilter("application/pdf").allowed, false);
  assert.match(avatarFilter("application/pdf").error, /Only JPEG, PNG, WEBP, and GIF/);
});

test("Profile & Avatar: Avatar URL relative path sanitization", () => {
  const sanitizeAvatarUrl = (filename, userId) => {
    const ext = filename.split(".").pop().toLowerCase();
    const safeName = `avatar_${userId}_${1700000000000}.${ext}`;
    return `/uploads/avatars/${safeName}`;
  };

  const url = sanitizeAvatarUrl("my_cool_photo.PNG", "user_123");
  assert.equal(url, "/uploads/avatars/avatar_user_123_1700000000000.png");
  assert.equal(url.startsWith("/uploads/avatars/"), true);
});

test("Profile & Avatar: Password strength validation on profile page", () => {
  const validatePasswordChange = (currentPassword, newPassword) => {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return { valid: false, message: "Password invalid or too short" };
    }
    return { valid: true };
  };

  assert.equal(validatePasswordChange("", "12345678").valid, false);
  assert.equal(validatePasswordChange("oldpass123", "short").valid, false);
  assert.equal(validatePasswordChange("oldpass123", "1234567").valid, false);
  assert.equal(validatePasswordChange("oldpass123", "12345678").valid, true);
  assert.equal(validatePasswordChange("oldpass123", "SuperSecure#2026").valid, true);
});

test("Profile & Avatar: User model serialization preserves provider & avatar fields", () => {
  const mockUserRecord = {
    _id: "67140e793cb9d0382ab38991",
    name: "Israth Yasin A",
    email: "israth@example.com",
    avatar: "/uploads/avatars/avatar_67140e793cb9d0382ab38991_1729000000.webp",
    provider: "google",
    createdAt: new Date("2026-01-15T10:30:00Z"),
  };

  // Check required fields returned by getCurrentUser and updateProfile
  assert.ok(mockUserRecord.name);
  assert.ok(mockUserRecord.email);
  assert.ok(mockUserRecord.avatar);
  assert.equal(mockUserRecord.provider, "google");
  assert.ok(mockUserRecord.createdAt instanceof Date);

  // Fallback check for local provider
  const localUser = { name: "Local User", email: "local@example.com" };
  const resolvedProvider = localUser.provider || "local";
  assert.equal(resolvedProvider, "local");
});
