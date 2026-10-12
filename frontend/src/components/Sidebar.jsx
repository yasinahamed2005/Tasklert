import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PRODUCTIVITY_CARD, SIDEBAR_CLASSES, menuItems, LINK_CLASSES } from '../assets/dummy';
import { Sparkles, Menu, X, Trophy } from "lucide-react";

const Sidebar = ({ user, tasks }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.completed).length || 0;
  const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const fullName = user?.name || "User";
  const firstName = fullName.trim().split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase();

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; }
  }, [mobileOpen]);

  const renderMenuItems = (isMobile = false) => (
    <ul className='space-y-2'>
      {menuItems.map(({ text, path, icon }) => (
        <li key={text}>
          <NavLink
            to={path}
            className={({ isActive }) =>
              [
                LINK_CLASSES.base,
                isActive ? LINK_CLASSES.active : LINK_CLASSES.inactive,
                isMobile ? "justify-start" : "lg:justify-start"
              ].join(" ")
            }
            onClick={() => setMobileOpen(false)}
          >
            <span className={LINK_CLASSES.icon}>{icon}</span>
            <span className={`${isMobile ? "block" : "hidden lg:block"} ${LINK_CLASSES.text}`}>
              {text}
            </span>
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <div className={`${SIDEBAR_CLASSES.desktop} flex flex-col justify-between`}>
        <div>
          {/* User Info */}
          <div className='p-3 lg:p-5 border-b border-purple-100 block'>
            <div className='flex items-center justify-center lg:justify-start gap-3'>
              <div className='w-10 h-10 rounded-full initial-avatar flex items-center justify-center shadow-md text-base font-bold shrink-0'>
                {initial}
              </div>
              <div className='hidden lg:block min-w-0'>
                <h2 className='text-lg font-bold text-gray-800 tracking-tight truncate'>Hi, {firstName}</h2>
                <p className='text-sm text-purple-500 font-medium flex items-center gap-1 truncate'>
                  <Sparkles className='w-3 h-3 text-purple-500 shrink-0' /> Smash those goals!
                </p>
              </div>
            </div>
          </div>

          {/* Productivity */}
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

          {/* Menu Items */}
          <div className='mt-4'>
            {renderMenuItems()}
          </div>

          {/* BOTTOM CUP VISION TROPHY CARD (Theme Reactive - Full on lg, Compact icon on md) */}
          <div className='p-2 md:p-3 mt-4 mb-4'>
            {/* Full Card for expanded Sidebar (lg screens) */}
            <div className='hidden lg:block p-4 rounded-2xl bg-gradient-to-b from-purple-50/80 via-purple-50/50 to-purple-100/60 border border-purple-100 text-center relative overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 group'>
              {/* Confetti Accent Dots */}
              <div className='absolute top-2 left-4 w-1.5 h-1.5 rounded-full bg-purple-400 opacity-70 animate-pulse' />
              <div className='absolute top-3 right-5 w-2 h-2 rounded-sm bg-amber-400 opacity-80 rotate-45' />
              <div className='absolute bottom-8 left-4 w-1.5 h-1.5 rounded-full bg-pink-400 opacity-70' />
              <div className='absolute bottom-10 right-4 w-2 h-1 rounded-sm bg-orange-400 opacity-80' />

              {/* Trophy Icon Container */}
              <div className='relative mx-auto mb-3 w-16 h-16 flex items-center justify-center'>
                <div className='w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-purple-500/25 transform group-hover:scale-105 transition-transform duration-300'>
                  <Trophy className='w-8 h-8 text-amber-300 drop-shadow-sm' />
                </div>
                <div className='absolute -bottom-1.5 w-12 h-2 bg-purple-300/50 rounded-full blur-[2px]' />
              </div>

              {/* Text Content */}
              <h4 className='text-sm font-bold text-gray-800 tracking-tight'>
                Keep it up, {firstName}!
              </h4>
              <p className='text-xs text-gray-500 mt-1 font-medium'>
                You're doing great today.
              </p>
            </div>

            {/* Compact Cup Icon for Icon-Only Sidebar (md screens) */}
            <div className='block lg:hidden text-center' title={`Keep it up, ${firstName}!`}>
              <div className='w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20'>
                <Trophy className='w-5 h-5 text-amber-300' />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE MENU BUTTON */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className={SIDEBAR_CLASSES.mobileButton}
        >
          <Menu className='w-5 h-5' />
        </button>
      )}

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className='fixed inset-0 z-40'>
          <div
            className={SIDEBAR_CLASSES.mobileDrawerBackdrop}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={`${SIDEBAR_CLASSES.mobileDrawer} flex flex-col justify-between`}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className='flex justify-between items-center mb-4 border-b pb-2'>
                <h2 className='text-lg font-bold text-purple-600'>Menu</h2>
                <button
                  onClick={() => setMobileOpen(false)}
                  className='text-gray-700 hover:text-purple-600'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              {/* User Info */}
              <div className='flex items-center gap-3 mb-6'>
                <div className='w-10 h-10 rounded-full initial-avatar flex items-center justify-center shadow-md font-bold'>
                  {initial}
                </div>
                <div>
                  <h2 className='text-lg font-bold text-gray-800'>Hi, {firstName}</h2>
                  <p className='text-sm text-purple-500 font-medium flex items-center gap-1'>
                    <Sparkles className='w-3 h-3' /> Smash those goals!
                  </p>
                </div>
              </div>

              {/* Mobile Menu Items */}
              {renderMenuItems(true)}
            </div>

            {/* Mobile Bottom Cup Vision Card */}
            <div className='mt-6 p-4 rounded-2xl bg-gradient-to-b from-purple-50/80 via-purple-50/50 to-purple-100/60 border border-purple-100 text-center relative overflow-hidden'>
              <div className='mx-auto mb-2 w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-500 flex items-center justify-center text-white shadow-sm'>
                <Trophy className='w-6 h-6 text-amber-300' />
              </div>
              <h4 className='text-xs font-bold text-gray-800'>
                Keep it up, {firstName}!
              </h4>
              <p className='text-[11px] text-gray-500 mt-0.5'>
                You're doing great today.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
