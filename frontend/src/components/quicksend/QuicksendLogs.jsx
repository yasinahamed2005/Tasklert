import React, { useState, useEffect, useCallback } from "react";
import {
  Send,
  Mail,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Paperclip,
  MoreVertical,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { fetchQuicksendOverview } from "../../services/unifiedScheduleApi";

export function QuicksendLogs({ onSelectChannel, onBackToOverview }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchQuicksendOverview();
      if (res?.recentMessages) {
        setMessages(res.recentMessages);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = messages.filter((m) => {
    const matchesChan = channelFilter === "all" || m.channel === channelFilter;
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      (m.recipient || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.subject || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.preview || "").toLowerCase().includes(search.toLowerCase());
    return matchesChan && matchesStatus && matchesSearch;
  });

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-purple-100 p-4 sm:p-6 shadow-2xs animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-50 mb-4">
        <div>
          <h2 className="text-lg font-black text-[#17133D] flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-600 -rotate-12" />
            <span>Message Delivery Logs</span>
          </h2>
          <p className="text-xs text-[#77738F] mt-0.5 font-medium">
            Complete audit trail across Tasklert Mail, Google Mail, and Telegram.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-9 pr-3 py-1.5 bg-purple-50/50 border border-purple-100 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-purple-400 focus:bg-white transition"
            />
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="p-2 rounded-xl border border-purple-100 bg-purple-50 hover:bg-purple-100 text-purple-700 transition cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-purple-50/60">
        {/* Channel Filters */}
        <div className="flex items-center gap-1.5">
          {[
            { id: "all", label: "All Channels" },
            { id: "tasklert_mail", label: "Tasklert Mail" },
            { id: "google_mail", label: "Google Mail" },
            { id: "telegram", label: "Telegram" },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannelFilter(c.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                channelFilter === c.id
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-purple-50/60 text-purple-800 hover:bg-purple-100/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1">
          {["all", "sent", "scheduled", "failed"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition cursor-pointer ${
                statusFilter === st
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse p-3.5 rounded-2xl bg-gray-50 flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <Filter className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">No matching delivery logs</p>
            <p className="text-xs text-gray-400 mt-1">Try clearing filters or search keywords.</p>
          </div>
        ) : (
          <div className="divide-y divide-purple-50">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="py-3 px-3 hover:bg-purple-50/40 rounded-2xl flex items-center justify-between gap-3 transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    {item.channel === "telegram" ? (
                      <Send className="w-4 h-4 text-[#229ED9]" />
                    ) : (
                      <Mail className="w-4 h-4 text-purple-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#17133D] truncate">
                        {item.recipient}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded-md">
                        {item.channel.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#77738F] truncate mt-0.5">
                      {item.preview || item.subject || "(No message body)"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.hasAttachment && <Paperclip className="w-3.5 h-3.5 text-gray-400" />}

                  {item.status === "scheduled" ? (
                    <span className="bg-[#F4EEFB] text-[#7629E8] border border-purple-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#7629E8]" />
                      <span>Scheduled</span>
                    </span>
                  ) : item.status === "failed" ? (
                    <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      <span>Failed</span>
                    </span>
                  ) : (
                    <span className="bg-[#E8F8F1] text-[#079B68] text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[#079B68]" />
                      <span>Sent</span>
                    </span>
                  )}

                  <span className="text-[11px] text-gray-400 font-medium min-w-[50px] text-right">
                    {item.displayDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QuicksendLogs;

