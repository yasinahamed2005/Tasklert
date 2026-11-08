import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import { TasklertLogo } from "./TasklertLogo";
import AccountDropdown from "./AccountDropdown";
import GlobalSearch from "./GlobalSearch";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useBodyScrollLock } from "../utils/scrollLock";

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

  // Auto-close mobile search mode on viewport transition to desktop (>=768px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scrolling when mobile search is active
  useBodyScrollLock(mobileSearchOpen);

  return (
    <header className="app-header fixed top-0 left-0 right-0 z-50 h-[var(--app-header-height)] bg-white/98 backdrop-blur-md shadow-xs border-b border-gray-200/80 transition-colors">
      {/* Full-width container with no extra artificial max-w margin, moving items flush to left side */}
      <div className="h-full flex items-center justify-between px-3 sm:px-4 md:px-5 lg:px-6 w-full">
        {/* MOBILE VIEW (<768px): Dedicated mobile bar with toggleable full-width search */}
        <div className="flex md:hidden items-center justify-between w-full h-full">
          {mobileSearchOpen ? (
            <div className="w-full flex items-center animate-page-enter">
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
              <TasklertLogo
                size={30}
                textSize="text-xl"
                idPrefix="tl-nav-mobile"
                onClick={() => navigate("/")}
              />

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  aria-label="Search tasks, alarms, settings"
                  title="Search tasks, alarms, settings"
                  className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer"
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

        {/* DESKTOP VIEW (>=768px): Always rendered and permanently visible on laptop/desktop */}
        <div className="hidden md:flex items-center justify-between w-full h-full">
          {/* LEFT SECTION: DESKTOP SIDEBAR TOGGLE + LOGO + UNIFIED SEARCH */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-3.5 min-w-0 flex-1">
            {onToggleSidebar && (
              <button
                type="button"
                id="desktop-sidebar-toggle"
                onClick={onToggleSidebar}
                aria-controls="tasklert-sidebar"
                aria-expanded={!sidebarCollapsed}
                aria-label={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                title={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 shadow-2xs transition-all active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] shrink-0"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="w-4.5 h-4.5 shrink-0" />
                ) : (
                  <PanelLeftClose className="w-4.5 h-4.5 shrink-0" />
                )}
              </button>
            )}

            {/* LOGO LOCKUP */}
            <TasklertLogo
              size={32}
              textSize="text-xl sm:text-2xl"
              idPrefix="tl-nav-desktop"
              onClick={() => navigate("/")}
            />

            {/* UNIFIED GLOBAL SEARCH (Beside logo) */}
            <div className="flex flex-1 max-w-sm lg:max-w-lg xl:max-w-xl ml-1 sm:ml-2 lg:ml-3">
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

          {/* RIGHT CONTROLS: NOTIFICATIONS + ACCOUNT MENU */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0 ml-3">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={onMarkNotificationRead}
              onClearAll={onClearAllNotifications}
              onDelete={onDeleteNotification}
            />

            <AccountDropdown user={user} onLogout={onLogout} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
