import React, { useEffect, useState, Suspense, lazy } from "react";
import { Outlet, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import AuthShell from "./components/AuthShell";
import { AppStartupFallback } from "./components/PageSkeletons";
import PageTransitionLoader from "./components/PageTransitionLoader";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Resilient code-splitting loader with automatic retry on stale chunk deployment
const lazyWithRetry = (factory) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      console.warn("Chunk load failed, checking network/deployment...", err);
      const sessionKey = "chunk_retry_" + window.location.pathname;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        if ("caches" in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch (_) {}
        }
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    }
  });

// Lazy loaded page components
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Login = lazyWithRetry(() => import("./components/Login"));
const SignUp = lazyWithRetry(() => import("./components/SignUp"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Pendingpage = lazyWithRetry(() => import("./pages/PendingPage"));
const CompletePage = lazyWithRetry(() => import("./pages/CompletePage"));
const Profile = lazyWithRetry(() => import("./components/Profile"));
const MessageCenter = lazyWithRetry(() => import("./pages/MessageCenter"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const AlarmSettingsPage = lazyWithRetry(() => import("./pages/AlarmSettingsPage"));
const CalendarPage = lazyWithRetry(() => import("./pages/CalendarPage"));
const AnalyticsPage = lazyWithRetry(() => import("./pages/AnalyticsPage"));
const FocusTimerPage = lazyWithRetry(() => import("./pages/FocusTimerPage"));
const AlarmsPage = lazyWithRetry(() => import("./pages/AlarmsPage"));

const App = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      document.documentElement.classList.remove(
        "theme-blue",
        "theme-peach",
        "theme-green",
        "theme-lavender",
        "theme-dark",
        "theme-pink"
      );
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      return stored && stored !== "undefined" ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn("Failed to parse stored currentUser, clearing:", e);
      try { localStorage.removeItem("currentUser"); } catch (_) {}
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
      } else {
        localStorage.removeItem("currentUser");
      }
    } catch (_) {}
  }, [currentUser]);

  const handleAuthSubmit = (data) => {
    const user = {
      email: data.email,
      name: data.name || "User",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        data.name || "User"
      )}&background=random`,
    };

    setCurrentUser(user);
    navigate("/", { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  // Lightweight idle chunk preloading for primary task routes (excluding heavy analytics)
  useEffect(() => {
    if (currentUser) {
      const preloadPrimaryChunks = () => {
        import("./pages/PendingPage");
        import("./pages/CompletePage");
      };

      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(preloadPrimaryChunks, { timeout: 5000 });
        return () => window.cancelIdleCallback?.(id);
      } else {
        const id = setTimeout(preloadPrimaryChunks, 3000);
        return () => clearTimeout(id);
      }
    }
  }, [currentUser]);

  return (
    <>
      <ToastContainer
        position="top-right"
        newestOnTop
        limit={3}
        autoClose={4000}
        closeOnClick
        pauseOnHover
        pauseOnFocusLoss={false}
        theme="light"
      />
      <ErrorBoundary>
        <Routes>
      {/* Landing (public marketing page) */}
      <Route
        path="/welcome"
        element={
          <Suspense fallback={<AppStartupFallback label="Loading Tasklert..." />}>
            <Landing />
          </Suspense>
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<AppStartupFallback label="Loading Login..." />}>
            <AuthShell
              mode="login"
              onSwitchToLogin={() => navigate("/login")}
              onSwitchToSignup={() => navigate("/signup")}
            >
              <Login
                onSubmit={handleAuthSubmit}
                onSwitchMode={() => navigate("/signup")}
                showSwitchLink={false}
              />
            </AuthShell>
          </Suspense>
        }
      />

      {/* SignUp */}
      <Route
        path="/signup"
        element={
          <Suspense fallback={<AppStartupFallback label="Loading Sign Up..." />}>
            <AuthShell
              mode="signup"
              onSwitchToLogin={() => navigate("/login")}
              onSwitchToSignup={() => navigate("/signup")}
            >
              <SignUp
                onSubmit={handleAuthSubmit}
                onSwitchMode={() => navigate("/login")}
                showSwitchLink={false}
              />
            </AuthShell>
          </Suspense>
        }
      />

      {/* Protected Routes — Layout stays stably mounted, instant navigation */}
      <Route
        element={
          currentUser ? (
            <Layout user={currentUser} onLogout={handleLogout}>
              <Suspense fallback={<PageTransitionLoader message="Loading..." />}>
                <Outlet />
              </Suspense>
            </Layout>
          ) : (
            <Navigate to="/welcome" replace />
          )
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/pending" element={<Pendingpage />} />
        <Route path="/complete" element={<CompletePage />} />
        <Route path="/Complete" element={<Navigate to="/complete" replace />} />
        <Route path="/completed" element={<Navigate to="/complete" replace />} />
        <Route path="/Completed" element={<Navigate to="/complete" replace />} />
        <Route
          path="/profile"
          element={
            <Profile
              user={currentUser}
              setCurrentUser={setCurrentUser}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="/messages" element={<MessageCenter />} />
        <Route
          path="/settings"
          element={
            <SettingsPage
              user={currentUser}
              setCurrentUser={setCurrentUser}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="/settings/alarms" element={<Navigate to="/settings?tab=alarms" replace />} />
        <Route path="/settings/notifications" element={<Navigate to="/settings?tab=notifications" replace />} />
        <Route path="/alarm-settings" element={<Navigate to="/settings?tab=alarms" replace />} />
        <Route path="/alarms" element={<AlarmsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/focus" element={<FocusTimerPage />} />
      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={currentUser ? "/" : "/welcome"} replace />}
      />
      </Routes>
    </ErrorBoundary>
  </>
  );
};

export default App;
