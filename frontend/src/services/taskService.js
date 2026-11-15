import axios from "axios";
import { taskRepository } from "../db/taskRepository.js";
import { projectRepository } from "../db/projectRepository.js";
import { accountManager } from "../db/accountManager.js";
import { syncEngine } from "./syncEngine.js";
import { API_BASE_URL } from "../config/api";

const API_BASE = API_BASE_URL;

const getAuthHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const taskService = {
  /**
   * Create task (Offline-First):
   * Saves immediately to IndexedDB, attempts server push if online, and schedules background sync.
   */
  async createTask(taskData, onRefresh = null) {
    const userId = accountManager.getActiveUserId();
    if (!userId) {
      throw new Error("No authenticated user active");
    }

    // 1. Save immediately to IndexedDB
    const localRecord = await taskRepository.createTask(taskData, userId);
    onRefresh?.();

    // 2. If online, attempt direct network call
    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const { data } = await axios.post(`${API_BASE}/api/tasks/gp`, localRecord, {
            headers: getAuthHeaders(),
          });

          if (data && (data._id || data.task?._id)) {
            const serverTask = data.task || data;
            await taskRepository.updateTask(
              localRecord.localId,
              {
                serverId: String(serverTask._id),
                syncStatus: "synced",
                version: serverTask.version || 1,
              },
              userId
            );
            onRefresh?.();
            return serverTask;
          }
        }
      } catch (err) {
        console.warn("Direct task create push failed, queued in IndexedDB:", err.message);
        syncEngine.scheduleSync(1000);
      }
    } else {
      syncEngine.scheduleSync(1000);
    }

    return localRecord;
  },

  /**
   * Update task (Offline-First):
   * Updates local record immediately, then attempts server sync.
   */
  async updateTask(taskId, updates, onRefresh = null) {
    const userId = accountManager.getActiveUserId();
    if (!userId) throw new Error("No authenticated user active");

    // 1. Update IndexedDB immediately
    const updated = await taskRepository.updateTask(taskId, updates, userId);
    onRefresh?.();

    // 2. If online, attempt server update
    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const token = localStorage.getItem("token");
        const sId = updated.serverId || taskId;
        if (token && sId && !String(sId).startsWith("loc_")) {
          const { data } = await axios.put(`${API_BASE}/api/tasks/${sId}/gp`, updates, {
            headers: getAuthHeaders(),
          });
          if (data && (data._id || data.task?._id)) {
            const serverTask = data.task || data;
            await taskRepository.updateTask(
              updated.localId,
              {
                syncStatus: "synced",
                version: serverTask.version || updated.version,
              },
              userId
            );
            onRefresh?.();
            return serverTask;
          }
        }
      } catch (err) {
        console.warn("Direct task update push failed, queued in IndexedDB:", err.message);
        syncEngine.scheduleSync(1000);
      }
    } else {
      syncEngine.scheduleSync(1000);
    }

    return updated;
  },

  /**
   * Toggle or set task completion (Offline-First)
   */
  async completeTask(task, completed = true, onRefresh = null) {
    const taskId = task.localId || task._id;
    return await this.updateTask(
      taskId,
      {
        completed: Boolean(completed),
        completedAt: completed ? new Date().toISOString() : null,
      },
      onRefresh
    );
  },

  /**
   * Delete task (Soft-delete Offline-First)
   */
  async deleteTask(task, onRefresh = null) {
    const userId = accountManager.getActiveUserId();
    if (!userId) throw new Error("No authenticated user active");

    const taskId = task.localId || task._id;

    // 1. Soft-delete immediately in IndexedDB
    const result = await taskRepository.deleteTask(taskId, userId, true);
    onRefresh?.();

    // 2. Attempt online delete if possible
    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const token = localStorage.getItem("token");
        const sId = task.serverId || task._id;
        if (token && sId && !String(sId).startsWith("loc_")) {
          await axios.delete(`${API_BASE}/api/tasks/${sId}/gp`, {
            headers: getAuthHeaders(),
          });
        }
      } catch (err) {
        console.warn("Direct delete push failed, queued in IndexedDB:", err.message);
        syncEngine.scheduleSync(1000);
      }
    } else {
      syncEngine.scheduleSync(1000);
    }

    return result;
  },

  /**
   * Fetch projects (Offline-First with cloud cache)
   */
  async getProjects(onRefresh = null) {
    const userId = accountManager.getActiveUserId();

    // 1. Read cached from IndexedDB
    let localProjects = [];
    if (userId) {
      try {
        localProjects = await projectRepository.getProjects(userId);
      } catch (_) {}
    }

    // 2. If online, fetch from backend
    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const { data } = await axios.get(`${API_BASE}/api/projects`, {
            headers: getAuthHeaders(),
          });
          const list = data?.projects || (Array.isArray(data) ? data : []);
          if (userId && list.length > 0) {
            await projectRepository.bulkUpsertFromServer(list, userId);
            localProjects = await projectRepository.getProjects(userId);
            onRefresh?.();
          }
        }
      } catch (err) {
        console.warn("Could not fetch remote projects, using local cache:", err.message);
      }
    }

    return localProjects;
  },

  /**
   * Create Project (Offline-First)
   */
  async createProject(projectData, onRefresh = null) {
    const userId = accountManager.getActiveUserId();
    if (!userId) throw new Error("No authenticated user active");

    const localProject = await projectRepository.createProject(projectData, userId);
    onRefresh?.();

    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const { data } = await axios.post(`${API_BASE}/api/projects`, projectData, {
            headers: getAuthHeaders(),
          });
          if (data?.project?._id) {
            await projectRepository.updateProject(
              localProject.localId,
              { serverId: String(data.project._id), syncStatus: "synced" },
              userId
            );
            onRefresh?.();
            return data.project;
          }
        }
      } catch (err) {
        console.warn("Project server create failed, queued offline:", err.message);
        syncEngine.scheduleSync(1000);
      }
    } else {
      syncEngine.scheduleSync(1000);
    }

    return localProject;
  },
};

export default taskService;
