import Project from "../models/projectModel.js";
import Task from "../models/taskModel.js";

// GET ALL PROJECTS WITH TASK STATS FOR LOGGED-IN USER
export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user.id }).sort({ createdAt: -1 });

    // Calculate task counts and completion stats for each project
    const projectStats = await Promise.all(
      projects.map(async (project) => {
        const totalTasks = await Task.countDocuments({
          owner: req.user.id,
          project: project._id,
          isDeleted: { $ne: true },
        });

        const completedTasks = await Task.countDocuments({
          owner: req.user.id,
          project: project._id,
          isDeleted: { $ne: true },
          completed: true,
        });

        return {
          ...project.toObject(),
          taskCount: totalTasks,
          completedCount: completedTasks,
          progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        };
      })
    );

    res.json({ success: true, projects: projectStats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE A NEW PROJECT
export const createProject = async (req, res) => {
  try {
    const { name, description, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Project name is required" });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = await Project.findOne({
      owner: req.user.id,
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A project named "${trimmedName}" already exists.`,
      });
    }

    const project = new Project({
      name: trimmedName,
      description: (description || "").trim(),
      color: color || "#8B2CF5",
      owner: req.user.id,
    });

    const saved = await project.save();
    res.status(201).json({
      success: true,
      project: { ...saved.toObject(), taskCount: 0, completedCount: 0, progress: 0 },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// UPDATE AN EXISTING PROJECT
export const updateProject = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or not yours" });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      // Check duplicate name on other project
      const duplicate = await Project.findOne({
        _id: { $ne: project._id },
        owner: req.user.id,
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another project is already named "${trimmedName}".`,
        });
      }
      project.name = trimmedName;
    }

    if (description !== undefined) project.description = description.trim();
    if (color) project.color = color;

    const saved = await project.save();
    res.json({ success: true, project: saved });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE A PROJECT
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or not yours" });
    }

    const { deleteTasks } = req.query;

    if (deleteTasks === "true") {
      // Soft-delete tasks associated with this project
      await Task.updateMany(
        { owner: req.user.id, project: project._id, isDeleted: { $ne: true } },
        { isDeleted: true, deletedAt: new Date() }
      );
    } else {
      // Unlink tasks from this project safely
      await Task.updateMany(
        { owner: req.user.id, project: project._id },
        { project: null }
      );
    }

    await Project.deleteOne({ _id: project._id });

    res.json({
      success: true,
      message: deleteTasks === "true"
        ? "Project and associated tasks moved to trash"
        : "Project deleted; tasks unassigned from project",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
