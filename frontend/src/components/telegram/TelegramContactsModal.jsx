import React, { useState, useEffect } from "react";
import {
  Search,
  User,
  Users,
  X,
  Loader2,
  Check,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { fetchTelegramContacts } from "../../services/telegramApi";
import TelegramAvatar from "./TelegramAvatar";

export default function TelegramContactsModal({ isOpen, onClose, onSelectContact }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError("");

    fetchTelegramContacts("")
      .then((data) => setContacts(data))
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load contacts.");
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-purple-100 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-purple-100/80 flex items-center justify-between bg-purple-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">New Telegram Conversation</h3>
              <p className="text-[11px] text-gray-500 font-medium">Select a contact to message</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-purple-100/70">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, @username, or phone..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-purple-100 bg-white text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-purple-50">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin mb-2" />
              <span className="text-xs text-gray-500">Loading Telegram contacts...</span>
            </div>
          ) : error ? (
            <div className="py-8 px-4 text-center text-xs text-rose-600 font-medium">
              {error}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No contacts found matching your search.
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  onSelectContact({
                    id: contact.id,
                    title: contact.name,
                    username: contact.username,
                    phone: contact.phone,
                    type: "private",
                  });
                  onClose();
                }}
                className="w-full p-2.5 rounded-2xl hover:bg-purple-50/70 flex items-center justify-between text-left transition group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TelegramAvatar
                    chat={{ id: contact.id, title: contact.name, type: "private" }}
                    size="sm"
                    showBadge={false}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-700">
                      {contact.name}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                      {contact.username ? (
                        <span className="text-purple-600 font-mono">@{contact.username}</span>
                      ) : (
                        <span>{contact.phone}</span>
                      )}
                      {contact.isOnline && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          online
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition pr-2">
                  Chat →
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
