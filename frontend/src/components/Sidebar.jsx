import React from 'react';
import { NavLink } from 'react-router-dom';
import { PRODUCTIVITY_CARD, menuItems, LINK_CLASSES } from '../assets/dummy';
import { Sparkles, Trophy } from "lucide-react";
import UserAvatar from "./UserAvatar";

const Sidebar = ({ user, tasks, collapsed = false }) => {
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.completed).length || 0;
  const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const fullName = user?.name || "User";
  const firstName = fullName.trim().split(" ")[0];

  const renderMenuItems = () => (
    <ul className="space-y-1.5 px-2">
      {menuItems.map(({ text, path, icon }) => (
        <li key={text} className="relative group">
          <NavLink
            to={path}
            title={collapsed ? text : undefined}
            aria-label={text}
            className={({ isActive }) =>
              [
                LINK_CLASSES.base,
                isActive ? LINK_CLASSES.active : LINK_CLASSES.inactive,
                collapsed ? "justify-center px-2 py-3" : "justify-center lg:justify-start px-3.5 py-2.5",
              ].join(" ")
            }
          >
            <span className={LINK_CLASSES.icon}>{icon}</span>
            <span
              className={
                collapsed
                  ? "sr-only"
                  : `hidden lg:block ${LINK_CLASSES.text}`
              }
            >
              {text}
            </span>
          </NavLink>

          {/* Floating Tooltip Chip for Collapsed Rail Mode on Desktop Hover */}
          {collapsed && (
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden md:group-hover:flex items-center px-2.5 py-1 text-xs font-bold text-white bg-slate-900 rounded-lg shadow-md whitespace-nowrap z-50 animate-page-enter">
              {text}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR - Strictly hidden on phones (<768px), compact icon rail or full expanded on desktop */}
      <aside
        id="tasklert-sidebar"
        aria-label="Sidebar Navigation"
        className={`hidden md:flex flex-col justify-between fixed top-[var(--app-header-height)] h-[calc(100vh-var(--app-header-height))] overflow-y-auto bg-white border-r border-purple-100/80 shadow-xs z-20 transition-all duration-300 ${
          collapsed ? "w-20" : "w-20 lg:w-64"
        }`}
      >
        <div>
          {/* User Profile Shortcut & Greeting */}
          <div className="p-3 lg:p-4 border-b border-purple-100/80 block">
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-center lg:justify-start"} gap-3`}>
              <NavLink
                to="/profile"
                title="My Profile"
                aria-label="View My Profile"
                className="group relative flex items-center justify-center shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] active:scale-95 transition cursor-pointer"
              >
                <UserAvatar user={user} size="md" />
                <span className="sr-only">My Profile</span>
              </NavLink>

              {!collapsed && (
                <div className="hidden lg:block min-w-0">
                  <h2 className="text-base font-bold text-gray-800 tracking-tight truncate">Hi, {firstName}</h2>
                  <p className="text-xs text-[color:var(--primary-600)] font-medium flex items-center gap-1 truncate">
                    <Sparkles className="w-3 h-3 text-[color:var(--primary)] shrink-0" /> Smash those goals!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Productivity Indicator */}
          {collapsed ? (
            <div
              className="mx-2 my-3 p-2 bg-purple-50/60 rounded-xl border border-purple-100 text-center select-none"
              title={`Productivity: ${productivity}%`}
            >
              <div className="text-[10px] font-bold text-purple-700 tracking-wider">PROD</div>
              <div className="text-xs font-extrabold text-[color:var(--primary-700)] mt-0.5">{productivity}%</div>
            </div>
          ) : (
            <div className="hidden lg:block mx-3 my-3">
              <div className={PRODUCTIVITY_CARD.container}>
                <div className={PRODUCTIVITY_CARD.header}>
                  <h3 className={PRODUCTIVITY_CARD.label}>PRODUCTIVITY</h3>
                  <span className={PRODUCTIVITY_CARD.badge}>{productivity}%</span>
                </div>
                <div className={PRODUCTIVITY_CARD.barBg}>
                  <div
                    className={PRODUCTIVITY_CARD.barFg}
                    style={{ width: `${productivity}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div className="mt-2">
            {renderMenuItems()}
          </div>

          {/* BOTTOM CUP VISION TROPHY CARD */}
          <div className="p-2 md:p-3 mt-4 mb-4">
            {collapsed ? (
              <div className="text-center" title={`Keep it up, ${firstName}!`}>
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-500 flex items-center justify-center text-white shadow-sm hover:scale-105 transition-transform cursor-pointer">
                  <Trophy className="w-5 h-5 text-amber-300" />
                </div>
              </div>
            ) : (
              <>
                {/* Full Card for expanded Sidebar (lg screens) */}
                <div className="hidden lg:block p-4 rounded-2xl bg-gradient-to-b from-purple-50/80 via-purple-50/50 to-purple-100/60 border border-purple-100 text-center relative overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 group">
                  <div className="absolute top-2 left-4 w-1.5 h-1.5 rounded-full bg-purple-400 opacity-70 animate-pulse" />
                  <div className="absolute top-3 right-5 w-2 h-2 rounded-sm bg-amber-400 opacity-80 rotate-45" />
                  <div className="absolute bottom-8 left-4 w-1.5 h-1.5 rounded-full bg-pink-400 opacity-70" />
                  <div className="absolute bottom-10 right-4 w-2 h-1 rounded-sm bg-orange-400 opacity-80" />

                  <div className="relative mx-auto mb-3 w-16 h-16 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-fuchsia-500 flex items-center justify-center text-white shadow-sm transition-transform duration-300">
                      <Trophy className="w-8 h-8 text-amber-300 drop-shadow-sm" />
                    </div>
                    <div className="absolute -bottom-1.5 w-12 h-2 bg-purple-300/50 rounded-full blur-[2px]" />
                  </div>

                  <h4 className="text-sm font-bold text-gray-800 tracking-tight">
                    Keep it up, {firstName}!
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    You're doing great today.
                  </p>
                </div>

                {/* Compact Cup Icon for Icon-Only medium screens */}
                <div className="block lg:hidden text-center" title={`Keep it up, ${firstName}!`}>
                  <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-500 flex items-center justify-center text-white shadow-sm">
                    <Trophy className="w-5 h-5 text-amber-300" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
