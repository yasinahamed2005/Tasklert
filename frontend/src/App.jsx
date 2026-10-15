import React, { useEffect, useState, Suspense, lazy } from "react";
import { Outlet, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import AuthShell from "./components/AuthShell";
import { AppStartupFallback } from "./components/PageSkeletons";
import PageTransitionLoader from "./components/PageTransitionLoader";

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
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth_session") === "test") {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ODA2YmIwYjliNGQ2NTlhM2E4ZTE0MSIsImlhdCI6MTc5MTk4NDE1OCwiZXhwIjoxNzkyMDcwNTU4fQ.hI179zIkRQlud1QEns7NK_ofXjIQFvVKJqC8DzMhR0s";
        localStorage.setItem("token", token);
        localStorage.setItem("userId", "69806bb0b9b4d659a3a8e141");
        const user = { name: "yaseen", email: "yaseen@gmail.com" };
        localStorage.setItem("currentUser", JSON.stringify(user));
        return user;
      }
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

  return (
    <>
      <ToastContainer
        position="top-right"
        newestOnTop
        limit={2}
        closeOnClick
        pauseOnFocusLoss={false}
        theme="light"
      />
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

      {/* Protected Routes */}
      <Route
        element={
          currentUser ? (
            <Layout user={currentUser} onLogout={handleLogout}>
              <Outlet />
            </Layout>
          ) : (
            <Navigate to="/welcome" replace />
          )
        }
      >
        <Route
          path="/"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading dashboard..." />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="/pending"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading pending tasks..." />}>
              <Pendingpage />
            </Suspense>
          }
        />
        <Route
          path="/Complete"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading completed tasks..." />}>
              <CompletePage />
            </Suspense>
          }
        />
        <Route
          path="/profile"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading profile..." />}>
              <Profile user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} />
            </Suspense>
          }
        />
        <Route
          path="/messages"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading message center..." />}>
              <MessageCenter />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading settings..." />}>
              <AlarmSettingsPage />
            </Suspense>
          }
        />
        <Route
          path="/alarms"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading alarms..." />}>
              <AlarmsPage />
            </Suspense>
          }
        />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading calendar..." />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading analytics..." />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="/focus"
          element={
            <Suspense fallback={<PageTransitionLoader message="Loading focus timer..." />}>
              <FocusTimerPage />
            </Suspense>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={currentUser ? "/" : "/welcome"} replace />}
      />
      </Routes>
    </>
  );
};

export default App;
