import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Command,
  ArrowRight,
  Home,
  ListChecks,
  CheckCircle2,
  Calendar,
  Timer,
  BarChart3,
  Send,
  AlarmClock,
  Settings,
  User,
  Palette,
  Bell,
  Shield,
  Sliders,
  Plus,
  Download,
  Clock,
  Tag,
  Folder,
} from "lucide-react";

/**
 * Static registry of all actual Tasklert routes, settings sections, and quick actions.
 * Strictly reflects implemented features in the repository.
 */
const STATIC_SEARCH_REGISTRY = [
  // PAGES
  {
    id: "page-dashboard",
    title: "Dashboard",
    description: "Overview of your workspace, urgent tasks, and productivity metrics",
    category: "Pages",
    path: "/",
    icon: Home,
    aliases: ["home", "overview", "main", "workspace", "stats"],
  },
  {
    id: "page-pending",
    title: "Pending Tasks",
    description: "Active to-dos, upcoming deadlines, and in-progress work",
    category: "Pages",
    path: "/pending",
    icon: ListChecks,
    aliases: ["pending", "todo", "tasks", "in progress", "unfinished", "active"],
  },
  {
    id: "page-completed",
    title: "Completed Tasks",
    description: "Archived finished tasks, accomplishments, and completion log",
    category: "Pages",
    path: "/complete",
    icon: CheckCircle2,
    aliases: ["completed", "done", "finished", "archive", "history"],
  },
  {
    id: "page-calendar",
    title: "Calendar Schedule",
    description: "Monthly, weekly, and daily view of task deadlines and events",
    category: "Pages",
    path: "/calendar",
    icon: Calendar,
    aliases: ["calendar", "schedule", "agenda", "month", "events", "dates", "timeline"],
  },
  {
    id: "page-focus",
    title: "Pomodoro Focus Timer",
    description: "Deep work intervals, break tracking, and authoritative timer sessions",
    category: "Pages",
    path: "/focus",
    icon: Timer,
    aliases: ["focus", "timer", "pomodoro", "stopwatch", "deep work", "interval", "break"],
  },
  {
    id: "page-analytics",
    title: "Productivity Analytics",
    description: "Task velocity charts, priority breakdown, and completion rate trends",
    category: "Pages",
    path: "/analytics",
    icon: BarChart3,
    aliases: ["analytics", "stats", "charts", "productivity", "metrics", "reports", "insights"],
  },
  {
    id: "page-quicksend",
    title: "QuickSend Messaging",
    description: "Fast messaging and scheduled broadcasts via Email, WhatsApp & Telegram",
    category: "Pages",
    path: "/messages",
    icon: Send,
    aliases: ["quicksend", "quick send", "messages", "chat", "email", "whatsapp", "telegram", "compose", "broadcast"],
  },
  {
    id: "page-alarms",
    title: "Alarms & Clock",
    description: "Exact-time alarms, daily schedules, Web Audio tones, and task completion",
    category: "Pages",
    path: "/alarms",
    icon: AlarmClock,
    aliases: ["alarms", "alarm", "clock", "wake up", "sound", "timer", "ring", "snooze", "schedule"],
  },
  {
    id: "page-profile",
    title: "My Profile",
    description: "Personal details, avatar photo, authentication provider, and password",
    category: "Pages",
    path: "/profile",
    icon: User,
    aliases: ["profile", "my profile", "avatar", "photo", "account", "user", "password", "email", "name"],
  },
  {
    id: "page-settings",
    title: "Account Settings Hub",
    description: "Unified hub for preferences, appearance themes, alarms, and data",
    category: "Pages",
    path: "/settings",
    icon: Settings,
    aliases: ["settings", "preferences", "config", "options", "hub", "setup"],
  },

  // SETTINGS SECTIONS
  {
    id: "setting-general",
    title: "General Preferences",
    description: "Workspace timezone, date display formats, and calendar week start",
    category: "Settings",
    path: "/settings?tab=general",
    icon: Sliders,
    aliases: ["timezone", "date format", "calendar start", "time", "general settings", "gmt", "utc"],
  },
  {
    id: "setting-profile",
    title: "Profile Settings",
    description: "Update display name, email address, and profile avatar picture",
    category: "Settings",
    path: "/settings?tab=profile",
    icon: User,
    aliases: ["edit profile", "change name", "profile photo", "update email", "avatar upload"],
  },
  {
    id: "setting-security",
    title: "Security & Login",
    description: "Change account password and review authentication provider status",
    category: "Settings",
    path: "/settings?tab=security",
    icon: Shield,
    aliases: ["security", "password", "change password", "login credentials", "google account"],
  },
  {
    id: "setting-appearance",
    title: "Appearance & Themes",
    description: "Choose from 6 high-contrast themes: Blue, Peach, Green, Lavender, Dark, Fuchsia",
    category: "Settings",
    path: "/settings?tab=appearance",
    icon: Palette,
    aliases: ["theme", "themes", "appearance", "colors", "dark mode", "accent", "contrast", "blue", "peach", "green", "lavender", "dark", "pink", "fuchsia"],
  },
  {
    id: "setting-notifications",
    title: "Notifications & Devices",
    description: "Push notification permissions, quiet hours, sound tones, and multi-device sync",
    category: "Settings",
    path: "/settings?tab=notifications",
    icon: Bell,
    aliases: ["notifications", "push alerts", "quiet hours", "browser push", "device sync", "notification settings"],
  },
  {
    id: "setting-alarms",
    title: "Alarms & Reminders Defaults",
    description: "Default alarm sound tone, volume levels, and snooze duration intervals",
    category: "Settings",
    path: "/settings?tab=alarms",
    icon: AlarmClock,
    aliases: ["alarm settings", "alarm sound", "snooze duration", "default volume", "ringtone", "chime", "bell"],
  },
  {
    id: "setting-privacy",
    title: "Privacy & Data Export",
    description: "Export personal workspace tasks to CSV or JSON format and manage caches",
    category: "Settings",
    path: "/settings?tab=privacy",
    icon: Download,
    aliases: ["privacy", "data export", "export tasks", "csv", "json", "backup", "download data", "cache"],
  },

  // SAFE ACTIONS
  {
    id: "action-new-task",
    title: "Create New Task",
    description: "Add a new task with due date, priority, category, and exact alarm",
    category: "Actions",
    actionType: "create_task",
    icon: Plus,
    aliases: ["create task", "new task", "add task", "todo new", "add todo"],
  },
  {
    id: "action-start-focus",
    title: "Start Focus Session",
    description: "Launch an authoritative 25-minute Pomodoro deep work interval",
    category: "Actions",
    path: "/focus",
    icon: Timer,
    aliases: ["start focus", "start timer", "begin pomodoro", "deep work now"],
  },
  {
    id: "action-compose-quicksend",
    title: "Compose QuickSend Message",
    description: "Write and dispatch a fast message, email, or scheduled broadcast",
    category: "Actions",
    path: "/messages",
    icon: Send,
    aliases: ["compose message", "send quick message", "dispatch broadcast"],
  },
  {
    id: "action-export-data",
    title: "Export Task Workspace",
    description: "Download all pending and completed tasks as CSV or JSON file",
    category: "Actions",
    path: "/settings?tab=privacy",
    icon: Download,
    aliases: ["download backup", "export all tasks", "backup workspace"],
  },
];

/**
 * Computes match score using Google-style progressive ranking:
 * 1. Exact title match (100)
 * 2. Title starts with query (80)
 * 3. Word in title starts with query (60)
 * 4. Title contains query substring (40)
 * 5. Alias starts with query (50) or contains query (30)
 * 6. Description / category contains query (20)
 */
function scoreItem(item, queryLower) {
  const titleLower = (item.title || "").toLowerCase();
  let score = 0;

  // 1. Exact match
  if (titleLower === queryLower) score = 100;
  // 2. Prefix match on title
  else if (titleLower.startsWith(queryLower)) score = 80;
  // 3. Word in title starts with query
  else {
    const titleWords = titleLower.split(/[\s\-_/]+/);
    if (titleWords.some((w) => w.startsWith(queryLower))) score = 60;
    // 4. Substring match on title
    else if (titleLower.includes(queryLower)) score = 40;
  }

  // 5. Aliases match (includes task tags, description, category, priority)
  if (score === 0 && Array.isArray(item.aliases)) {
    for (const alias of item.aliases) {
      const aLower = (alias || "").toLowerCase();
      if (aLower === queryLower) { score = 70; break; }
      if (aLower.startsWith(queryLower)) { score = 50; break; }
      if (aLower.includes(queryLower)) { score = 30; break; }
    }
  }

  // 6. Description match
  if (score === 0) {
    const descLower = (item.description || "").toLowerCase();
    if (descLower.includes(queryLower)) score = 20;
  }

  // 7. Category match
  if (score === 0) {
    const catLower = (item.category || "").toLowerCase();
    if (catLower.startsWith(queryLower)) score = 25;
    else if (catLower.includes(queryLower)) score = 15;
  }

  // Boost matching user tasks so created tasks appear prominently
  if (score > 0 && item.isTask) {
    score += 5;
  }

  return score;
}

export const GlobalSearch = ({
  tasks = [],
  onSelectTask,
  onAction,
  mobileMode = false,
  onCloseMobile,
  searchQuery: externalQuery,
  onSearchQueryChange,
}) => {
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [srAnnouncement, setSrAnnouncement] = useState("");

  const handleQueryChange = useCallback(
    (val) => {
      if (externalQuery === undefined) {
        setInternalQuery(val);
      }
      if (onSearchQueryChange) {
        onSearchQueryChange(val);
      }
      setIsOpen(true);
    },
    [externalQuery, onSearchQueryChange]
  );

  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Detect Mac OS for modifier key display (⌘+K vs Ctrl+K)
  const isMac = useMemo(() => {
    if (typeof window === "undefined" || !navigator?.platform) return false;
    return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  }, []);

  // Format authenticated user tasks into searchable entities
  const dynamicTaskEntities = useMemo(() => {
    if (!Array.isArray(tasks)) return [];

    return tasks.map((task) => {
      const isDone = Boolean(task.completed);
      const priorityLabel = task.priority || "Medium";
      const categoryLabel = task.category || "General";
      const dueText = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })
        : "";

      return {
        id: `task-${task._id || task.id}`,
        title: task.title,
        description: `${priorityLabel} Priority • ${categoryLabel}${dueText ? ` • Due ${dueText}` : ""} (${isDone ? "Completed" : "Pending"})`,
        category: "Tasks",
        isTask: true,
        taskData: task,
        icon: isDone ? CheckCircle2 : Clock,
        aliases: [
          task.category,
          task.priority,
          isDone ? "completed" : "pending",
          task.description,
          ...(Array.isArray(task.tags) ? task.tags : []),
        ].filter(Boolean),
      };
    });
  }, [tasks]);

  // Extract unique projects/categories and tags from user tasks
  const dynamicTagEntities = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    const categories = new Set();
    const tags = new Set();

    tasks.forEach((t) => {
      if (t.category && t.category !== "General") categories.add(t.category);
      if (Array.isArray(t.tags)) {
        t.tags.forEach((tag) => tag && tags.add(tag));
      }
    });

    const list = [];
    categories.forEach((cat) => {
      list.push({
        id: `project-${cat}`,
        title: `Project: ${cat}`,
        description: `Filter tasks belonging to the ${cat} project`,
        category: "Projects",
        path: `/pending?category=${encodeURIComponent(cat)}`,
        icon: Folder,
        aliases: ["project", "category", cat.toLowerCase()],
      });
    });

    tags.forEach((tag) => {
      list.push({
        id: `tag-${tag}`,
        title: `Tag: #${tag}`,
        description: `Browse tasks tagged with #${tag}`,
        category: "Tags",
        path: `/pending?tag=${encodeURIComponent(tag)}`,
        icon: Tag,
        aliases: ["tag", "label", tag.toLowerCase()],
      });
    });

    return list;
  }, [tasks]);

  // Combined full registry for authenticated search
  const fullIndex = useMemo(() => {
    return [...STATIC_SEARCH_REGISTRY, ...dynamicTaskEntities, ...dynamicTagEntities];
  }, [dynamicTaskEntities, dynamicTagEntities]);

  // Filtered & ranked suggestions based on current query
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();

    // If query is empty, show curated high-value quick suggestions
    if (!q) {
      return [
        STATIC_SEARCH_REGISTRY.find((i) => i.id === "page-pending"),
        STATIC_SEARCH_REGISTRY.find((i) => i.id === "setting-appearance"),
        STATIC_SEARCH_REGISTRY.find((i) => i.id === "page-quicksend"),
        STATIC_SEARCH_REGISTRY.find((i) => i.id === "page-focus"),
        STATIC_SEARCH_REGISTRY.find((i) => i.id === "page-alarms"),
        STATIC_SEARCH_REGISTRY.find((i) => i.id === "action-new-task"),
      ].filter(Boolean);
    }

    // Score and rank all items in the index
    const scored = [];
    for (const item of fullIndex) {
      const score = scoreItem(item, q);
      if (score > 0) {
        scored.push({ item, score });
      }
    }

    // Sort by score descending, then shorter title length for precision
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.item.title || "").length - (b.item.title || "").length;
    });

    // Return top 8 most relevant matches
    return scored.slice(0, 8).map((s) => s.item);
  }, [query, fullIndex]);

  // Announce result count to screen readers (debounced)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setSrAnnouncement("Suggested shortcuts available.");
      } else if (suggestions.length === 0) {
        setSrAnnouncement(`No results found for ${query}.`);
      } else {
        setSrAnnouncement(
          `${suggestions.length} result${suggestions.length === 1 ? "" : "s"} found for ${query}. Use arrow keys to navigate.`
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [suggestions.length, query, isOpen]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(0);
  }, [suggestions]);

  // Handle global keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle outside clicks to close suggestion dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Auto-focus input on mobile open
  useEffect(() => {
    if (mobileMode) {
      setIsOpen(true);
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [mobileMode]);

  // Select and execute an item
  const handleSelect = useCallback(
    (item) => {
      if (!item) return;

      setIsOpen(false);
      if (!item.isTask) {
        handleQueryChange("");
      }

      if (onCloseMobile) {
        onCloseMobile();
      }

      // Handle Task selection
      if (item.isTask && item.taskData) {
        if (onSelectTask) {
          onSelectTask(item.taskData);
        } else {
          navigate(item.taskData.completed ? "/complete" : "/pending");
        }
        return;
      }

      // Handle custom action
      if (item.actionType === "create_task") {
        if (onAction) {
          onAction("create_task");
        } else {
          navigate("/pending");
        }
        return;
      }

      // Standard route navigation
      if (item.path) {
        navigate(item.path);
      }
    },
    [navigate, onSelectTask, onAction, onCloseMobile, handleQueryChange]
  );

  // Key navigation within search input
  const handleInputKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      if (mobileMode && onCloseMobile) {
        onCloseMobile();
      } else {
        inputRef.current?.blur();
      }
      return;
    }

    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      scrollActiveIntoView((activeIndex + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      scrollActiveIntoView((activeIndex - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex]);
      }
    }
  };

  const scrollActiveIntoView = (index) => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('[role="option"]');
    if (items[index]) {
      items[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const clearQuery = () => {
    handleQueryChange("");
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${mobileMode ? "w-full" : "w-full max-w-md lg:max-w-lg xl:max-w-xl"}`}
    >
      {/* Screen Reader Announcement Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* INPUT CONTAINER */}
      <div
        className={`relative flex items-center w-full transition-all duration-200 rounded-xl border ${
          isOpen
            ? "border-[var(--primary)] bg-white ring-2 ring-[var(--primary-200)] shadow-xs"
            : "border-slate-200/90 bg-slate-50/80 hover:bg-white hover:border-slate-300"
        } ${mobileMode ? "py-2 px-3 bg-white border-[var(--primary)] shadow-sm" : "py-1.5 px-3"}`}
      >
        <Search
          className={`w-4 h-4 shrink-0 transition-colors ${
            isOpen ? "text-[color:var(--primary)]" : "text-slate-400"
          }`}
          aria-hidden="true"
        />

        <input
          id={mobileMode ? "tasklert-global-search-mobile" : "tasklert-global-search-desktop"}
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tasks, alarms, settings..."
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="global-search-results"
          aria-haspopup="listbox"
          aria-activedescendant={isOpen && suggestions[activeIndex] ? `search-item-${activeIndex}` : undefined}
          className="w-full ml-2.5 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search input"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer mr-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Keyboard Shortcut Badge (Desktop Only) */}
        {!mobileMode && !query && (
          <div
            className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-400 select-none shadow-2xs pointer-events-none shrink-0"
            aria-hidden="true"
            title={isMac ? "Press ⌘ + K to search" : "Press Ctrl + K to search"}
          >
            {isMac ? <Command className="w-2.5 h-2.5" /> : <span>Ctrl</span>}
            <span>K</span>
          </div>
        )}

        {/* Close Button on Mobile Header Mode */}
        {mobileMode && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onCloseMobile?.();
            }}
            aria-label="Close search"
            className="ml-2 px-2 py-1 text-xs font-semibold text-[color:var(--primary-700)] hover:bg-[var(--primary-50)] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* PROGRESSIVE SUGGESTIONS PANEL */}
      {isOpen && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search suggestions"
          ref={listRef}
          className={`absolute left-0 right-0 z-50 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden animate-page-enter ${
            mobileMode
              ? "top-full mt-2 max-h-[calc(100vh-140px)]"
              : "top-full mt-1.5 max-h-[420px]"
          } overflow-y-auto`}
        >
          {suggestions.length > 0 ? (
            <div className="p-1.5 sm:p-2 space-y-1">
              {/* Category Hint / Header if no query */}
              {!query.trim() && (
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Quick Destinations &amp; Actions</span>
                  <span className="font-normal lowercase">type to filter</span>
                </div>
              )}

              {suggestions.map((item, idx) => {
                const isSelected = idx === activeIndex;
                const IconComponent = item.icon || ArrowRight;

                // Category pill color themes
                const categoryColorMap = {
                  Pages: "bg-blue-50 text-blue-700 border-blue-200/60",
                  Settings: "bg-purple-50 text-purple-700 border-purple-200/60",
                  Tasks: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                  Actions: "bg-amber-50 text-amber-700 border-amber-200/60",
                  Projects: "bg-cyan-50 text-cyan-700 border-cyan-200/60",
                  Tags: "bg-rose-50 text-rose-700 border-rose-200/60",
                };
                const catClass = categoryColorMap[item.category] || "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <div
                    key={item.id}
                    id={`search-item-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-start gap-3 p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer select-none text-left ${
                      isSelected
                        ? "bg-[var(--primary-50)] border border-[var(--primary-200)] shadow-2xs"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    {/* Icon container */}
                    <div
                      className={`p-2 rounded-xl shrink-0 transition-colors ${
                        isSelected
                          ? "bg-white text-[color:var(--primary)] shadow-2xs"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs sm:text-sm font-bold tracking-tight truncate ${
                            isSelected ? "text-[color:var(--primary-700)]" : "text-slate-800"
                          }`}
                        >
                          {item.title}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${catClass}`}
                        >
                          {item.category}
                        </span>
                      </div>

                      <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5 font-medium">
                        {item.description}
                      </p>
                    </div>

                    {/* Keyboard Enter indicator */}
                    {isSelected && (
                      <div className="hidden sm:flex items-center self-center shrink-0 text-[10px] font-semibold text-[color:var(--primary-600)] px-1.5 py-0.5 rounded bg-white/80 border border-[var(--primary-200)] shadow-2xs">
                        <span>Enter ↵</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // HONEST EMPTY STATE
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No results found for &ldquo;{query}&rdquo;
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Try searching for a page name (e.g. &ldquo;quicksend&rdquo;, &ldquo;calendar&rdquo;), task title, or setting (e.g. &ldquo;theme&rdquo;, &ldquo;sound&rdquo;).
              </p>
            </div>
          )}

          {/* Footer with keyboard hints */}
          <div className="bg-slate-50/80 border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">↵</kbd> select</span>
              <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">esc</kbd> close</span>
            </div>
            <span className="hidden sm:inline text-slate-400 font-medium">
              Tasklert Global Search
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
