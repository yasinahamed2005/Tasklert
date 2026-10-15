import React from "react";

// Minimal, accessible App Startup Fallback
export const AppStartupFallback = ({ label = "Loading Tasklert..." }) => (
  <div
    role="status"
    aria-live="polite"
    className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50/50 p-4 transition-all"
  >
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 animate-pulse motion-reduce:animate-none">
        <span className="text-white font-extrabold text-2xl tracking-tighter">T</span>
      </div>
      <div className="h-1.5 w-24 bg-purple-100 rounded-full overflow-hidden">
        <div className="h-full bg-purple-600 rounded-full w-2/3 animate-[shimmer_1.5s_infinite] motion-reduce:animate-none" />
      </div>
      <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase mt-1">
        {label}
      </span>
    </div>
  </div>
);

// Dashboard Skeleton: matches metric cards, quick actions, and task list layout
export const DashboardSkeleton = () => (
  <div
    role="status"
    aria-label="Loading dashboard"
    className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full animate-pulse motion-reduce:animate-none"
  >
    {/* Greeting and Search Bar */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 rounded-xl" />
        <div className="h-4 w-32 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-10 w-full sm:w-64 bg-gray-200 rounded-xl" />
    </div>

    {/* Metric Cards Row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 bg-purple-100 rounded-xl" />
            <div className="w-10 h-4 bg-gray-100 rounded-full" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-lg" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      ))}
    </div>

    {/* Quick Actions Skeleton */}
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
      <div className="h-4 w-28 bg-gray-200 rounded" />
      <div className="flex gap-2 overflow-x-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-28 bg-gray-100 rounded-xl shrink-0" />
        ))}
      </div>
    </div>

    {/* Task List Section Skeleton */}
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-5 w-36 bg-gray-200 rounded-lg" />
        <div className="h-4 w-16 bg-gray-100 rounded" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-md bg-gray-200" />
              <div className="space-y-1.5">
                <div className="h-4 w-40 sm:w-64 bg-gray-200 rounded" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="w-16 h-6 bg-purple-50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Task List Skeleton (for Pending and Completed pages)
export const TaskListSkeleton = () => (
  <div
    role="status"
    aria-label="Loading tasks"
    className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full animate-pulse motion-reduce:animate-none"
  >
    <div className="flex justify-between items-center">
      <div className="h-7 w-40 bg-gray-200 rounded-xl" />
      <div className="h-9 w-28 bg-purple-100 rounded-xl" />
    </div>
    <div className="flex gap-2">
      <div className="h-9 flex-1 bg-gray-100 rounded-xl" />
      <div className="h-9 w-20 bg-gray-100 rounded-xl" />
    </div>
    <div className="space-y-3 pt-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-5 h-5 rounded-md bg-gray-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="flex gap-2">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
          <div className="w-12 h-6 bg-gray-100 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

// Calendar Skeleton
export const CalendarSkeleton = () => (
  <div
    role="status"
    aria-label="Loading calendar"
    className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto w-full animate-pulse motion-reduce:animate-none"
  >
    <div className="flex justify-between items-center">
      <div className="h-7 w-44 bg-gray-200 rounded-xl" />
      <div className="flex gap-2">
        <div className="h-9 w-20 bg-gray-100 rounded-xl" />
        <div className="h-9 w-9 bg-gray-100 rounded-xl" />
        <div className="h-9 w-9 bg-gray-100 rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-7 gap-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="h-6 bg-gray-100 rounded text-center mb-2" />
      ))}
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-16 sm:h-20 bg-gray-50/70 rounded-xl p-1.5 flex flex-col justify-between">
          <div className="h-3 w-4 bg-gray-200 rounded" />
          {i % 4 === 0 && <div className="h-2 w-full bg-purple-100 rounded" />}
        </div>
      ))}
    </div>
  </div>
);

// Analytics Skeleton
export const AnalyticsSkeleton = () => (
  <div
    role="status"
    aria-label="Loading analytics"
    className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full animate-pulse motion-reduce:animate-none"
  >
    <div className="flex justify-between items-center">
      <div className="h-7 w-40 bg-gray-200 rounded-xl" />
      <div className="h-9 w-32 bg-gray-100 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-2">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-6 w-14 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs h-64 flex flex-col justify-between">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-50 rounded-xl flex items-end justify-between p-4 gap-2">
          {[40, 70, 55, 90, 65, 80].map((h, idx) => (
            <div key={idx} className="bg-purple-100 rounded-t w-full" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs h-64 flex flex-col justify-between">
        <div className="h-4 w-36 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-50 rounded-xl flex items-center justify-center">
          <div className="w-28 h-28 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
        </div>
      </div>
    </div>
  </div>
);

// Focus Timer Skeleton
export const FocusTimerSkeleton = () => (
  <div
    role="status"
    aria-label="Loading focus timer"
    className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto w-full text-center animate-pulse motion-reduce:animate-none"
  >
    <div className="h-7 w-36 bg-gray-200 rounded-xl mx-auto" />
    <div className="w-56 h-56 rounded-full border-8 border-purple-100 bg-white mx-auto flex items-center justify-center shadow-xs">
      <div className="h-10 w-28 bg-gray-200 rounded-xl" />
    </div>
    <div className="flex justify-center gap-3">
      <div className="h-11 w-32 bg-purple-200 rounded-xl" />
      <div className="h-11 w-11 bg-gray-100 rounded-xl" />
    </div>
  </div>
);

// Alarms Page Skeleton
export const AlarmsSkeleton = () => (
  <div
    role="status"
    aria-label="Loading alarms"
    className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full animate-pulse motion-reduce:animate-none"
  >
    <div className="flex justify-between items-center">
      <div className="h-7 w-36 bg-gray-200 rounded-xl" />
      <div className="h-9 w-28 bg-purple-100 rounded-xl" />
    </div>
    <div className="h-28 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-3xl" />
    <div className="space-y-3 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-36 bg-gray-100 rounded" />
          </div>
          <div className="w-11 h-6 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
