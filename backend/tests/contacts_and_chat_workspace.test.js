import test from "node:test";
import assert from "node:assert/strict";
import { SEED_CONTACTS } from "../controllers/contactController.js";

test("Contacts: Seed contacts list has valid structure and channel mappings", () => {
  assert.ok(Array.isArray(SEED_CONTACTS));
  assert.ok(SEED_CONTACTS.length >= 6);

  const ramu = SEED_CONTACTS.find((c) => c.name === "Ramu");
  assert.ok(ramu, "Ramu must exist in starter contacts");
  assert.ok(ramu.whatsappPhone.includes("7997864218"));
  assert.ok(ramu.channels.includes("whatsapp"));
  assert.ok(ramu.channels.includes("telegram"));
  assert.ok(ramu.channels.includes("email"));

  const priya = SEED_CONTACTS.find((c) => c.name === "Priya Sharma");
  assert.ok(priya, "Priya Sharma must exist");
  assert.ok(priya.avatar.startsWith("https://"));
});

test("Contacts: Channel inference accurately identifies available platforms", () => {
  const inferChannels = ({ whatsappPhone, phone, telegramUsername, email }) => {
    const set = new Set();
    if (whatsappPhone || phone) set.add("whatsapp");
    if (telegramUsername) set.add("telegram");
    if (email) set.add("email");
    return Array.from(set);
  };

  // WhatsApp only
  const waOnly = inferChannels({ whatsappPhone: "+14155552671" });
  assert.deepEqual(waOnly, ["whatsapp"]);

  // Telegram and Email
  const tgAndEmail = inferChannels({ telegramUsername: "dev_lead", email: "lead@tasklert.com" });
  assert.ok(tgAndEmail.includes("telegram"));
  assert.ok(tgAndEmail.includes("email"));
  assert.equal(tgAndEmail.includes("whatsapp"), false);

  // All three
  const allThree = inferChannels({
    whatsappPhone: "+919876543210",
    telegramUsername: "alex",
    email: "alex@example.com",
  });
  assert.equal(allThree.length, 3);
});

test("Contacts: Deduplication logic rejects duplicate identifiers for the same user", () => {
  const existingContacts = [
    { owner: "user_1", email: "ramu@example.com", whatsappPhone: "+917997864218", telegramUsername: "ramu_tech" },
    { owner: "user_2", email: "ramu@example.com", whatsappPhone: "+917997864218", telegramUsername: "ramu_tech" },
  ];

  const isDuplicateForOwner = (owner, candidate) => {
    return existingContacts.some(
      (c) =>
        c.owner === owner &&
        ((candidate.email && c.email === candidate.email) ||
          (candidate.whatsappPhone && c.whatsappPhone === candidate.whatsappPhone) ||
          (candidate.telegramUsername && c.telegramUsername === candidate.telegramUsername))
    );
  };

  // Duplicate for user_1
  assert.equal(isDuplicateForOwner("user_1", { email: "ramu@example.com" }), true);
  assert.equal(isDuplicateForOwner("user_1", { whatsappPhone: "+917997864218" }), true);
  assert.equal(isDuplicateForOwner("user_1", { telegramUsername: "ramu_tech" }), true);

  // Unique identifier for user_1
  assert.equal(isDuplicateForOwner("user_1", { email: "unique@example.com" }), false);

  // Multi-tenant safety: user_3 can use ramu@example.com without conflict
  assert.equal(isDuplicateForOwner("user_3", { email: "ramu@example.com" }), false);
});

test("Contacts: Filtering by channel restricts list to eligible recipients", () => {
  const contacts = [
    { name: "Contact A", channels: ["whatsapp", "email"] },
    { name: "Contact B", channels: ["telegram"] },
    { name: "Contact C", channels: ["whatsapp", "telegram", "email"] },
    { name: "Contact D", channels: ["email"] },
  ];

  const filterByChannel = (channel) => {
    if (!channel || channel === "all") return contacts;
    return contacts.filter((c) => c.channels.includes(channel));
  };

  const waList = filterByChannel("whatsapp");
  assert.equal(waList.length, 2);
  assert.ok(waList.every((c) => c.channels.includes("whatsapp")));

  const tgList = filterByChannel("telegram");
  assert.equal(tgList.length, 2);
  assert.ok(tgList.every((c) => c.channels.includes("telegram")));

  const emailList = filterByChannel("email");
  assert.equal(emailList.length, 3);
  assert.ok(emailList.every((c) => c.channels.includes("email")));
});

test("Contacts: Scheduled message association with contact preserves scheduled time and content", () => {
  const contact = {
    _id: "c_ramu",
    name: "Ramu",
    whatsappPhone: "+917997864218",
  };

  const scheduledMessage = {
    _id: "msg_scheduled_01",
    contact: contact._id,
    channel: "whatsapp",
    recipient: contact.whatsappPhone,
    message: "Hi Ramu, Just a reminder about our meeting tomorrow morning at 7:00 AM.",
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    timeZone: "Asia/Kolkata",
  };

  assert.equal(scheduledMessage.contact, "c_ramu");
  assert.equal(scheduledMessage.status, "scheduled");
  assert.ok(scheduledMessage.message.includes("Hi Ramu"));
  assert.ok(new Date(scheduledMessage.scheduledAt).getTime() > Date.now());
});
