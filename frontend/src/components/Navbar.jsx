import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Palette, ChevronDown, LogOut } from "lucide-react";
import ThemeSettings from "./ThemeSettings";
import NotificationBell from "./NotificationBell";
import { TasklertLogo } from "./TasklertLogo";

const Navbar = ({
  user = {},
  onLogout,
  notifications = [],
  unreadCount = 0,
  onMarkNotificationRead,
  onClearAllNotifications,
}) => {
  const menuref = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navigate = useNavigate();
  const username = user?.name || "User";
  const initial = username.charAt(0).toUpperCase();

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuref.current && !menuref.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuToggle = () => setMenuOpen((prev) => !prev);

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-[var(--app-header-height)] bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="h-full flex items-center justify-between px-4 md:px-6 max-w-7xl mx-auto">
          
          {/* LOGO LOCKUP */}
          <TasklertLogo
            size={38}
            textSize="text-2xl"
            textColor="text-purple-900"
            onClick={() => navigate("/")}
          />

          {/* RIGHT */}
          <div className="flex items-center gap-4">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={onMarkNotificationRead}
              onClearAll={onClearAllNotifications}
            />
            {/* USER MENU */}
            <div ref={menuref} className="relative">
              <button
                onClick={handleMenuToggle}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[color:var(--primary-50)] transition"
              >
                {user?.avatar && !avatarError ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    className="w-9 h-9 rounded-full"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full initial-avatar flex items-center justify-center text-sm">
                    {initial}
                  </div>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {menuOpen && (
                <ul className="absolute top-14 right-0 w-56 bg-white rounded-xl shadow-lg border z-50">
                  <li className="p-2">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setOpenTheme(true);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-[color:var(--primary-50)] flex gap-2"
                    >
                      <Palette className="w-4 h-4" />
                      Theme Settings
                    </button>
                  </li>
                  <li className="p-2">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-[color:var(--primary-50)] flex gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Profile Settings
                    </button>
                  </li>
                  <li className="p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* THEME MODAL */}
      {openTheme && <ThemeSettings onClose={() => setOpenTheme(false)} />}
    </>
  );
};

export default Navbar;
