import React, { useState } from "react";
import {
  Copy,
  Plus,
  Search,
  Check,
  Tag,
  FileText,
  Mail,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";

const DEFAULT_TEMPLATES = [
  {
    id: "tpl_task_update",
    title: "Task Progress Update",
    category: "Productivity",
    channel: "all",
    subject: "Task Update: {{task_name}}",
    body: "Hi {{name}},\n\nHere is a quick progress update regarding {{task_name}}:\nThe task is currently on track and scheduled to be completed by {{date}}.\n\nPlease let me know if you have any questions.\n\nBest regards,\nTasklert Team",
    tags: ["Task", "Update"],
  },
  {
    id: "tpl_meeting_reminder",
    title: "Meeting Sync Reminder",
    category: "Schedule",
    channel: "all",
    subject: "Reminder: Sync Meeting at {{time}}",
    body: "Hi {{name}},\n\nFriendly reminder regarding our upcoming meeting scheduled for {{date}} at {{time}}.\n\nMeeting Agenda:\n1. Sprint Progress & Milestones\n2. Open Blockers\n3. Next Steps\n\nLooking forward to speaking with you.",
    tags: ["Meeting", "Reminder"],
  },
  {
    id: "tpl_project_review",
    title: "Project Review Required",
    category: "Review",
    channel: "google_mail",
    subject: "Project Review Required: {{project_name}}",
    body: "Hello Team,\n\nThe latest deliverables for {{project_name}} are ready for your review.\n\nPlease inspect the documentation and share your feedback before {{deadline}}.\n\nThank you for your collaboration.",
    tags: ["Review", "Project"],
  },
  {
    id: "tpl_exam_announcement",
    title: "Exam & Class Announcement",
    category: "Announcements",
    channel: "telegram",
    subject: "Announcement: {{title}}",
    body: "📢 Dear Students,\n\nPlease note the following update regarding {{title}}:\nAll scheduled sessions will proceed as planned. Please ensure your attendance on time.\n\nVenue: {{venue}}\nTime: {{time}}",
    tags: ["Telegram", "Announcement"],
  },
  {
    id: "tpl_follow_up",
    title: "Friendly Follow-Up",
    category: "Productivity",
    channel: "all",
    subject: "Following up on our recent conversation",
    body: "Hi {{name}},\n\nI hope you're having a productive week.\n\nI wanted to quickly follow up on our previous discussion regarding {{topic}}. Please let me know your thoughts when you have a moment.",
    tags: ["Follow-up"],
  },
];

export function QuicksendTemplates({ onUseTemplate, onBackToOverview }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [copiedId, setCopiedId] = useState(null);

  const categories = ["all", "Productivity", "Schedule", "Review", "Announcements"];

  const filtered = DEFAULT_TEMPLATES.filter((tpl) => {
    const matchesCat = activeCategory === "all" || tpl.category === activeCategory;
    const matchesSearch =
      !search.trim() ||
      tpl.title.toLowerCase().includes(search.toLowerCase()) ||
      tpl.body.toLowerCase().includes(search.toLowerCase()) ||
      tpl.subject.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopy = (tpl, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tpl.body);
    setCopiedId(tpl.id);
    toast.success("Template copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-purple-100 p-4 sm:p-6 shadow-2xs animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-50 mb-5">
        <div>
          <h2 className="text-lg font-black text-[#17133D] flex items-center gap-2">
            <Copy className="w-5 h-5 text-purple-600" />
            <span>Message & Email Templates</span>
          </h2>
          <p className="text-xs text-[#77738F] mt-0.5 font-medium">
            Reusable message templates with automatic placeholder substitution.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 bg-purple-50/50 border border-purple-100 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-purple-400 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 capitalize ${
              activeCategory === cat
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-purple-50 text-purple-800 hover:bg-purple-100/70"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1 pr-1">
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-[#FAF7FF] rounded-2xl border border-purple-100 hover:border-purple-300 p-4 flex flex-col justify-between transition-all hover:shadow-xs group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  {tpl.category}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleCopy(tpl, e)}
                  className="p-1.5 rounded-lg hover:bg-purple-200/50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
                  title="Copy text"
                >
                  {copiedId === tpl.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <h3 className="text-sm font-bold text-[#17133D] group-hover:text-purple-700 transition">
                {tpl.title}
              </h3>
              <p className="text-[11px] font-semibold text-purple-600 mt-0.5 truncate">
                {tpl.subject}
              </p>

              <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-purple-100/80 text-[11px] text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-hidden line-clamp-4">
                {tpl.body}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-purple-100/60 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {tpl.tags.map((t) => (
                  <span key={t} className="text-[10px] text-gray-400 font-medium">
                    #{t}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onUseTemplate?.(tpl)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>Use Template</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuicksendTemplates;

