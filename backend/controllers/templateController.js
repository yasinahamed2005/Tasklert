import Template from "../models/templateModel.js";

// GET ALL TEMPLATES FOR LOGGED-IN USER
export const getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE A NEW TEMPLATE
export const createTemplate = async (req, res) => {
  try {
    const { name, title, description, priority, subtasks, tags } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Template name is required" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = await Template.findOne({
      owner: req.user.id,
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A template named "${trimmedName}" already exists.`,
      });
    }

    const template = new Template({
      name: trimmedName,
      title: title.trim(),
      description: (description || "").trim(),
      priority: priority || "Low",
      subtasks: Array.isArray(subtasks)
        ? subtasks
            .filter((st) => st && st.title && st.title.trim())
            .map((st) => ({ title: st.title.trim() }))
        : [],
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim().toLowerCase()) : [],
      owner: req.user.id,
    });

    const saved = await template.save();
    res.status(201).json({ success: true, template: saved });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE A TEMPLATE
export const deleteTemplate = async (req, res) => {
  try {
    const deleted = await Template.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
