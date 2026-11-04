import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createContact,
  deleteContact,
  getContactById,
  getContactConversation,
  getContacts,
  updateContact,
  seedDemoContacts,
  clearDemoContacts,
} from "../controllers/contactController.js";

const contactRouter = express.Router();

contactRouter.get("/", authMiddleware, getContacts);
contactRouter.post("/", authMiddleware, createContact);
contactRouter.post("/demo/seed", authMiddleware, seedDemoContacts);
contactRouter.delete("/demo", authMiddleware, clearDemoContacts);
contactRouter.get("/:id", authMiddleware, getContactById);
contactRouter.get("/:id/conversation", authMiddleware, getContactConversation);
contactRouter.patch("/:id", authMiddleware, updateContact);
contactRouter.put("/:id", authMiddleware, updateContact);
contactRouter.delete("/:id", authMiddleware, deleteContact);

export default contactRouter;
