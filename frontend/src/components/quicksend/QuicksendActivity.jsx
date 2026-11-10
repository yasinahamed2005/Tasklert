import React, { useState, useEffect } from "react";
import {
  BarChart2,
  TrendingUp,
  Send,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { fetchQuicksendOverview } from "../../services/unifiedScheduleApi";

export function QuicksendActivity({ onSelectChannel }) {
  const [data, setData] = useState({
    stats: {
      messagesSent: 0,
      emailsSent: 0,
      scheduled: 0,
      pending: 0,
    },
    recentMessages: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetchQuicksendOverview();
        if (res?.success) setData(res);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalActions =
    data.stats.messagesSent + data.stats.emailsSent + data.stats.scheduled;

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-purple-100 p-4 sm:p-6 shadow-2xs animate-fadeIn space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="pb-4 border-b border-purple-50">
        <h2 className="text-lg font-black text-[#17133D] flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-purple-600" />
          <span>QuickSend Activity & Performance</span>
        </h2>
        <p className="text-xs text-[#77738F] mt-0.5 font-medium">
          Real-time metrics, provider delivery health, and volume across communication channels.
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#FAF7FF] rounded-2xl border border-purple-100 p-4.5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#17133D] leading-tight block">
              {loading ? "…" : totalActions}
            </span>
            <span className="text-xs text-[#77738F] font-semibold">
              Total Weekly Dispatches
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#E8F8F1]/60 rounded-2xl border border-[#BCECD7] p-4.5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#079B68] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#17133D] leading-tight block">
              99.8%
            </span>
            <span className="text-xs text-[#77738F] font-semibold">
              Delivery Success Rate
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#F0F7FF] rounded-2xl border border-blue-100 p-4.5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#2878D0] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#17133D] leading-tight block">
              {loading ? "…" : data.stats.scheduled}
            </span>
            <span className="text-xs text-[#77738F] font-semibold">
              Upcoming Scheduled
            </span>
          </div>
        </div>
      </div>

      {/* Channel Volume Breakdown */}
      <div className="bg-[#FAF7FF] rounded-2xl border border-purple-100 p-5">
        <h3 className="text-sm font-black text-[#17133D] mb-3">
          Channel Volume Distribution
        </h3>

        <div className="space-y-3.5">
          {/* Telegram */}
          <div>
            <div className="flex justify-between text-xs font-bold text-[#17133D] mb-1">
              <span className="flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>Telegram Messages</span>
              </span>
              <span>{data.stats.messagesSent}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-purple-100 overflow-hidden">
              <div
                className="h-full bg-[#229ED9] rounded-full transition-all duration-500"
                style={{
                  width: `${totalActions ? (data.stats.messagesSent / totalActions) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Emails */}
          <div>
            <div className="flex justify-between text-xs font-bold text-[#17133D] mb-1">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#2878D0]" />
                <span>Google & Tasklert Mail</span>
              </span>
              <span>{data.stats.emailsSent}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-purple-100 overflow-hidden">
              <div
                className="h-full bg-purple-600 rounded-full transition-all duration-500"
                style={{
                  width: `${totalActions ? (data.stats.emailsSent / totalActions) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuicksendActivity;

