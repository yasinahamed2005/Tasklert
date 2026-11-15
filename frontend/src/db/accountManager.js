import { db } from "./tasklertDb.js";

/**
 * Account Manager
 * Enforces strict user isolation across all local IndexedDB stores.
 * Manages active account context and handles login, logout, and account switching.
 *
 * NOTE: As per Tasklert Resilience security rules:
 * - Passwords, access tokens, and refresh tokens are NEVER stored in IndexedDB.
 * - Logout does NOT silently purge un-synced operations; offline work remains isolated
 *   under the user's ID until they re-authenticate or sync.
 */
class AccountManager {
  constructor() {
    this._activeUserId = null;
    this._activeUserEmail = null;
    this._initialized = false;
  }

  /**
   * Initialize account manager from current session in memory / localStorage
   */
  init() {
    if (this._initialized) return;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const rawUser = localStorage.getItem("currentUser");
        if (rawUser) {
          const user = JSON.parse(rawUser);
          this._activeUserId = user._id || user.id || null;
          this._activeUserEmail = user.email || null;
        }
      } catch (_) {}
    }

    this._initialized = true;
  }

  /**
   * Get the current active user ID.
   */
  getActiveUserId() {
    if (!this._initialized) this.init();
    return this._activeUserId;
  }

  /**
   * Get the current active user email.
   */
  getActiveUserEmail() {
    if (!this._initialized) this.init();
    return this._activeUserEmail;
  }

  /**
   * Handle user login / session initialization
   */
  async handleLogin(user) {
    if (!user) return;
    const userId = String(user._id || user.id);
    const email = user.email || null;

    this._activeUserId = userId;
    this._activeUserEmail = email;
    this._initialized = true;

    // Record login timestamp and active user in metadata (without credentials/tokens!)
    try {
      await db.metadata.put({
        key: "last_active_account",
        userId,
        email,
        updatedAt: new Date().toISOString(),
      });
    } catch (_) {}
  }

  /**
   * Check if the specified user has unsynced operations queued in IndexedDB
   */
  async hasUnsyncedChanges(userId = null) {
    const uid = userId || this.getActiveUserId();
    if (!uid) return false;
    const pending = await db.operations
      .where("[userId+status]")
      .equals([String(uid), "pending"])
      .count();
    return pending > 0;
  }

  /**
   * Securely purge all cached data for a specific user (on explicit user request)
   */
  async purgeAccountData(userId) {
    if (!userId) return;
    const uid = String(userId);

    await db.transaction(
      "rw",
      [db.tasks, db.projects, db.reminders, db.focusSessions, db.operations],
      async () => {
        await db.tasks.where("owner").equals(uid).delete();
        await db.projects.where("owner").equals(uid).delete();
        await db.reminders.where("owner").equals(uid).delete();
        await db.focusSessions.where("owner").equals(uid).delete();
        await db.operations.where("userId").equals(uid).delete();
      }
    );
  }

  /**
   * Handle user logout with strict security and data preservation guarantees:
   * 1. Resets active in-memory user context.
   * 2. Preserves un-synced operations so user changes are never lost across sessions.
   * 3. If explicit purge requested, wipes user partition completely.
   */
  async handleLogout({ purgeAccountData = false } = {}) {
    const uid = this._activeUserId;
    if (purgeAccountData && uid) {
      await this.purgeAccountData(uid);
    }
    this._activeUserId = null;
    this._activeUserEmail = null;
  }

  /**
   * Handle switching between accounts.
   * Smoothly changes active context ensuring zero data leakage.
   */
  async handleAccountSwitch(newUser) {
    this.handleLogout();
    await this.handleLogin(newUser);
  }

  /**
   * Verify that an action is permitted for the active user.
   */
  assertActiveUser(userId) {
    const current = this.getActiveUserId();
    if (!current) {
      throw new Error("No active user session found in accountManager");
    }
    if (String(current) !== String(userId)) {
      throw new Error(
        `Cross-user access denied: active user ${current} attempted action for ${userId}`
      );
    }
  }
}

export const accountManager = new AccountManager();
export default accountManager;
