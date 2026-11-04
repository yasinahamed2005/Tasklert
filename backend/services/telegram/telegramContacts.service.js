import { Api } from "telegram";
import { getClientForUser } from "./telegramClient.service.js";

/**
 * Fetch real Telegram contacts for authenticated user.
 */
export const getTelegramContacts = async (userId, searchQuery = "") => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected. Please authenticate first.");
  }

  try {
    const result = await client.invoke(
      new Api.contacts.GetContacts({
        hash: BigInt(0),
      })
    );

    if (!result || !result.users) {
      return [];
    }

    let contacts = result.users.map((user) => {
      const firstName = user.firstName || "";
      const lastName = user.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || user.username || "Telegram User";
      const isOnline = user.status?.className === "UserStatusOnline";

      return {
        id: user.id ? user.id.toString() : "",
        name: fullName,
        firstName,
        lastName,
        username: user.username || "",
        phone: user.phone ? `+${user.phone}` : "",
        isBot: Boolean(user.bot),
        isOnline,
        verified: Boolean(user.verified),
        status: isOnline ? "online" : "offline",
      };
    });

    // Filter bots if needed or sort alphabetically
    contacts.sort((a, b) => a.name.localeCompare(b.name));

    if (searchQuery && typeof searchQuery === "string" && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      contacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }

    return contacts;
  } catch (err) {
    console.error(`[TelegramContacts] Error for user ${userId}:`, err.message);
    throw new Error(err.message || "Failed to retrieve Telegram contacts.");
  }
};
