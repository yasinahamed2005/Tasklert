import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import { TasklertLogo } from "./TasklertLogo";
import AccountDropdown from "./AccountDropdown";
import GlobalSearch from "./GlobalSearch";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

const Navbar = ({
  user = {},
  onLogout,
  notifications = [],
  unreadCount = 0,
  onMarkNotificationRead,
  onClearAllNotifications,
  onDeleteNotification,
  sidebarCollapsed = false,
  onToggleSidebar,
  tasks = [],
  onSelectTask,
  onAction,
  searchQuery,
  onSearchQueryChange,
}) => {
  const navigate = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[var(--app-header-height)] bg-white/98 backdrop-blur-md shadow-xs border-b border-gray-200/80 transition-colors">
      {/* Full-width container with no extra artificial max-w margin, moving items flush to left side */}
      <div className="h-full flex items-center justify-between px-3 sm:px-4 md:px-5 lg:px-6 w-full">
        {/* MOBILE SEARCH ACTIVE MODE (Replaces header with full-width compact search) */}
        {mobileSearchOpen ? (
          <div className="w-full flex items-center md:hidden animate-page-enter">
            <GlobalSearch
              tasks={tasks}
              onSelectTask={onSelectTask}
              onAction={onAction}
              mobileMode={true}
              onCloseMobile={() => setMobileSearchOpen(false)}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
            />
          </div>
        ) : (
          <>
            {/* LEFT SECTION: DESKTOP SIDEBAR TOGGLE + LOGO + UNIFIED SEARCH */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-3.5 min-w-0 flex-1">
              {/* DESKTOP SIDEBAR TOGGLE BUTTON (Styled icon button with PanelLeftOpen/Close, hidden on mobile <768px) */}
              {onToggleSidebar && (
                <button
                  type="button"
                  id="desktop-sidebar-toggle"
                  onClick={onToggleSidebar}
                  aria-controls="tasklert-sidebar"
                  aria-expanded={!sidebarCollapsed}
                  aria-label={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                  title={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                  className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 shadow-2xs transition-all active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] shrink-0"
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="w-4.5 h-4.5 shrink-0 text-slate-700" />
                  ) : (
                    <PanelLeftClose className="w-4.5 h-4.5 shrink-0 text-slate-700" />
                  )}
                </button>
              )}

              {/* LOGO LOCKUP */}
              <TasklertLogo
                size={32}
                textSize="text-xl sm:text-2xl"
                textColor="text-slate-900"
                onClick={() => navigate("/")}
              />

              {/* UNIFIED GLOBAL SEARCH (Beside logo, hidden on mobile) */}
              <div className="hidden md:flex flex-1 max-w-sm lg:max-w-lg xl:max-w-xl ml-1 sm:ml-2 lg:ml-3">
                <GlobalSearch
                  tasks={tasks}
                  onSelectTask={onSelectTask}
                  onAction={onAction}
                  mobileMode={false}
                  searchQuery={searchQuery}
                  onSearchQueryChange={onSearchQueryChange}
                />
              </div>
            </div>

            {/* RIGHT CONTROLS: MOBILE SEARCH BUTTON + NOTIFICATIONS + ACCOUNT MENU */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0 ml-3">
              {/* MOBILE SEARCH BUTTON (Visible only on mobile <768px) */}
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Search tasks, alarms, settings"
                title="Search tasks, alarms, settings"
                className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer"
              >
                <Search className="w-5 h-5 text-slate-600" />
              </button>

              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={onMarkNotificationRead}
                onClearAll={onClearAllNotifications}
                onDelete={onDeleteNotification}
              />

              <AccountDropdown user={user} onLogout={onLogout} />
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
