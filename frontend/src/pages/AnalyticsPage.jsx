import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  Table as TableIcon,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { API_BASE_URL } from "../config/api";
import PageTransitionLoader from "../components/PageTransitionLoader";

const PRIORITY_COLORS = {
  High: "#ef4444",   // Red
  Medium: "#f97316", // Orange
  Low: "#10b981",    // Green
};

export const AnalyticsPage = () => {
  const [range, setRange] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Dynamic theme accent color
  const themePrimary = useMemo(() => {
    if (typeof window === "undefined") return "#a855f7";
    return (
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
      "#a855f7"
    );
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const params = { range };
      if (range === "custom") {
        if (!customStart || !customEnd) {
          setLoading(false);
          return;
        }
        params.startDate = customStart;
        params.endDate = customEnd;
      }

      const { data } = await axios.get(`${API_BASE_URL}/api/analytics/summary`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(err.response?.data?.message || "Failed to load productivity analytics.");
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle CSV Export (Feature F)
  const handleExportCSV = async (type = "tasks") => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to export reports.");
        return;
      }

      const params = { type, range };
      if (range === "custom" && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }

      const response = await axios.get(`${API_BASE_URL}/api/analytics/export`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      // Create download link
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `tasklert_${type}_report_${range}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${type === "tasks" ? "Task records" : "Focus session"} CSV report downloaded! 📊`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to generate CSV export.");
    } finally {
      setExporting(false);
    }
  };

  const summary = analyticsData?.summary || {};
  const priorityBreakdown = analyticsData?.priorityBreakdown || {};
  const timeline = analyticsData?.timeline || [];

  // Transform priority breakdown for Pie Chart
  const pieData = useMemo(() => {
    return [
      { name: "High", value: priorityBreakdown.High?.total || 0, color: PRIORITY_COLORS.High },
      { name: "Medium", value: priorityBreakdown.Medium?.total || 0, color: PRIORITY_COLORS.Medium },
      { name: "Low", value: priorityBreakdown.Low?.total || 0, color: PRIORITY_COLORS.Low },
    ].filter((item) => item.value > 0);
  }, [priorityBreakdown]);

  return (
    <div className="p-2 sm:p-4 md:p-6 min-w-0 w-full space-y-6">
      {/* Top Header & Range Controls */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-purple-100 p-3.5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-2xl bg-purple-100/80 text-purple-600 shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800">
                <span className="sm:hidden">Analytics</span>
                <span className="hidden sm:inline">Productivity & Analytics</span>
              </h1>
              <p className="hidden sm:block text-xs sm:text-sm text-gray-500 mt-0.5">
                Track real task throughput, completion milestones, and focused study/work hours.
              </p>
            </div>
          </div>

          {/* Mobile Range Select Dropdown (Matches Screen 9 "Last 30 Days ⌵") */}
          <div className="sm:hidden">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-purple-50/80 border border-purple-200 text-purple-800 font-bold text-xs rounded-xl px-2.5 py-1.5 shadow-xs focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Desktop Range Selector & Export Controls */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {/* Preset Chips */}
          <div className="inline-flex rounded-xl bg-purple-50/70 p-1 border border-purple-100">
            {["7d", "30d", "90d", "custom"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  range === r
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-purple-700"
                }`}
              >
                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r === "90d" ? "90 Days" : "Custom"}
              </button>
            ))}
          </div>

          {/* Export CSV Dropdown / Action */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExportCSV("tasks")}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-50 transition cursor-pointer shadow-xs disabled:opacity-50"
              title="Download tasks CSV report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Tasks</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCSV("focus")}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-50 transition cursor-pointer shadow-xs disabled:opacity-50"
              title="Download focus sessions CSV report"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Export Focus</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Range Pickers (Visible when custom range is selected) */}
      {range === "custom" && (
        <div className="bg-purple-50/60 rounded-2xl border border-purple-100 p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-700">Start Date:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border border-purple-200 rounded-lg p-1.5 bg-white text-xs focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-700">End Date:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-purple-200 rounded-lg p-1.5 bg-white text-xs focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={!customStart || !customEnd}
            className="px-3.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition cursor-pointer disabled:opacity-40"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Loading Transition */}
      {loading ? (
        <PageTransitionLoader message="Computing productivity aggregates and historical trends..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center justify-between">
          <p>{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 font-bold rounded-lg text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : !analyticsData?.hasActivity ? (
        /* Empty State for new users with no recorded tasks */
        <div className="py-20 bg-white rounded-3xl border border-purple-100 p-8 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">No Task Activity Recorded Yet</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
            As you create, schedule, and complete tasks with reliable timestamps, your daily completion trends, throughput charts, and priority breakdowns will populate here.
          </p>
        </div>
      ) : (
        <>
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Tasks Completed */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-purple-100 shadow-sm hover:shadow-md transition min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                  Completed
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-800">
                  {summary.completedInPeriod || 0}
                </span>
                {summary.comparison?.hasPrevData && (
                  <span
                    className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${
                      summary.comparison.completedChangePct >= 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {summary.comparison.completedChangePct >= 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {Math.abs(summary.comparison.completedChangePct)}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Based on verifiable completion timestamps</p>
            </div>

            {/* Card 2: Tasks Created */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-purple-100 shadow-sm hover:shadow-md transition min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                  Created
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-800">
                  {summary.createdInPeriod || 0}
                </span>
                {summary.comparison?.hasPrevData && (
                  <span
                    className={`inline-flex items-center text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md ${
                      summary.comparison.createdChangePct >= 0
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {summary.comparison.createdChangePct >= 0 ? "+" : ""}
                    {summary.comparison.createdChangePct}%
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 truncate">In reporting window</p>
            </div>

            {/* Card 3: Completion Rate */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-purple-100 shadow-sm hover:shadow-md transition min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                    Rate
                  </span>
                  <span
                    className="cursor-help text-gray-400 hidden sm:inline"
                    title="Calculation: (Tasks Completed in period / (Tasks Completed in period + Pending in period)) * 100"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="p-1.5 sm:p-2 rounded-xl bg-fuchsia-50 text-fuchsia-600 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-800">
                  {summary.completionRate || 0}%
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="w-full rounded-full h-1.5 sm:h-2 mt-2 overflow-hidden theme-progress-track">
                <div
                  className="h-full rounded-full transition-all duration-500 theme-progress-fill"
                  style={{ width: `${Math.min(100, summary.completionRate || 0)}%` }}
                />
              </div>
            </div>

            {/* Card 4: Focus Time Recorded */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-purple-100 shadow-sm hover:shadow-md transition min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                  Focus Time
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-800">
                  {summary.focusMinutes ? Math.floor(summary.focusMinutes / 60) : 0}h{" "}
                  {summary.focusMinutes ? summary.focusMinutes % 60 : 0}m
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 truncate">Pomodoro focus</p>
            </div>
          </div>

          {/* Main Visualizations Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Tasks Completed Over Time (Area Chart - 2 Cols) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-6 border border-purple-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Completion Trend</h3>
                  <p className="text-xs text-gray-500">
                    Tasks completed by verifiable completion timestamp
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTable((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-100 bg-purple-50/50 text-xs text-purple-700 font-semibold hover:bg-purple-100 transition cursor-pointer"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{showTable ? "Hide Data Table" : "Show Data Table"}</span>
                </button>
              </div>

              {/* Responsive Area Chart */}
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={themePrimary} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={themePrimary} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(val) => {
                        const parts = val.split("-");
                        return `${parts[1]}/${parts[2]}`;
                      }}
                    />
                    <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        borderColor: "#334155",
                        borderRadius: "0.75rem",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Completed Tasks"
                      stroke={themePrimary}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#completedGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      name="Created Tasks"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#createdGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Priority Distribution */}
            <div className="lg:col-span-1 bg-white rounded-2xl p-4 sm:p-6 border border-purple-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800">Priority Breakdown</h3>
                <p className="text-xs text-gray-500">Distribution across active & completed tasks</p>

                <div className="h-52 w-full mt-2">
                  {pieData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                      No priority data in this period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={75}
                          paddingAngle={4}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            borderRadius: "0.75rem",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Priority Legend List */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                {["High", "Medium", "Low"].map((p) => {
                  const item = priorityBreakdown[p] || { total: 0, completed: 0 };
                  return (
                    <div key={p} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: PRIORITY_COLORS[p] }}
                        />
                        {p} Priority
                      </span>
                      <span className="text-gray-500 font-mono">
                        {item.completed} / {item.total} done
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart 3: Created vs Completed Throughput (Bar Chart) */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-purple-100 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-1">Created vs. Completed Throughput</h3>
            <p className="text-xs text-gray-500 mb-4">
              Daily comparison of task generation vs. task completion velocity
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => {
                      const parts = val.split("-");
                      return `${parts[1]}/${parts[2]}`;
                    }}
                  />
                  <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderRadius: "0.75rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="created" name="Created" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accessible Data Table (Toggleable) */}
          {showTable && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-purple-100 shadow-sm overflow-hidden">
              <h3 className="text-base font-bold text-gray-800 mb-3">Daily Throughput Data Table</h3>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-purple-50 text-purple-900 border-b border-purple-100">
                    <tr>
                      <th className="p-2.5 font-bold">Date</th>
                      <th className="p-2.5 font-bold">Created Tasks</th>
                      <th className="p-2.5 font-bold">Completed Tasks</th>
                      <th className="p-2.5 font-bold">Net Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {timeline.map((row) => (
                      <tr key={row.date} className="hover:bg-purple-50/20">
                        <td className="p-2.5 font-medium text-gray-700">{row.date}</td>
                        <td className="p-2.5 text-gray-600">{row.created}</td>
                        <td className="p-2.5 text-emerald-600 font-bold">{row.completed}</td>
                        <td className="p-2.5">
                          <span
                            className={`font-semibold ${
                              row.completed - row.created >= 0 ? "text-emerald-600" : "text-amber-600"
                            }`}
                          >
                            {row.completed - row.created >= 0 ? "+" : ""}
                            {row.completed - row.created}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
