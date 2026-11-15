/**
 * Tasklert Resilience - Phase 2 Local Database Module
 * Central IndexedDB entry point powered by Dexie.js
 */

export { db, TasklertDatabase, generateUUID, getDeviceId } from "./tasklertDb.js";
export { taskRepository } from "./taskRepository.js";
export { projectRepository } from "./projectRepository.js";
export { reminderRepository } from "./reminderRepository.js";
export { focusSessionRepository } from "./focusSessionRepository.js";
export { operationsRepository } from "./operationsRepository.js";
export { accountManager } from "./accountManager.js";
export { storageManager, formatBytes } from "./storageManager.js";
