import React, { useEffect, useState, Suspense, lazy, useCallback } from "react";
import { Outlet, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import AuthShell from "./components/AuthShell";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Login from "./components/Login";
import SignUp from "./components/SignUp";
import { AppStartupFallback } from "./components/PageSkeletons";
import PageTransitionLoader from "./components/PageTransitionLoader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { clearAuthTokenForSW } from "./utils/pushManager";
import { accountManager } from "./db/accountManager";
import { syncEngine } from "./services/syncEngine";
import SecurityActionPage from "./pages/SecurityActionPage";
import { syncSystemNavigationBar } from "./utils/systemBars";

// Resilient code-splitting loader with automatic retry on stale chunk deployment
const lazyWithRetry = (factory) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      console.warn("Chunk load failed, checking connectivity...", err);
      // If offline, DO NOT wipe caches and DO NOT reload; propagate error to ErrorBoundary
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw err;
      }
      const sessionKey = "chunk_retry_" + window.location.pathname;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    }
  });

// Lazy loaded page components
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
const ReminderDiagnosticsPage = lazyWithRetry(() => import("./pages/ReminderDiagnosticsPage"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));

const App = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Sync underlying user theme preference
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

  useEffect(() => {
    const root = document.documentElement;
    const update = () => syncSystemNavigationBar();
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("themechange", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("themechange", update);
    };
  }, []);

  // Listen for initial service worker offline cache completion
  useEffect(() => {
    const handleOfflineReady = () => {
      toast.success("Tasklert is ready for offline use!", {
        toastId: "tasklert-offline-ready",
        autoClose: 4000,
      });
    };
    window.addEventListener("tasklert-offline-ready", handleOfflineReady);
    return () => window.removeEventListener("tasklert-offline-ready", handleOfflineReady);
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

  const handleLogout = useCallback(async () => {
    try {
      const hasUnsynced = await accountManager.hasUnsyncedChanges();
      if (hasUnsynced) {
        toast.info(
          "You have unsaved changes on this device. They are safely saved in local storage and will resume syncing when you sign back in.",
          { autoClose: 6000 }
        );
      }
    } catch (_) {}

    syncEngine.stop();
    await accountManager.handleLogout();

    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("tasklert_cached_tasks");
    clearAuthTokenForSW().catch(() => {});
    setCurrentUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const onRevoked = () => { handleLogout(); };
    window.addEventListener("tasklert:session-revoked", onRevoked);
    return () => window.removeEventListener("tasklert:session-revoked", onRevoked);
  }, [handleLogout]);

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
        element={<Landing />}
      />

      {/* Login */}
      <Route
        path="/login"
        element={<AuthPage initialMode="login" onAuthSubmit={handleAuthSubmit} />}
      />

      {/* SignUp */}
      <Route
        path="/signup"
        element={<AuthPage initialMode="signup" onAuthSubmit={handleAuthSubmit} />}
      />
      <Route path="/security-action" element={<SecurityActionPage />} />

      {/* Public Legal Document Pages */}
      <Route
        path="/terms"
        element={
          <Suspense fallback={<PageTransitionLoader message="Loading Terms of Service..." />}>
            <TermsOfService />
          </Suspense>
        }
      />
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<PageTransitionLoader message="Loading Privacy Policy..." />}>
            <PrivacyPolicy />
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
        <Route path="/quicksend" element={<Navigate to="/messages" replace />} />
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
        <Route path="/diagnostics" element={<ReminderDiagnosticsPage />} />
        <Route path="/reminders/diagnostics" element={<Navigate to="/diagnostics" replace />} />
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
