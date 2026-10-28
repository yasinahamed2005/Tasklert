import Contact from "../models/contactModel.js";
import Message from "../models/messageModel.js";

export const SEED_CONTACTS = [
  {
    name: "Ramu",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 79978 64218",
    whatsappPhone: "+917997864218",
    telegramUsername: "ramu_tech",
    email: "ramu@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Hey! Please check this.",
    lastMessageAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    unreadCount: 2,
    isFavorite: true,
  },
  {
    name: "Priya Sharma",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 98450 12345",
    whatsappPhone: "+919845012345",
    telegramUsername: "priya_design",
    email: "priya.sharma@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Thank you! 🙏",
    lastMessageAt: new Date(Date.now() - 24 * 3600 * 1000), // Yesterday
    unreadCount: 0,
    isFavorite: true,
  },
  {
    name: "College Group",
    avatar: "",
    phone: "",
    whatsappPhone: "+919988776655",
    telegramUsername: "college_alumni_sync",
    email: "alumni-group@example.com",
    channels: ["whatsapp", "telegram"],
    lastMessage: "Rahul: Meeting at 5 PM",
    lastMessageAt: new Date(Date.now() - 28 * 3600 * 1000),
    unreadCount: 0,
    isFavorite: false,
  },
  {
    name: "Arjun",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 91234 56789",
    whatsappPhone: "+919123456789",
    telegramUsername: "arjun_dev",
    email: "arjun@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Let's connect tomorrow.",
    lastMessageAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    unreadCount: 0,
    isFavorite: false,
  },
  {
    name: "Family",
    avatar: "",
    phone: "+91 94440 99881",
    whatsappPhone: "+919444099881",
    telegramUsername: "",
    email: "family-circle@example.com",
    channels: ["whatsapp", "email"],
    lastMessage: "Mom: Call me",
    lastMessageAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    unreadCount: 0,
    isFavorite: true,
  },
  {
    name: "Project Team",
    avatar: "",
    phone: "",
    whatsappPhone: "+14155552671",
    telegramUsername: "tasklert_core_dev",
    email: "team@tasklert.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "You: File shared",
    lastMessageAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
    unreadCount: 0,
    isFavorite: false,
  },
  {
    name: "Kavya",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 97766 55443",
    whatsappPhone: "+919776655443",
    telegramUsername: "kavya_pm",
    email: "kavya@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Sure, I will do it.",
    lastMessageAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    unreadCount: 0,
    isFavorite: false,
  },
  {
    name: "Aditya",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 96655 44332",
    whatsappPhone: "+919665544332",
    telegramUsername: "aditya_qa",
    email: "aditya@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Thanks!",
    lastMessageAt: new Date(Date.now() - 6 * 24 * 3600 * 1000),
    unreadCount: 0,
    isFavorite: false,
  },
];

/**
 * Determine supported channels for a contact based on fields
 */
const inferChannels = ({ whatsappPhone, phone, telegramUsername, email }) => {
  const set = new Set();
  if (whatsappPhone || phone) set.add("whatsapp");
  if (telegramUsername) set.add("telegram");
  if (email) set.add("email");
  return Array.from(set);
};

/**
 * GET /api/contacts
 * Returns contacts for current authenticated user.
 * Auto-seeds initial contacts if the user has none.
 */
export const getContacts = async (req, res) => {
  try {
    const owner = req.user.id;
    const { channel, search } = req.query;

    let count = await Contact.countDocuments({ owner });
    if (count === 0) {
      // Seed default contacts for smooth out-of-the-box chat UX
      const seedData = SEED_CONTACTS.map((c) => ({
        ...c,
        owner,
      }));
      await Contact.insertMany(seedData);
    }

    const filter = { owner };

    if (channel && channel !== "all") {
      filter.channels = channel;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { name: regex },
        { phone: regex },
        { whatsappPhone: regex },
        { telegramUsername: regex },
        { email: regex },
      ];
    }

    const contacts = await Contact.find(filter)
      .sort({ isFavorite: -1, lastMessageAt: -1, updatedAt: -1 })
      .lean();

    res.json({ success: true, contacts });
  } catch (err) {
    console.error("getContacts error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/contacts
 * Create a new contact with deduplication
 */
export const createContact = async (req, res) => {
  try {
    const owner = req.user.id;
    const {
      name,
      avatar = "",
      phone = "",
      whatsappPhone = "",
      telegramUsername = "",
      telegramChatId = "",
      email = "",
      notes = "",
      isFavorite = false,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Contact name is required" });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanWaPhone = (whatsappPhone || phone).trim().replace(/[^+0-9]/g, "");
    const cleanTgUser = telegramUsername.trim().replace(/^@/, "");
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanWaPhone && !cleanTgUser && !cleanEmail && !cleanPhone) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one channel identity (Phone, WhatsApp, Telegram, or Email)",
      });
    }

    // Deduplication check: check if contact with matching identity already exists for this user
    const existing = await Contact.findOne({
      owner,
      $or: [
        cleanEmail ? { email: cleanEmail } : null,
        cleanWaPhone ? { whatsappPhone: cleanWaPhone } : null,
        cleanTgUser ? { telegramUsername: cleanTgUser } : null,
      ].filter(Boolean),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A contact named "${existing.name}" with matching identifiers already exists.`,
        contact: existing,
      });
    }

    const channels = inferChannels({
      whatsappPhone: cleanWaPhone,
      phone: cleanPhone,
      telegramUsername: cleanTgUser,
      email: cleanEmail,
    });

    const contact = new Contact({
      owner,
      name: cleanName,
      avatar: avatar.trim(),
      phone: cleanPhone || cleanWaPhone,
      whatsappPhone: cleanWaPhone,
      telegramUsername: cleanTgUser,
      telegramChatId: telegramChatId.trim(),
      email: cleanEmail,
      channels,
      notes: notes.trim(),
      isFavorite: Boolean(isFavorite),
      lastMessage: "",
      lastMessageAt: new Date(),
    });

    await contact.save();
    res.status(201).json({ success: true, message: "Contact created successfully", contact });
  } catch (err) {
    console.error("createContact error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/contacts/:id
 * Update an existing contact
 */
export const updateContact = async (req, res) => {
  try {
    const owner = req.user.id;
    const { id } = req.params;

    const contact = await Contact.findOne({ _id: id, owner });
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    const fields = [
      "name",
      "avatar",
      "phone",
      "whatsappPhone",
      "telegramUsername",
      "telegramChatId",
      "email",
      "notes",
      "isFavorite",
      "isMuted",
      "isBlocked",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        contact[f] = req.body[f];
      }
    });

    if (contact.telegramUsername) {
      contact.telegramUsername = contact.telegramUsername.replace(/^@/, "").trim();
    }
    if (contact.email) {
      contact.email = contact.email.toLowerCase().trim();
    }

    contact.channels = inferChannels({
      whatsappPhone: contact.whatsappPhone,
      phone: contact.phone,
      telegramUsername: contact.telegramUsername,
      email: contact.email,
    });

    await contact.save();
    res.json({ success: true, message: "Contact updated successfully", contact });
  } catch (err) {
    console.error("updateContact error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/contacts/:id
 */
export const deleteContact = async (req, res) => {
  try {
    const owner = req.user.id;
    const { id } = req.params;

    const deleted = await Contact.findOneAndDelete({ _id: id, owner });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    res.json({ success: true, message: "Contact deleted successfully" });
  } catch (err) {
    console.error("deleteContact error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/contacts/:id/conversation
 * Retrieves the full chronological chat thread between the user and this contact
 * for the selected channel (or all channels).
 */
export const getContactConversation = async (req, res) => {
  try {
    const owner = req.user.id;
    const { id } = req.params;
    const { channel } = req.query;

    const contact = await Contact.findOne({ _id: id, owner }).lean();
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    // Identifiers associated with this contact
    const identifiers = [
      contact.whatsappPhone,
      contact.phone,
      contact.telegramUsername ? `@${contact.telegramUsername}` : null,
      contact.telegramUsername,
      contact.telegramChatId,
      contact.email,
    ].filter(Boolean);

    const messageQuery = {
      owner,
      $or: [
        { contact: contact._id },
        { recipient: { $in: identifiers } },
      ],
    };

    if (channel && channel !== "all") {
      messageQuery.channel = channel;
    }

    const messages = await Message.find(messageQuery)
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      contact,
      messages,
    });
  } catch (err) {
    console.error("getContactConversation error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
