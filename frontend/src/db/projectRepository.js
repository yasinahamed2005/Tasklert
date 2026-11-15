import { db, generateUUID } from "./tasklertDb.js";
import { operationsRepository } from "./operationsRepository.js";

/**
 * Project Repository
 * Offline-first repository for Project CRUD, caching, and account isolation.
 */
export const projectRepository = {
  /**
   * Get all active projects for a user.
   */
  async getProjects(userId) {
    if (!userId) return [];
    const ownerId = String(userId);

    const projects = await db.projects.where("owner").equals(ownerId).toArray();
    const active = projects.filter((p) => !p.isDeleted);

    return active.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  },

  /**
   * Get a single project by localId or serverId.
   */
  async getProjectById(id, userId) {
    if (!id || !userId) return null;
    const targetId = String(id);
    const ownerId = String(userId);

    let proj = await db.projects.get(targetId);
    if (proj && String(proj.owner) === ownerId) return proj;

    proj = await db.projects.where("serverId").equals(targetId).first();
    if (proj && String(proj.owner) === ownerId) return proj;

    return null;
  },

  /**
   * Create a new project locally and queue an offline CREATE operation.
   */
  async createProject(projectData, userId) {
    if (!userId) {
      throw new Error("projectRepository.createProject requires a valid userId");
    }

    const now = new Date().toISOString();
    const localId = projectData.localId || generateUUID();
    const isSynced = Boolean(projectData.serverId || projectData._id);

    const projectRecord = {
      localId,
      serverId: projectData.serverId || projectData._id || null,
      owner: String(userId),
      name: projectData.name?.trim() || "Untitled Project",
      description: projectData.description?.trim() || "",
      color: projectData.color || "#8B2CF5",
      isDeleted: false,
      deletedAt: null,
      syncStatus: isSynced ? "synced" : "created",
      version: 1,
      createdAt: projectData.createdAt
        ? new Date(projectData.createdAt).toISOString()
        : now,
      updatedAt: projectData.updatedAt
        ? new Date(projectData.updatedAt).toISOString()
        : now,
    };

    return await db.transaction("rw", [db.projects, db.operations], async () => {
      await db.projects.put(projectRecord);

      if (!isSynced) {
        await operationsRepository.queueOperation(
          {
            entityType: "project",
            action: "CREATE",
            localId,
            userId,
            payload: projectRecord,
          },
          db
        );
      }

      return projectRecord;
    });
  },

  /**
   * Edit a project locally and queue an UPDATE operation.
   */
  async updateProject(id, updates, userId) {
    if (!id || !userId) {
      throw new Error("projectRepository.updateProject requires valid id and userId");
    }

    const project = await this.getProjectById(id, userId);
    if (!project) {
      throw new Error(`Project ${id} not found for user ${userId}`);
    }

    const now = new Date().toISOString();
    const updatedSyncStatus =
      project.syncStatus === "created" ? "created" : "updated";

    const updated = {
      ...project,
      ...updates,
      localId: project.localId,
      serverId: project.serverId,
      owner: project.owner,
      version: (project.version || 1) + 1,
      syncStatus: updatedSyncStatus,
      updatedAt: now,
    };

    return await db.transaction("rw", [db.projects, db.operations], async () => {
      await db.projects.put(updated);

      await operationsRepository.queueOperation(
        {
          entityType: "project",
          action: "UPDATE",
          localId: project.localId,
          userId,
          payload: updated,
        },
        db
      );

      return updated;
    });
  },

  /**
   * Soft-delete a project and queue a DELETE operation.
   */
  async deleteProject(id, userId) {
    if (!id || !userId) {
      throw new Error("projectRepository.deleteProject requires valid id and userId");
    }

    const project = await this.getProjectById(id, userId);
    if (!project) return { success: false };

    const now = new Date().toISOString();

    return await db.transaction("rw", [db.projects, db.operations], async () => {
      const deleted = {
        ...project,
        isDeleted: true,
        deletedAt: now,
        syncStatus: "deleted",
        updatedAt: now,
        version: (project.version || 1) + 1,
      };

      await db.projects.put(deleted);

      await operationsRepository.queueOperation(
        {
          entityType: "project",
          action: "DELETE",
          localId: project.localId,
          userId,
          payload: {
            localId: project.localId,
            serverId: project.serverId,
            deletedAt: now,
          },
        },
        db
      );

      return { success: true, localId: project.localId };
    });
  },

  /**
   * Bulk cache server projects into local database.
   */
  async bulkUpsertFromServer(serverProjects, userId) {
    if (!Array.isArray(serverProjects) || !userId) return [];
    const ownerId = String(userId);

    return await db.transaction("rw", [db.projects], async () => {
      const existing = await db.projects.where("owner").equals(ownerId).toArray();
      const sMap = new Map();
      existing.forEach((p) => {
        if (p.serverId) sMap.set(String(p.serverId), p);
      });

      const records = [];
      for (const sp of serverProjects) {
        const sId = String(sp._id || sp.serverId || "");
        if (!sId) continue;

        const local = sMap.get(sId);
        if (local && local.syncStatus !== "synced") continue; // keep un-synced edits

        const localId = local ? local.localId : generateUUID();
        records.push({
          localId,
          serverId: sId,
          owner: ownerId,
          name: sp.name || "Untitled Project",
          description: sp.description || "",
          color: sp.color || "#8B2CF5",
          isDeleted: Boolean(sp.isDeleted),
          deletedAt: sp.deletedAt ? new Date(sp.deletedAt).toISOString() : null,
          syncStatus: "synced",
          version: sp.version || 1,
          createdAt: sp.createdAt ? new Date(sp.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: sp.updatedAt ? new Date(sp.updatedAt).toISOString() : new Date().toISOString(),
        });
      }

      if (records.length > 0) {
        await db.projects.bulkPut(records);
      }
      return records;
    });
  },
};

export default projectRepository;
